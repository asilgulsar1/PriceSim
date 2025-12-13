"use client";

import React, { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { solveMinerPrice } from "@/lib/pricing-solver";
import { INITIAL_MINERS } from "@/lib/miner-data";
import { ContractTerms } from "@/lib/price-simulator-calculator";
import { rankMiners, MinerScoreDetail } from "@/lib/miner-scoring";
import { DEFAULT_CONTRACT_TERMS, DEFAULT_TARGET_MARGIN } from "@/lib/constants";
import { useMarketData } from "@/hooks/useMarketData";

// Sub-components
import { PriceListControls } from "./price-list/PriceListControls";
import { PriceListFilterBar, SortField } from "./price-list/PriceListFilterBar";
import { PriceListTable } from "./price-list/PriceListTable";
import { PriceListPdfTemplate } from "./price-list/PriceListPdfTemplate";
import { StickyActionFooter } from "@/components/ui/sticky-action-footer";
import { Button } from "@/components/ui/button";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { RefreshCw, FileText, Loader2 } from "lucide-react";
import { calculateHashpriceUSD, calculateMinerRevenueUSD } from '@/lib/mining-math';
import { findMatchingMarketMiner, SimpleMarketMiner } from "@/lib/market-matching";



interface PriceListGeneratorProps {
    userRole?: string;
    resellerMargin?: number;
    branding?: {
        companyName?: string;
        logoUrl?: string;
        footerText?: string;
    };
}

import { urlToBase64 } from "@/lib/image-utils";
import { Skeleton } from "@/components/ui/skeleton";

// ... (existing imports)

export function PriceListGenerator({ userRole, resellerMargin, branding }: PriceListGeneratorProps) {
    // --- State ---
    const [clientName, setClientName] = useState('Valued Client');
    const [salesMargin, setSalesMargin] = useState<number>(0);
    const [salesMarginType, setSalesMarginType] = useState<'usd' | 'percent'>('usd');
    const [pdfStyle, setPdfStyle] = useState<string>('default');

    // Market Hook
    const { market, setMarket } = useMarketData();
    const [loading, setLoading] = useState(true); // Start loading
    const [isReady, setIsReady] = useState(false); // Prevents flicker
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [marketDataList, setMarketDataList] = useState<SimpleMarketMiner[]>([]);

    // PDF Images State (Base64)
    const [pdfImages, setPdfImages] = useState<{ logo: string }>({ logo: "" });

    // Results
    const [baseResults, setBaseResults] = useState<MinerScoreDetail[]>([]);

    // ... (Filter & Sort State remains same) ...
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<SortField>('score');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const documentRef = useRef<HTMLDivElement>(null);

    // ... (Derived State: results, filteredResults, recommendations remain same) ...
    const results = React.useMemo(() => {
        if (baseResults.length === 0) return [];

        // HASHPRICE CALCULATION (Live) via Centralized Math
        // This ensures consistent logic across the app.
        // const { calculateHashpriceUSD, calculateMinerRevenueUSD } = require('@/lib/mining-math');

        let liveHashpriceUSD = 0;
        if (market.networkDifficulty > 0 && market.btcPrice > 0) {
            liveHashpriceUSD = calculateHashpriceUSD(market.networkDifficulty, market.blockReward, market.btcPrice);
        }

        const updated = baseResults.map(item => {
            const rawMiner = { ...item.miner };

            // FIX 1: UPDATE REVENUE WITH LIVE MARKET DATA
            if (liveHashpriceUSD > 0) {
                // Apply Pool Fee (Assume Standard 1% if not in miner, or use Default)
                const poolFee = DEFAULT_CONTRACT_TERMS.poolFee || 1.0;
                rawMiner.dailyRevenueUSD = calculateMinerRevenueUSD(rawMiner.hashrateTH, liveHashpriceUSD, poolFee);
            }

            // STEP 1: Apply Max(Simulator Price, Market Middle Price) Logic
            const marketMiddlePrice = findMatchingMarketMiner(rawMiner, marketDataList);
            let basePrice = Math.max(rawMiner.calculatedPrice, marketMiddlePrice);

            // RESELLER MARKUP LOGIC
            if (userRole === 'reseller') {
                // Fix 3 Clarification: Reseller adds margin on top of company price. 
                // Here 'resellerMargin' acts as the Company's markup/floor.
                const markup = typeof resellerMargin === 'number' ? resellerMargin : 500;
                basePrice += markup;
            }

            rawMiner.calculatedPrice = basePrice;

            // STEP 2: Apply Margin
            let marginAmount = 0;
            if (salesMarginType === 'usd') {
                marginAmount = salesMargin;
            } else {
                marginAmount = rawMiner.calculatedPrice * (salesMargin / 100);
            }
            rawMiner.calculatedPrice = rawMiner.calculatedPrice + marginAmount;

            // STEP 3: Recalculate ROI
            if (rawMiner.calculatedPrice > 0 && rawMiner.dailyRevenueUSD > 0) {
                rawMiner.clientProfitabilityPercent = ((rawMiner.dailyRevenueUSD * 365) / rawMiner.calculatedPrice) * 100;
            } else {
                rawMiner.clientProfitabilityPercent = 0;
            }

            return { ...item, miner: rawMiner };
        });

        const minersOnly = updated.map(u => u.miner);
        return rankMiners(minersOnly);

    }, [baseResults, salesMargin, salesMarginType, marketDataList, userRole, resellerMargin, market]);

    // ... (filteredResults & recommendations remain same) ...
    const filteredResults = React.useMemo(() => { // ... same logic ...
        return results
            .filter(r => r.miner.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => { // ... same sort logic ...
                let valA = 0, valB = 0;
                const direction = sortOrder === 'asc' ? 1 : -1;
                switch (sortBy) {
                    case 'score': valA = a.score; valB = b.score; break;
                    case 'price': valA = a.miner.calculatedPrice; valB = b.miner.calculatedPrice; break;
                    case 'roi': valA = a.miner.clientProfitabilityPercent; valB = b.miner.clientProfitabilityPercent; break;
                    case 'payback':
                    case 'payback':
                        const getPaybackVal = (m: any) => {
                            // Let's just use the inverse of profitability.
                            if (m.clientProfitabilityPercent <= 0) return 99999;
                            return 36500 / m.clientProfitabilityPercent;
                        };
                        valA = getPaybackVal(a.miner);
                        valB = getPaybackVal(b.miner);
                        break;
                        break;
                    case 'efficiency': valA = a.miner.powerWatts / a.miner.hashrateTH; valB = b.miner.powerWatts / b.miner.hashrateTH; break;
                    case 'revenue': valA = a.miner.dailyRevenueUSD; valB = b.miner.dailyRevenueUSD; break;
                }
                return (valA - valB) * direction;
            });
    }, [results, searchTerm, sortBy, sortOrder]);

    const recommendations = React.useMemo(() => {
        if (results.length === 0) return { topROI: [], topRevenue: [], topEfficiency: [] };
        const byROI = [...results].sort((a, b) => b.raw.profitability - a.raw.profitability).slice(0, 2);
        const byRev = [...results].sort((a, b) => b.raw.revenue - a.raw.revenue).slice(0, 2);
        const byEff = [...results].sort((a, b) => a.raw.efficiency - b.raw.efficiency).slice(0, 2);
        return { topROI: byROI, topRevenue: byRev, topEfficiency: byEff };
    }, [results]);


    // --- Side Effects ---

    // 1. Pre-load PDF Images
    useEffect(() => {
        const loadImages = async () => {
            const logoSrc = branding?.logoUrl || "/logo.png";
            const base64Logo = await urlToBase64(logoSrc);
            setPdfImages({ logo: base64Logo });
        };
        loadImages();
    }, [branding?.logoUrl]);

    // 2. Refresh Data
    const fetchMarketPrices = async () => {
        try {
            console.log("Fetching market prices from API...");
            const res = await fetch('/api/market/latest', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data.miners && Array.isArray(data.miners)) {
                    const list: SimpleMarketMiner[] = [];
                    data.miners.forEach((miner: any) => {
                        if (miner.name && miner.stats && miner.stats.middlePrice > 0) {
                            list.push({
                                name: miner.name,
                                stats: { middlePrice: miner.stats.middlePrice },
                                specs: { hashrateTH: miner.specs?.hashrateTH || 0 }
                            });
                        }
                    });
                    setMarketDataList(list);
                }
            }
        } catch (e) {
            console.warn("Failed to fetch market prices", e);
        }
    };

    const refreshData = async () => {
        setLoading(true);
        setIsReady(false); // Hide table to prevent flicker

        // Helper to normalize input data
        const normalizeMiners = (list: any[]) => {
            if (list.length > 0 && list[0].miner) {
                return list.map((x: any) => x.miner);
            }
            return list;
        };

        try {
            // 1. Try to fetch LATEST from Price Simulator (LocalStorage)
            const savedSim = localStorage.getItem('LATEST_SIMULATION_DATA');
            if (savedSim) {
                const data = JSON.parse(savedSim);
                if (data.miners && Array.isArray(data.miners)) {
                    const rawMiners = normalizeMiners(data.miners);
                    const ranked = rankMiners(rawMiners);
                    setBaseResults(ranked);
                    if (data.updatedAt) setLastUpdated(`Synced from Simulator (${new Date(data.updatedAt).toLocaleTimeString()})`);
                    if (data.market) setMarket(data.market);
                    // Fetch Market Prices BEFORE showing
                    await fetchMarketPrices();
                    setLoading(false);
                    setIsReady(true); // Valid only after BOTH are ready
                    return;
                }
            }
        } catch (e) {
            console.warn("Failed to fetch simulator data", e);
        }

        // 2. Fallback: API
        try {
            const res = await fetch('/api/miners/latest');
            if (res.ok) {
                const data = await res.json();
                if (data.miners && Array.isArray(data.miners)) {
                    const rawMiners = normalizeMiners(data.miners);
                    const ranked = rankMiners(rawMiners);
                    setBaseResults(ranked);
                    if (data.updatedAt) setLastUpdated(new Date(data.updatedAt).toLocaleString());
                    if (data.market) setMarket(data.market);
                    await fetchMarketPrices();
                    setLoading(false);
                    setIsReady(true);
                    return;
                }
            }
        } catch (e) {
            console.warn("Failed to fetch cached data", e);
        }

        // 3. Fallback: Local
        calculateLocal();
        await fetchMarketPrices();
        setIsReady(true);
    };

    // Calculate Local (Callback refactored inline for simplicity or kept if existing)
    const calculateLocal = () => {
        setLoading(true);
        setTimeout(() => {
            const miners = INITIAL_MINERS;
            const calculated = miners.map(miner => {
                const contract: ContractTerms = DEFAULT_CONTRACT_TERMS;
                return solveMinerPrice(miner, contract, market, DEFAULT_TARGET_MARGIN, false);
            });
            const ranked = rankMiners(calculated);
            setBaseResults(ranked);
            setLastUpdated('Calculated Locally (Live)');
            setLoading(false);
        }, 50);
    };

    useEffect(() => {
        refreshData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ... (Handlers handleExportCSV, handleDownloadPDF remain same) ...
    const handleExportCSV = () => {
        // ... (existing export logic)
        const headers = ['Model', 'Score', 'Hashrate (TH/s)', 'Power (W)', 'Efficiency (J/TH)', 'Unit Price ($)', 'Daily Revenue ($)', 'Payback (Years)', 'ROI (%)'];
        const rows = filteredResults.map(r => {
            const m = r.miner;
            let paybackYears = 'N/A';
            if (m.calculatedPrice > 0 && m.projections) {
                let cumulative = 0;
                let foundDay = -1;
                for (const day of m.projections) {
                    cumulative += (day.dailyRevenueUSD - day.totalDailyCostUSD);
                    if (cumulative >= m.calculatedPrice) {
                        foundDay = day.dayIndex;
                        break;
                    }
                }
                if (foundDay !== -1) paybackYears = (foundDay / 365).toFixed(1);
                else paybackYears = `>${(m.projectLifeDays / 365).toFixed(0)}`;
            }
            return [
                m.name, r.score.toFixed(1), m.hashrateTH, m.powerWatts,
                (m.powerWatts / m.hashrateTH).toFixed(1), m.calculatedPrice.toFixed(0),
                m.dailyRevenueUSD.toFixed(2), paybackYears, m.clientProfitabilityPercent.toFixed(0) + '%'
            ];
        });
        // ... (csv download logic)
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `price_list_${clientName.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = async () => {
        if (!documentRef.current) return;
        try {
            const element = documentRef.current;
            // Add skipFonts to speed up and reduce errors if remote fonts fail.
            // Also increase pixelRatio for quality.
            const imgData = await toPng(element, {
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                cacheBust: true,
                skipFonts: true
            });
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const imgWidth = 210;
            const pageHeight = 297;
            const elementWidth = element.offsetWidth;
            const elementHeight = element.offsetHeight;
            const imgHeight = (elementHeight * imgWidth) / elementWidth;
            let heightLeft = imgHeight;
            let position = 0;
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            pdf.save(`proposal_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            if (confirm("PDF Generation failed. Would you like to print instead?")) window.print();
        }
    };

    if (!isReady) {
        return (
            <div className="space-y-8 p-4">
                <div className="space-y-4">
                    <Skeleton className="h-[120px] w-full rounded-lg" />
                    <Skeleton className="h-[60px] w-full rounded-lg" />
                    <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-2 md:p-4">
            {/* Controls */}
            <PriceListControls
                clientName={clientName}
                setClientName={setClientName}
                salesMargin={salesMargin}
                setSalesMargin={setSalesMargin}
                salesMarginType={salesMarginType}
                setSalesMarginType={setSalesMarginType}
                lastUpdated={lastUpdated}
                loading={loading}

                onRefresh={refreshData}
                onReset={() => {
                    if (confirm("Reset to Global Defaults?\nThis will clear your custom simulation data.")) {
                        localStorage.removeItem('LATEST_SIMULATION_DATA');
                        refreshData();
                    }
                }}
                onExportCSV={handleExportCSV}
                onDownloadPDF={handleDownloadPDF}
                userRole={userRole}
                branding={branding as any}
                setBranding={undefined}
                pdfStyle={pdfStyle}
                setPdfStyle={setPdfStyle}
            />

            {/* Filter Bar */}
            <PriceListFilterBar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOrder={sortOrder}
                toggleSortOrder={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            />

            {/* Table */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <PriceListTable miners={filteredResults} />
            </div>

            {/* Hidden PDF Template - Positioned absolute to ensure full A4 width regardless of parent container */}
            <div style={{ position: 'absolute', top: -9999, left: -9999 }}>
                <PriceListPdfTemplate
                    documentRef={documentRef}
                    clientName={clientName}
                    recommendations={recommendations}
                    filteredResults={filteredResults}
                    branding={branding as any}
                    userRole={userRole}
                    pdfImages={pdfImages} // Pass Base64 images
                    style={pdfStyle}
                />
            </div>

            <StickyActionFooter>
                <div className="flex gap-2 w-full">
                    <Button variant="outline" onClick={() => {
                        if (confirm("Reset to Global Defaults?\nThis will clear your custom simulation data.")) {
                            localStorage.removeItem('LATEST_SIMULATION_DATA');
                            refreshData();
                        }
                    }} disabled={loading} size="sm" className="flex-1">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset
                    </Button>
                    <Button variant="outline" onClick={refreshData} disabled={loading} size="sm" className="flex-1">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Refresh
                    </Button>
                    <Button onClick={handleDownloadPDF} size="sm" className="flex-1">
                        <FileText className="mr-2 h-4 w-4" />
                        PDF
                    </Button>
                </div>
            </StickyActionFooter>
        </div>
    );
}
