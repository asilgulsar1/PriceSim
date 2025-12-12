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
import { slugify } from "@/lib/slug-utils";

interface SimpleMarketMiner {
    name: string;
    stats: { middlePrice: number };
    specs: { hashrateTH: number };
}

// Robust matching helper using Hashrate + Series
function findMatchingMarketMiner(simMiner: { name: string, hashrateTH: number }, marketMiners: SimpleMarketMiner[]): number {
    const simHash = simMiner.hashrateTH;
    const simSlug = slugify(simMiner.name);

    // 0. Exact Name Match (Optimization)
    const exact = marketMiners.find(m => m.name === simMiner.name);
    if (exact && exact.stats.middlePrice > 0) return exact.stats.middlePrice;

    // Filter candidates by Hashrate Proximity (within 5% or 2 TH for small items)
    // 5% of 200 is 10. 5% of 1000 is 50.
    const candidates = marketMiners.filter(m => {
        const mHash = m.specs.hashrateTH;
        if (!mHash) return false;

        const diff = Math.abs(simHash - mHash);
        const limit = Math.max(2, simHash * 0.05);
        return diff <= limit;
    });

    if (candidates.length === 0) {
        // Fallback: If no hashrate match, maybe just name overlap? 
        // Only if fuzzy score is VERY high.
        return findBestNameMatch(simMiner.name, marketMiners);
    }

    // Among candidates (Hashrate matched), find best Name match
    // We look for critical Series Identifiers
    // e.g. "S21", "S19", "Hydro", "XP", "Pro"
    const identifiers = ["s21", "s23", "s19", "l7", "k7", "e9", "hydro", "xp", "pro", "mix", "k", "j", "plus", "+"];
    const simTokens = getTokens(simSlug, identifiers);

    let bestMatch: SimpleMarketMiner | null = null;
    let maxScore = -1;

    for (const cand of candidates) {
        const markSlug = slugify(cand.name);
        if (cand.stats.middlePrice <= 0) continue;

        const markTokens = getTokens(markSlug, identifiers);

        // Score based on matching critical identifiers
        // 1. Must match Series (S21, S23, etc)
        // 2. Bonus for XP, Pro, Hydro

        let score = 0;

        // Critical: Series Match
        // If Sim has "S23" and Cand doesn't, it's bad.
        // We iterate simplified series keys
        const seriesKeys = ["s23", "s21", "s19", "l7", "k7", "e9", "m50", "m60"];
        const simSeries = seriesKeys.find(k => simSlug.includes(k));
        const markSeries = seriesKeys.find(k => markSlug.includes(k));

        if (simSeries !== markSeries) {
            // Major mismatch (e.g. S19 vs S21 with same hashrate? Unlikely but possible)
            // Penalize heavily
            score -= 100;
        } else {
            score += 50; // Base score for series match
        }

        // Feature Match (Hydro, XP, Pro)
        const features = ["hydro", "hyd", "xp", "pro", "plus", "+"]; // normalize hyd->hydro?
        // Let's just check presence
        for (const f of features) {
            // handle hyd/hydro alias
            const simHas = hasFeature(simSlug, f);
            const markHas = hasFeature(markSlug, f);
            if (simHas === markHas) score += 10;
            else score -= 10;
        }

        if (score > maxScore) {
            maxScore = score;
            bestMatch = cand;
        }
    }

    if (bestMatch && maxScore > 0) {
        return bestMatch.stats.middlePrice;
    }

    return 0;
}

function hasFeature(slug: string, feature: string): boolean {
    if (feature === 'hyd' || feature === 'hydro') return slug.includes('hyd');
    if (feature === '+' || feature === 'plus') return slug.includes('plus') || slug.includes('s21+');
    return slug.includes(feature);
}

function getTokens(slug: string, important: string[]): string[] {
    return slug.split('-').filter(t => t.length > 0);
}

function findBestNameMatch(simName: string, marketMiners: SimpleMarketMiner[]): number {
    // Original fuzzy logic adapted for array
    const simSlug = slugify(simName);
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const simNorm = normalize(simName);

    for (const m of marketMiners) {
        const markNorm = normalize(m.name);
        if (markNorm.includes(simNorm) || simNorm.includes(markNorm)) {
            // Token check
            const simTokens = simName.toLowerCase().split(/[\s-]+/);
            const markTokens = m.name.toLowerCase().split(/[\s-]+/);
            const matches = simTokens.filter(t => markTokens.includes(t));
            const score = matches.length / Math.max(simTokens.length, markTokens.length);
            if (score > 0.8 && m.stats.middlePrice > 0) return m.stats.middlePrice;
        }
    }
    return 0;
}

