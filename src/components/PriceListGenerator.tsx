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

export function PriceListGenerator() {
    // --- State ---
    const [clientName, setClientName] = useState('Valued Client');
    const [salesMargin, setSalesMargin] = useState<number>(0);
    const [salesMarginType, setSalesMarginType] = useState<'usd' | 'percent'>('usd');

    // Market Hook
    const { market, setMarket } = useMarketData();
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    // Results
    const [baseResults, setBaseResults] = useState<MinerScoreDetail[]>([]); // Store raw data synced from Simulator
    const [results, setResults] = useState<MinerScoreDetail[]>([]); // Displayed data (with margin)

    // Filter & Sort State
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<SortField>('score');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const documentRef = useRef<HTMLDivElement>(null);

    // --- Derived State: Apply Margin ---
    useEffect(() => {
        if (baseResults.length === 0) {
            setResults([]); // Clear results if baseResults is empty
            return;
        }

        const updated = baseResults.map(item => {
            const rawMiner = { ...item.miner }; // Shallow clone

            // Apply Margin
            // Base Price comes from Simulator. We add margin to it.
            let marginAmount = 0;
            if (salesMarginType === 'usd') {
                marginAmount = salesMargin;
            } else {
                marginAmount = rawMiner.calculatedPrice * (salesMargin / 100);
            }

            rawMiner.calculatedPrice = rawMiner.calculatedPrice + marginAmount;

            // Recalculate ROI (Client Profitability)
            // Original ROI = (NetProfit / Price) ? or (NetProfit - Price) / Price?
            // Need to know how `clientProfitabilityPercent` was calculated.
            // In pricing-solver.ts check: clientProfitabilityPercent usually (TotalRevenue - TotalCost - Price) / Price * 100?
            // Or simple ROI = (Total Revenue - Total Cost) / Price?
            // Let's approximate based on typical logic:
            // NetProfit (Lifetime) = dailyProfit * days.
            // ROI = (NetProfit - Price) / Price. 
            // We have `totalRevenueUSD` and `totalCostUSD` in specific fields if they were preserved?
            // The `CalculatedMiner` has `dailyRevenueUSD`, `dailyExpenseUSD`, `projectLifeDays`.
            // Let's recalculate based on these.

            const totalRevenue = rawMiner.dailyRevenueUSD * rawMiner.projectLifeDays;
            const totalCost = rawMiner.dailyExpenseUSD * rawMiner.projectLifeDays;
            const netOperatingProfit = totalRevenue - totalCost;

            // Gross Annualized Revenue ROI (Used for Sorting & Scoring)
            if (rawMiner.calculatedPrice > 0 && rawMiner.dailyRevenueUSD > 0) {
                rawMiner.clientProfitabilityPercent = ((rawMiner.dailyRevenueUSD * 365) / rawMiner.calculatedPrice) * 100;
            } else {
                rawMiner.clientProfitabilityPercent = 0;
            }

            // We need to recreate the Score Detail wrapper
            // rankMiners might need to re-run if score depends on price?
            // For simple display updates, we can just update the miner object.
            return {
                ...item,
                miner: rawMiner
            };
        });

        // Re-Rank if needed?
        // rankMiners calc score based on ROI, Price, etc.
        // It's safer to re-rank.
        // But `updated` is `MinerScoreDetail[]`. rankMiners takes `CalculatedMiner[]`.
        // Let's extract miners and re-rank.
        const minersOnly = updated.map(u => u.miner);
        const reRanked = rankMiners(minersOnly);
        // Ranker now uses the pre-calculated Gross ROI
        setResults(reRanked);

    }, [baseResults, salesMargin, salesMarginType]);


    // --- Derived State ---
    const filteredResults = React.useMemo(() => {
        return results
            .filter(r => r.miner.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                let valA = 0, valB = 0;
                const direction = sortOrder === 'asc' ? 1 : -1;

                switch (sortBy) {
                    case 'score': valA = a.score; valB = b.score; break;
                    case 'price': valA = a.miner.calculatedPrice; valB = b.miner.calculatedPrice; break;
                    case 'roi': valA = a.miner.clientProfitabilityPercent; valB = b.miner.clientProfitabilityPercent; break;
                    case 'payback':
                        const getPaybackDays = (m: any) => {
                            if (m.calculatedPrice <= 0) return 0;
                            let cumulative = 0;
                            if (m.projections) {
                                for (const day of m.projections) {
                                    cumulative += (day.dailyRevenueUSD - day.totalDailyCostUSD);
                                    if (cumulative >= m.calculatedPrice) return day.dayIndex;
                                }
                            }
                            return 99999; // Never pays back
                        };
                        valA = getPaybackDays(a.miner);
                        valB = getPaybackDays(b.miner);
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
        const byEff = [...results].sort((a, b) => a.raw.efficiency - b.raw.efficiency).slice(0, 2); // Lower eff is better usually, but logic in scoring might have inverted standard? 
        // In scoring, efficiencyScore is higher for lower J/TH. 
        // But raw efficiency is J/TH. So sorting asc is correct for "Best Efficiency" (lowest J/TH).
        // Let's verify sort logic from original:
        // `byEff = [...results].sort((a, b) => a.raw.efficiency - b.raw.efficiency)` -> Ascending (Lower is better). Correct.
        return { topROI: byROI, topRevenue: byRev, topEfficiency: byEff };
    }, [results]);


    // --- Effects ---

    // --- Effects ---

    // --- Effects ---

    // Auto-load removed. Data is fetched only when 'Fresh Data' is clicked.


    // ... (rest of effects) // Initial load only, refreshData depends on nothing reactive (except calculateLocal which is stable?) NO.
    // refreshData depends on calculateLocal.
    // But we only want to run ONCE on mount.
    // So [] is fine, but linter will complain.
    // Actually, refreshData changes if calculateLocal changes.
    // And calculateLocal changes if market/margin changes.
    // So this effect will re-run constantly if we include it.
    // We want "On Mount".
    // So let's disable the exhaustive-deps rule for this line or keep it empty.


    // Trigger local calc when Margin changes
    // Local auto-calc removed to prioritize Sync flow
    // useEffect(() => { if (!loading && results.length > 0) calculateLocal(); }, [marginValue]);

    // --- Actions ---

    const calculateLocal = React.useCallback(() => {
        setLoading(true);
        // Small timeout for UI
        setTimeout(() => {
            const miners = INITIAL_MINERS;
            const calculated = miners.map(miner => {
                const contract: ContractTerms = DEFAULT_CONTRACT_TERMS;
                // Note: marginValue is gone. What to use? Default 50?
                return solveMinerPrice(miner, contract, market, DEFAULT_TARGET_MARGIN, false);
            });

            const ranked = rankMiners(calculated);
            setBaseResults(ranked); // Update Base
            setLastUpdated('Calculated Locally (Live)');
            setLoading(false);
        }, 50);
    }, [market]); // Removed marginValue from deps, as it's now handled by the margin effect

    const refreshData = async () => {
        setLoading(true);

        // Helper to normalize input data (unwrap if it's already ranked/wrapped)
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
                    // Set BASE Results (Raw)
                    const rawMiners = normalizeMiners(data.miners);
                    const ranked = rankMiners(rawMiners);
                    setBaseResults(ranked);

                    if (data.updatedAt) setLastUpdated(`Synced from Simulator (${new Date(data.updatedAt).toLocaleTimeString()})`);
                    if (data.market) setMarket(data.market);
                    setLoading(false);
                    return;
                }
            }
        } catch (e) {
            console.warn("Failed to fetch simulator data", e);
        }

        // 2. Fallback: API or Local
        // Use existing API fallback logic if local storage empty
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
                    setLoading(false);
                    return;
                }
            }
        } catch (e) {
            console.warn("Failed to fetch cached data, falling back to local calculation", e);
        }

        // 3. Last Resort: Local
        calculateLocal();
    };
    const handleExportCSV = () => {
        const headers = ['Model', 'Score', 'Hashrate (TH/s)', 'Power (W)', 'Efficiency (J/TH)', 'Unit Price ($)', 'Daily Revenue ($)', 'Payback (Years)', 'ROI (%)'];
        const rows = filteredResults.map(r => {
            const m = r.miner;
            let paybackYears = 'N/A';

            // Dynamic Payback Calculation
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
                if (foundDay !== -1) {
                    paybackYears = (foundDay / 365).toFixed(1);
                } else {
                    paybackYears = `>${(m.projectLifeDays / 365).toFixed(0)}`;
                }
            }

            return [
                m.name,
                r.score.toFixed(1),
                m.hashrateTH,
                m.powerWatts,
                (m.powerWatts / m.hashrateTH).toFixed(1),
                m.calculatedPrice.toFixed(0),
                m.dailyRevenueUSD.toFixed(2),
                paybackYears,
                m.clientProfitabilityPercent.toFixed(0) + '%'
            ]
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
            const imgData = await toPng(element, { backgroundColor: '#ffffff', pixelRatio: 2 });

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
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
            if (confirm("PDF Generation failed. Would you like to print instead?")) {
                window.print();
            }
        }
    };

    return (
        <div className="space-y-8 p-4">
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
                onExportCSV={handleExportCSV}
                onDownloadPDF={handleDownloadPDF}
            />

            <PriceListFilterBar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOrder={sortOrder}
                toggleSortOrder={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            />

            <PriceListTable miners={filteredResults} />

            <PriceListPdfTemplate
                documentRef={documentRef}
                clientName={clientName}
                recommendations={recommendations}
                filteredResults={filteredResults}
            />
        </div>
    );
}
