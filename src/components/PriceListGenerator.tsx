"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';
import { solveMinerPrice } from "@/lib/pricing-solver";
// import { INITIAL_MINERS } from "@/lib/miner-data"; // Removed
import { ContractTerms } from "@/lib/price-simulator-calculator";
import { rankMiners, MinerScoreDetail } from "@/lib/miner-scoring";
import { DEFAULT_CONTRACT_TERMS, DEFAULT_TARGET_MARGIN } from "@/lib/constants";
import { useMarketData } from "@/hooks/useMarketData";
import { useMiners } from "@/hooks/useMiners";

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

export function PriceListGenerator({ userRole, resellerMargin, branding }: PriceListGeneratorProps) {
    // --- State ---
    const [clientName, setClientName] = useState('Valued Client');
    const [salesMargin, setSalesMargin] = useState<number>(0);
    const [salesMarginType, setSalesMarginType] = useState<'usd' | 'percent'>('usd');
    const [pdfStyle, setPdfStyle] = useState<string>('default');

    // Market Hook
    const { market, setMarket } = useMarketData();
    // Miner Hook
    const { miners, loading: minersLoading, refresh: refreshMiners } = useMiners();

    const [loading, setLoading] = useState(true); // Start loading
    const [isReady, setIsReady] = useState(false); // Prevents flicker
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [marketDataList, setMarketDataList] = useState<SimpleMarketMiner[]>([]);

    // PDF Images State (Base64)
    const [pdfImages, setPdfImages] = useState<{ logo: string }>({ logo: "" });

    // Results
    const [baseResults, setBaseResults] = useState<MinerScoreDetail[]>([]);

    // Filter & Sort
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<SortField>('score');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // Default asc? previously desc
    const documentRef = useRef<HTMLDivElement>(null);

    // --- Helpers ---
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
                                specs: { hashrateTH: miner.specs?.hashrateTH || 0 },
                                source: miner.source // Capture source from API
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

    const processMiners = useCallback((minersToProcess: any[], source: string) => {
        const contract: ContractTerms = DEFAULT_CONTRACT_TERMS;
        const calculated = minersToProcess.map(miner => {
            return solveMinerPrice(miner, contract, market, DEFAULT_TARGET_MARGIN, false);
        });
        const ranked = rankMiners(calculated);
        setBaseResults(ranked);
        setLastUpdated(source);
        setIsReady(true);
        setLoading(false);
    }, [market]);

    const refreshData = async () => {
        setLoading(true);
        setIsReady(false);

        // 1. Try to fetch LATEST from Price Simulator (LocalStorage)
        try {
            const savedSim = localStorage.getItem('LATEST_SIMULATION_DATA');
            if (savedSim) {
                const data = JSON.parse(savedSim);
                if (data.miners && Array.isArray(data.miners)) {
                    const rawMiners = data.miners.length > 0 && data.miners[0].miner
                        ? data.miners.map((x: any) => x.miner)
                        : data.miners;

                    const ranked = rankMiners(rawMiners);
                    setBaseResults(ranked);
                    if (data.updatedAt) setLastUpdated(`Synced from Simulator (${new Date(data.updatedAt).toLocaleTimeString()})`);
                    if (data.market) setMarket(data.market);

                    await fetchMarketPrices();
                    setLoading(false);
                    setIsReady(true);
                    return;
                }
            }
        } catch (e) {
            console.warn("Failed to fetch simulator data", e);
        }

        // 2. Default: Use Miners from Hook (Live Market Source)
        await refreshMiners();
        await fetchMarketPrices();

        // Ensure processing happens even if miners reference didn't change
        if (miners.length > 0) {
            processMiners(miners, 'Live Market Data');
        } else {
            setLoading(false);
            setIsReady(true);
        }
    };

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

    // 2. React to hook loading
    useEffect(() => {
        if (!minersLoading && miners.length > 0 && !loading) {
            // Check if we are using LocalStorage override (Manual Sim)
            const savedSim = localStorage.getItem('LATEST_SIMULATION_DATA');
            if (!savedSim) {
                processMiners(miners, 'Live Market Data');
            }
        }
    }, [miners, minersLoading, loading, processMiners]);

    // 3. Initial Load
    useEffect(() => {
        refreshData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Derived State ---
    const results = useMemo(() => {
        if (baseResults.length === 0) return [];

        let liveHashpriceUSD = 0;
        if (market.networkDifficulty > 0 && market.btcPrice > 0) {
            liveHashpriceUSD = calculateHashpriceUSD(market.networkDifficulty, market.blockReward, market.btcPrice);
            const updated = baseResults.map(item => {
                const rawMiner = { ...item.miner };

                // FIX 1: UPDATE REVENUE WITH LIVE MARKET DATA
                if (liveHashpriceUSD > 0) {
                    const poolFee = DEFAULT_CONTRACT_TERMS.poolFee || 1.0;
                    rawMiner.dailyRevenueUSD = calculateMinerRevenueUSD(rawMiner.hashrateTH, liveHashpriceUSD, poolFee);
                }

                // STEP 1: Apply Max(Simulator Price, Market Middle Price) Logic
                const { price: marketMiddlePrice, source: marketSource } = findMatchingMarketMiner(rawMiner, marketDataList);
                let basePrice = Math.max(rawMiner.calculatedPrice, marketMiddlePrice);

                // Store source for UI display
                if (marketSource) {
                    (rawMiner as any).priceSource = marketSource;
                }

                // RESELLER MARKUP LOGIC
                if (userRole === 'reseller') {
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
            const { price: marketMiddlePrice, source: marketSource } = findMatchingMarketMiner(rawMiner, marketDataList);
            let basePrice = Math.max(rawMiner.calculatedPrice, marketMiddlePrice);

            // Store source for UI display
            if (marketSource) {
                (rawMiner as any).priceSource = marketSource;
            }

            // RESELLER MARKUP LOGIC
            if (userRole === 'reseller') {
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

    const filteredResults = useMemo(() => {
        return results
            .filter(r => r.miner.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                const direction = sortOrder === 'asc' ? 1 : -1;
                if (sortBy === 'score') return (a.score - b.score) * direction;
                if (sortBy === 'price') return (a.miner.calculatedPrice - b.miner.calculatedPrice) * direction;
                if (sortBy === 'roi') return (a.miner.clientProfitabilityPercent - b.miner.clientProfitabilityPercent) * direction;
                if (sortBy === 'revenue') return (a.miner.dailyRevenueUSD - b.miner.dailyRevenueUSD) * direction;
                if (sortBy === 'efficiency') return ((a.miner.powerWatts / a.miner.hashrateTH) - (b.miner.powerWatts / b.miner.hashrateTH)) * direction;

                // Payback (Inverse of ROI approx)
                if (sortBy === 'payback') {
                    const pbA = a.miner.clientProfitabilityPercent > 0 ? 36500 / a.miner.clientProfitabilityPercent : 99999;
                    const pbB = b.miner.clientProfitabilityPercent > 0 ? 36500 / b.miner.clientProfitabilityPercent : 99999;
                    return (pbA - pbB) * direction;
                }

                return 0;
            });
    }, [results, searchTerm, sortBy, sortOrder]);

    const recommendations = useMemo(() => {
        if (results.length === 0) return { topROI: [], topRevenue: [], topEfficiency: [] };

        const byROI = [...results].sort((a, b) => b.miner.clientProfitabilityPercent - a.miner.clientProfitabilityPercent).slice(0, 2);
        const byRev = [...results].sort((a, b) => b.miner.dailyRevenueUSD - a.miner.dailyRevenueUSD).slice(0, 2);
        const byEff = [...results].sort((a, b) => (a.miner.powerWatts / a.miner.hashrateTH) - (b.miner.powerWatts / b.miner.hashrateTH)).slice(0, 2);
        return { topROI: byROI, topRevenue: byRev, topEfficiency: byEff };
    }, [results]);

    // --- Handlers ---
    const handleExportCSV = () => {
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
            const imgData = await toJpeg(element, {
                backgroundColor: '#ffffff',
                pixelRatio: 1.5,
                quality: 0.8,
                cacheBust: true,
                skipFonts: true
            });

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

            const imgWidth = 210;
            const pageHeight = 297;
            const elementWidth = element.offsetWidth;
            const elementHeight = element.offsetHeight;
            const imgHeight = (elementHeight * imgWidth) / elementWidth;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
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

            {/* Hidden PDF Template */}
            <div style={{ position: 'absolute', top: -9999, left: -9999 }}>
                <PriceListPdfTemplate
                    documentRef={documentRef}
                    clientName={clientName}
                    recommendations={recommendations}
                    filteredResults={filteredResults}
                    branding={branding as any}
                    userRole={userRole}
                    pdfImages={pdfImages}
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