export function PriceListGenerator() {
    // --- State ---
    const [clientName, setClientName] = useState('Valued Client');
    const [salesMargin, setSalesMargin] = useState<number>(0);
    const [salesMarginType, setSalesMarginType] = useState<'usd' | 'percent'>('usd');

    // Market Hook
    const { market, setMarket } = useMarketData();
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [marketDataList, setMarketDataList] = useState<SimpleMarketMiner[]>([]);

    // Results
    const [baseResults, setBaseResults] = useState<MinerScoreDetail[]>([]); // Store raw data synced from Simulator
    const [results, setResults] = useState<MinerScoreDetail[]>([]); // Displayed data (with margin)

    // Filter & Sort State
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<SortField>('score');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const documentRef = useRef<HTMLDivElement>(null);

    // --- Derived State: Apply Market Price Max Logic + Margin ---
    useEffect(() => {
        if (baseResults.length === 0) {
            setResults([]); // Clear results if baseResults is empty
            return;
        }

        const updated = baseResults.map(item => {
            const rawMiner = { ...item.miner }; // Shallow clone

            // STEP 1: Apply Max(Simulator Price, Market Middle Price) Logic
            // Get market middle price for this miner (using ROBUST matching)
            const marketMiddlePrice = findMatchingMarketMiner(rawMiner, marketDataList);

            // Debug Log
            if (marketMiddlePrice > 0) {
                console.log(`Matched ${rawMiner.name} (${rawMiner.hashrateTH}T): Sim=$${rawMiner.calculatedPrice.toFixed(0)} vs Market=$${marketMiddlePrice.toLocaleString()} -> Using $${Math.max(rawMiner.calculatedPrice, marketMiddlePrice).toLocaleString()}`);
            } else {
                console.log(`No market match for ${rawMiner.name} (${rawMiner.hashrateTH}T)`);
            }

            // Use the higher of the two prices as the base price
            const basePrice = Math.max(rawMiner.calculatedPrice, marketMiddlePrice);

            // Update to base price (before margin)
            rawMiner.calculatedPrice = basePrice;

            // STEP 2: Apply Margin on top of the base price
            let marginAmount = 0;
            if (salesMarginType === 'usd') {
                marginAmount = salesMargin;
            } else {
                marginAmount = rawMiner.calculatedPrice * (salesMargin / 100);
            }

            rawMiner.calculatedPrice = rawMiner.calculatedPrice + marginAmount;

            // STEP 3: Recalculate ROI (Client Profitability)
            const totalRevenue = rawMiner.dailyRevenueUSD * rawMiner.projectLifeDays;
            const totalCost = rawMiner.dailyExpenseUSD * rawMiner.projectLifeDays;
            const netOperatingProfit = totalRevenue - totalCost;

            // Gross Annualized Revenue ROI (Used for Sorting & Scoring)
            if (rawMiner.calculatedPrice > 0 && rawMiner.dailyRevenueUSD > 0) {
                rawMiner.clientProfitabilityPercent = ((rawMiner.dailyRevenueUSD * 365) / rawMiner.calculatedPrice) * 100;
            } else {
                rawMiner.clientProfitabilityPercent = 0;
            }

            return {
                ...item,
                miner: rawMiner
            };
        });

        // Re-Rank miners with updated prices
        const minersOnly = updated.map(u => u.miner);
        const reRanked = rankMiners(minersOnly);
        setResults(reRanked);

    }, [baseResults, salesMargin, salesMarginType, marketDataList]);


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

                    // Fetch market prices
                    await fetchMarketPrices();

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

                    // Fetch market prices
                    await fetchMarketPrices();

                    setLoading(false);
                    return;
                }
            }
        } catch (e) {
            console.warn("Failed to fetch cached data, falling back to local calculation", e);
        }

        // 3. Last Resort: Local
        calculateLocal();

        // Still try to fetch market prices even for local calculation
        await fetchMarketPrices();
    };

    const fetchMarketPrices = async () => {
        try {
            console.log("Fetching market prices from API...");
            const res = await fetch('/api/market/latest', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data.miners && Array.isArray(data.miners)) {
                    // Build list of market miners
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
                    console.log(`Loaded market prices for ${list.length} miners (Hashrate Logic Active)`);
                    console.log("Market Miners loaded sample:", list.slice(0, 3));
                }
            } else {
                console.warn("Market API response not OK:", res.status);
            }
        } catch (e) {
            console.warn("Failed to fetch market prices", e);
        }
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
