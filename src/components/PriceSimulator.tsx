/*
 * 🔒 LOCKED LOGIC 🔒
 * This component's calculation logic and field mappings are finalized.
 * 
 * PASSWORD REQUIRED FOR EDITS: "Pricesim"
 * 
 * Do not modify this file unless the user explicitly provides the password "Pricesim" in the prompt.
 */
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Calculator, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PriceSimulatorCalculator, MinerProfile, ContractTerms, MarketConditions, SimulationConfig, DailyProjection } from '@/lib/price-simulator-calculator';
import { fetchMarketData } from "@/lib/api";

// Hardcoded Miner List
const INITIAL_MINERS: MinerProfile[] = [
    // Antminer S23 Series
    { name: 'Antminer S23 Hydro', hashrateTH: 580, powerWatts: 5510, price: 0 },
    { name: 'Antminer S23 Immersion', hashrateTH: 442, powerWatts: 4862, price: 0 },
    { name: 'Antminer S23', hashrateTH: 318, powerWatts: 3498, price: 0 },

    // Antminer S21 Series
    { name: 'Antminer S21 XP Hydro', hashrateTH: 473, powerWatts: 5676, price: 0 },
    { name: 'Antminer S21 XP Immersion', hashrateTH: 380, powerWatts: 5700, price: 0 },
    { name: 'Antminer S21 XP', hashrateTH: 270, powerWatts: 3645, price: 0 },
    { name: 'Antminer S21 Hydro', hashrateTH: 335, powerWatts: 5360, price: 0 },
    { name: 'Antminer S21 Immersion', hashrateTH: 300, powerWatts: 4800, price: 0 },
    { name: 'Antminer S21 Pro', hashrateTH: 234, powerWatts: 3510, price: 0 },

    // Whatsminer M70 Series
    { name: 'Whatsminer M73 Hydro', hashrateTH: 526, powerWatts: 7627, price: 0 },
    { name: 'Whatsminer M76 Immersion', hashrateTH: 374, powerWatts: 5423, price: 0 },
    { name: 'Whatsminer M70S', hashrateTH: 258, powerWatts: 3483, price: 0 },

    // Whatsminer M60 Series
    { name: 'Whatsminer M60S', hashrateTH: 186, powerWatts: 3441, price: 0 },
    { name: 'Whatsminer M60', hashrateTH: 170, powerWatts: 3400, price: 0 },

    // Antminer S19 Series
    { name: 'Antminer S19 XP Hydro', hashrateTH: 255, powerWatts: 5304, price: 0 },
    { name: 'Antminer S19 XP', hashrateTH: 140, powerWatts: 3010, price: 0 },
];

interface CalculatedMiner extends MinerProfile {
    calculatedPrice: number;
    projectLifeDays: number;
    totalRevenueUSD: number;
    totalCostUSD: number;
    estExpenseBTC: number;
    estRevenueHostingBTC: number;
    finalTreasuryBTC: number;
    finalTreasuryUSD: number;
    projections: DailyProjection[];
    roiPercent: number;
    targetMet: boolean;
}

export function PriceSimulator() {
    // Inputs
    const [targetProfitPercent, setTargetProfitPercent] = useState(50);
    const [isBtcTarget, setIsBtcTarget] = useState(false);

    const [market, setMarket] = useState<MarketConditions>({
        btcPrice: 92817, // Use market-based default (matches Treasury)
        networkDifficulty: 109000000000000, // Use market-based default (matches Treasury)
        blockReward: 3.125,
        difficultyGrowthMonthly: 4.0,
        btcPriceGrowthMonthly: 2.5, // ~34.5% annual
        btcPriceGrowthAnnual: 5.0, // Keep for compatibility
        nextHalvingDate: new Date('2028-05-01')
    });

    const [hostingRate, setHostingRate] = useState(0.06); // All-in rate
    const [durationYears, setDurationYears] = useState(5);

    const [miners, setMiners] = useState<MinerProfile[]>(INITIAL_MINERS);
    const [results, setResults] = useState<CalculatedMiner[]>([]);
    const [loading, setLoading] = useState(false);
    const [marketDataLoaded, setMarketDataLoaded] = useState(false);

    // Load custom miners from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('custom_miners');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    // Combine initial miners with saved custom miners
                    setMiners([...INITIAL_MINERS, ...parsed]);
                }
            } catch (e) {
                console.error("Failed to load custom miners", e);
            }
        }
    }, []);

    // Custom Miner State
    const [newMiner, setNewMiner] = useState({ name: '', hashrate: '', power: '' });
    const [showAddMiner, setShowAddMiner] = useState(false);

    const addCustomMiner = () => {
        if (!newMiner.name || !newMiner.hashrate || !newMiner.power) return;
        const miner: MinerProfile = {
            name: newMiner.name,
            hashrateTH: Number(newMiner.hashrate),
            powerWatts: Number(newMiner.power),
            price: 0
        };

        // Update State
        setMiners(prev => [...prev, miner]);

        // Persist to LocalStorage
        try {
            const saved = localStorage.getItem('custom_miners');
            let currentCustom: MinerProfile[] = [];
            if (saved) {
                currentCustom = JSON.parse(saved);
            }
            const updatedCustom = [...currentCustom, miner];
            localStorage.setItem('custom_miners', JSON.stringify(updatedCustom));
        } catch (e) {
            console.error("Failed to save custom miner", e);
        }

        setNewMiner({ name: '', hashrate: '', power: '' });
        setShowAddMiner(false);
    };

    // Fetch Market Data
    useEffect(() => {
        async function loadData() {
            try {
                const data = await fetchMarketData();
                setMarket(prev => ({
                    ...prev,
                    btcPrice: data.btcPrice,
                    networkDifficulty: data.networkDifficulty
                }));
                setMarketDataLoaded(true);
            } catch (e) {
                console.error("Failed to load market data", e);
                // Still set to loaded even on error to prevent infinite waiting
                setMarketDataLoaded(true);
            }
        }
        loadData();
    }, []);

    const exportToCSV = (minerName: string, projections: DailyProjection[]) => {
        // Define CSV headers
        const headers = [
            'Day',
            'Date',
            'BTC Price',
            'Difficulty',
            'Production (BTC)',
            'Production ($)',
            'Hosting ($)',
            'Net Profit ($)',
            'BTC Held',
            'BTC Price Gain ($)',
            'Net Treasury Change (BTC)',
            'Net Treasury Change ($)',
            'Cash Balance ($)',
            'Portfolio Value ($)'
        ];

        // Build CSV rows
        const rows = projections.map((day, j) => {
            // Calculate BTC price gain from previous day
            const prevDay = j > 0 ? projections[j - 1] : null;
            const btcPriceGainUSD = prevDay && !day.isShutdown
                ? prevDay.btcHeld * (day.btcPrice - prevDay.btcPrice)
                : 0;

            // Calculate net treasury change in BTC
            const hostingFeeBTC = day.totalDailyCostUSD / day.btcPrice;
            const priceGainBTC = btcPriceGainUSD / (day.btcPrice || 1);
            const netTreasuryChangeBTC = !day.isShutdown
                ? hostingFeeBTC - day.netProductionBTC + priceGainBTC
                : 0;

            const netTreasuryChangeUSD = netTreasuryChangeBTC * day.btcPrice;

            return [
                day.dayIndex + 1,
                new Date(day.date).toLocaleDateString(),
                day.btcPrice.toFixed(2),
                (day.difficulty / 1e12).toFixed(2),
                day.netProductionBTC.toFixed(6),
                day.dailyRevenueUSD.toFixed(2),
                day.totalDailyCostUSD.toFixed(2),
                day.dailyProfitUSD.toFixed(2),
                day.btcHeld.toFixed(6),
                btcPriceGainUSD.toFixed(2),
                netTreasuryChangeBTC.toFixed(6),
                netTreasuryChangeUSD.toFixed(2),
                day.cashBalance.toFixed(2),
                day.portfolioValueUSD.toFixed(2)
            ].join(',');
        });

        // Combine headers and rows
        const csvContent = [headers.join(','), ...rows].join('\n');

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${minerName}_daily_logs.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const calculatePrices = () => {
        setLoading(true);
        setTimeout(() => {
            const calculated = miners.map(miner => {
                const contract: ContractTerms = {
                    electricityRate: hostingRate,
                    opexRate: 0, // Assuming all-in hosting rate
                    poolFee: 1.0,
                    contractDurationYears: durationYears
                };

                // PASS 1: Run Simulation with Miner Price (Hardware Cost)
                // This is just to get the production metrics (M) and Hosting Cost metrics (H_btc)
                // These metrics don't depend on the investment amount
                const configPass1: SimulationConfig = {
                    startDate: new Date(),
                    initialInvestment: miner.price,
                    reinvestMode: 'hold'
                };

                const resPass1 = PriceSimulatorCalculator.calculate(miner, contract, market, configPass1);

                const totalRevenueUSD = resPass1.summary.totalRevenueUSD;
                const totalCostUSD = resPass1.summary.totalCostUSD;
                const totalProductionBTC = resPass1.summary.totalProductionBTC;

                // Calculate Metrics
                const M = totalProductionBTC;

                // Calculate H_btc (Sum of daily hosting / daily price)
                let H_btc_sum = 0;
                resPass1.projections.forEach(day => {
                    if (!day.isShutdown) {
                        H_btc_sum += day.totalDailyCostUSD / day.btcPrice;
                    }
                });

                const estExpenseBTC = M;
                const estRevenueHostingBTC = H_btc_sum;

                // Calculate Sales Price (X)
                const targetMargin = targetProfitPercent / 100;
                let calculatedPrice = 0;

                if (isBtcTarget) {
                    // BTC Basis Calculation
                    if (targetMargin >= 1) {
                        calculatedPrice = 0;
                    } else {
                        // Formula: Price = (Revenue - Cost) / (1 - TargetMargin)
                        // Derivation: Price * (1 - T) = Revenue - Cost
                        const P_btc = (M - H_btc_sum) / (1 - targetMargin);
                        console.log(`[Miner: ${miner.name}] Calculated P_btc: ${P_btc} | M=${M}, H=${H_btc_sum}, T=${targetMargin}`);
                        calculatedPrice = P_btc * market.btcPrice;
                    }
                } else {
                    // USD Basis Calculation with BTC Appreciation
                    // With BTC tracking: FinalUSD = [(Price/InitialBTC) + NetBTCFlow] × FinalBTC
                    // Target: FinalUSD = Price × TargetMargin

                    // Get shutdown point
                    const shutdownDay = resPass1.projections.find(p => p.isShutdown) || resPass1.projections[resPass1.projections.length - 1];
                    const finalBtcPrice = shutdownDay.btcPrice;
                    const initialBtcPrice = market.btcPrice;

                    // Calculate net BTC flow from Pass 1
                    // This is independent of the initial investment amount
                    let netBtcFlow = 0;
                    resPass1.projections.forEach(day => {
                        if (!day.isShutdown) {
                            const hostingFeeBTC = day.totalDailyCostUSD / day.btcPrice;
                            netBtcFlow += (hostingFeeBTC - day.netProductionBTC);
                        }
                    });

                    if (targetMargin >= 1) {
                        calculatedPrice = 0;
                    } else {
                        // Equation: [(P / initialBtcPrice) + netBtcFlow] × finalBtcPrice = P × targetMargin
                        // Expand: (P × finalBtcPrice / initialBtcPrice) + (netBtcFlow × finalBtcPrice) = P × targetMargin
                        // Rearrange: P × (finalBtcPrice / initialBtcPrice - targetMargin) = -netBtcFlow × finalBtcPrice
                        // Solve: P = (-netBtcFlow × finalBtcPrice) / (finalBtcPrice / initialBtcPrice - targetMargin)

                        const priceRatio = finalBtcPrice / initialBtcPrice;
                        const denominator = priceRatio - targetMargin;

                        if (Math.abs(denominator) < 0.001) {
                            // BTC appreciation approximately equals target margin - edge case
                            calculatedPrice = 0;
                            console.warn(`[${miner.name}] BTC appreciation (${(priceRatio * 100).toFixed(1)}%) ≈ target (${(targetMargin * 100)}%) - cannot calculate price`);
                        } else {
                            calculatedPrice = (-netBtcFlow * finalBtcPrice) / denominator;
                            console.log(`[${miner.name}] Price=${calculatedPrice.toFixed(0)} | NetBTC=${netBtcFlow.toFixed(6)}, InitBTC=$${initialBtcPrice.toFixed(0)}, FinalBTC=$${finalBtcPrice.toFixed(0)}, Ratio=${priceRatio.toFixed(2)}x`);
                        }
                    }
                }

                // Arithmetic Check: Ensure Price is not NaN or Infinite
                if (!isFinite(calculatedPrice) || isNaN(calculatedPrice)) {
                    console.error(`[Miner: ${miner.name}] Error: Calculated price is NaN or Infinite`);
                    calculatedPrice = 0;
                }

                // PASS 2: Re-run with Calculated Price as Initial Investment
                const configPass2: SimulationConfig = {
                    startDate: new Date(),
                    initialInvestment: calculatedPrice > 0 ? calculatedPrice : miner.price, // Use miner price if neg for fallback
                    reinvestMode: 'hold'
                };

                const resFinal = PriceSimulatorCalculator.calculate(miner, contract, market, configPass2);

                // Calculate Final Treasury Balances based on FINAL simulation
                let finalTreasuryBTC = 0;
                let finalTreasuryUSD = 0;

                if (calculatedPrice > 0) {
                    // Calculate final treasury from the actual simulation results
                    // The simulation now tracks treasury correctly starting from Sales Price
                    // We use the SHUTDOWN date (or end of contract) to show the result of the "Mining Project"
                    // Otherwise post-shutdown HODL appreciation skews the result (e.g. BTC goes to $400k in year 5)

                    let targetDay = resFinal.projections[resFinal.projections.length - 1];

                    // Find the last active mining day or the shutdown day
                    const shutdownDay = resFinal.projections.find(p => p.isShutdown);
                    if (shutdownDay) {
                        // Use the last day allowed before pure HODL phase? 
                        // Actually, if we want "Project Result", it's the state at Shutdown.
                        // But 'shutdownDay' is the first day OF shutdown (production 0).
                        // So we want the day BEFORE shutdown? Or just that day (value is same, just no prod).
                        targetDay = shutdownDay;
                    }


                    finalTreasuryBTC = targetDay.btcHeld;
                    finalTreasuryUSD = targetDay.portfolioValueUSD;

                    console.log(`[Miner: ${miner.name}] Final Treasury BTC Debug: TargetDayIndex=${targetDay.dayIndex}, isShutdown=${targetDay.isShutdown}, btcHeld=${targetDay.btcHeld}, cashBalance=${targetDay.cashBalance}, btcPrice=${targetDay.btcPrice}`);


                    // VERIFICATION CHECK: Final Treasury should match Target Profit % of Initial Treasury
                    const initialTreasuryUSD = calculatedPrice; // Since we start with sales price
                    const expectedFinalUSD = initialTreasuryUSD * targetMargin;
                    const diffPercent = Math.abs((finalTreasuryUSD - expectedFinalUSD) / expectedFinalUSD) * 100;

                    // Allow deviation due to discrete steps and H/M variations
                    if (diffPercent > 5.0) {
                        console.warn(`[Verification Warning] Final Treasury deviation > 5%. Expected: $${expectedFinalUSD.toFixed(0)}, Actual: $${finalTreasuryUSD.toFixed(0)}`);
                    } else {
                        console.log(`[Verification Passed] Final Treasury matches Target Profit (${targetProfitPercent}%) within ${diffPercent.toFixed(2)}%`);
                    }
                }

                return {
                    ...miner,
                    calculatedPrice,
                    projectLifeDays: resFinal.summary.totalDays,
                    totalRevenueUSD,
                    totalCostUSD,
                    estExpenseBTC,
                    estRevenueHostingBTC,
                    finalTreasuryBTC,
                    finalTreasuryUSD,
                    projections: resFinal.projections, // Use projections from Pass 2
                    roiPercent: targetProfitPercent,
                    targetMet: calculatedPrice > 0
                };
            });

            setResults(calculated);
            setLoading(false);
        }, 100);
    };

    // Auto-calc on load/change
    useEffect(() => {
        // Only auto-calculate after market data has been loaded
        if (marketDataLoaded) {
            calculatePrices();
        }
    }, [
        marketDataLoaded,
        market.btcPrice,
        market.networkDifficulty,
        market.blockReward,
        market.difficultyGrowthMonthly,
        market.btcPriceGrowthMonthly,
        miners,
        targetProfitPercent,
        isBtcTarget,
        hostingRate,
        durationYears
    ]); // Auto-run when ANY parameter changes

    return (
        <div className="space-y-6">
            {/* Controls */}
            <Card>
                <CardHeader>
                    <CardTitle>Simulation Parameters</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <Label>Target Net Profit (%)</Label>
                        <Input
                            type="number"
                            value={targetProfitPercent}
                            onChange={e => setTargetProfitPercent(Number(e.target.value))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Profit Target Base</Label>
                        <div className="flex items-center space-x-2 h-10">
                            <Label htmlFor="target-mode">USD</Label>
                            <Switch
                                id="target-mode"
                                checked={isBtcTarget}
                                onCheckedChange={setIsBtcTarget}
                            />
                            <Label htmlFor="target-mode">BTC</Label>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Hosting Rate ($/kWh)</Label>
                        <Input
                            type="number" step="0.01"
                            value={hostingRate}
                            onChange={e => setHostingRate(Number(e.target.value))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Max Duration (Years)</Label>
                        <Input
                            type="number"
                            value={durationYears}
                            max={10}
                            onChange={e => setDurationYears(Number(e.target.value))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>BTC Price ($)</Label>
                        <Input
                            type="number"
                            value={market.btcPrice}
                            onChange={e => setMarket({ ...market, btcPrice: Number(e.target.value) })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Network Difficulty</Label>
                        <Input
                            type="number"
                            value={market.networkDifficulty}
                            onChange={e => setMarket({ ...market, networkDifficulty: Number(e.target.value) })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Diff Growth (%/mo)</Label>
                        <Input
                            type="number" step="0.1"
                            value={market.difficultyGrowthMonthly}
                            onChange={e => setMarket({ ...market, difficultyGrowthMonthly: Number(e.target.value) })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Price Growth (%/mo)</Label>
                        <Input
                            type="number" step="0.1"
                            value={market.btcPriceGrowthMonthly || 0}
                            onChange={e => setMarket({ ...market, btcPriceGrowthMonthly: Number(e.target.value) })}
                        />
                    </div>

                    <div className="flex items-end gap-2">
                        <Button onClick={calculatePrices} disabled={loading} className="flex-1">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                            Calculate
                        </Button>
                        <Button variant="outline" onClick={() => setShowAddMiner(!showAddMiner)}>
                            {showAddMiner ? 'Cancel' : 'Add Miner'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Add Custom Miner Form */}
            {showAddMiner && (
                <Card>
                    <CardHeader>
                        <CardTitle>Add Custom Miner</CardTitle>
                    </CardHeader>
                    <CardContent className="flex gap-4 items-end">
                        <div className="space-y-2 flex-1">
                            <Label>Model Name</Label>
                            <Input value={newMiner.name} onChange={e => setNewMiner({ ...newMiner, name: e.target.value })} placeholder="e.g. SuperMiner 9000" />
                        </div>
                        <div className="space-y-2 w-32">
                            <Label>Hashrate (TH)</Label>
                            <Input type="number" value={newMiner.hashrate} onChange={e => setNewMiner({ ...newMiner, hashrate: e.target.value })} placeholder="200" />
                        </div>
                        <div className="space-y-2 w-32">
                            <Label>Power (W)</Label>
                            <Input type="number" value={newMiner.power} onChange={e => setNewMiner({ ...newMiner, power: e.target.value })} placeholder="3000" />
                        </div>
                        <Button onClick={addCustomMiner}>Add</Button>
                    </CardContent>
                </Card>
            )}

            {/* Results Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Miner Pricing</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Miner Model</TableHead>
                                <TableHead className="text-right font-bold text-emerald-600">Suggested Price</TableHead>
                                <TableHead>Specs</TableHead>
                                <TableHead>Final Treasury (USD)</TableHead>
                                <TableHead>Final Treasury (BTC)</TableHead>
                                <TableHead>Project Life</TableHead>
                                <TableHead>Est. Expense (BTC)</TableHead>
                                <TableHead>Est. Revenue (Hosting BTC)</TableHead>
                                <TableHead>Logs</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {results.map((r, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">{r.name}</TableCell>
                                    <TableCell className="text-right">
                                        {r.calculatedPrice > 0 ? (
                                            <span className="font-bold text-emerald-600">
                                                ${r.calculatedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                        ) : (
                                            <span className="text-red-500 font-medium">Negative Price</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {r.hashrateTH} TH/s | {r.powerWatts} W | {(r.powerWatts / r.hashrateTH).toFixed(1)} J/TH
                                    </TableCell>
                                    <TableCell className={r.finalTreasuryUSD >= 0 ? "text-green-600" : "text-red-600"}>
                                        ${r.finalTreasuryUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </TableCell>
                                    <TableCell className={r.finalTreasuryBTC >= 0 ? "text-green-600" : "text-red-600"}>
                                        {r.finalTreasuryBTC.toFixed(4)} BTC
                                    </TableCell>
                                    <TableCell>
                                        {r.projectLifeDays} days
                                        {r.projectLifeDays < durationYears * 365 && <span className="text-xs text-red-500 ml-2">(Early Shutdown)</span>}
                                    </TableCell>
                                    <TableCell>{r.estExpenseBTC.toFixed(4)} BTC</TableCell>
                                    <TableCell>{r.estRevenueHostingBTC.toFixed(4)} BTC</TableCell>
                                    <TableCell>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="sm">View</Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-6xl w-full max-h-[80vh]">
                                                <DialogHeader className="flex flex-row items-center justify-between">
                                                    <DialogTitle>Daily Logs - {r.name}</DialogTitle>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => exportToCSV(r.name, r.projections)}
                                                        className="ml-auto"
                                                    >
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Export CSV
                                                    </Button>
                                                </DialogHeader>
                                                <div className="h-[60vh] overflow-auto">
                                                    <Table className="w-max min-w-full whitespace-nowrap">
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="whitespace-nowrap">Day</TableHead>
                                                                <TableHead className="whitespace-nowrap">Date</TableHead>
                                                                <TableHead className="whitespace-nowrap">BTC Price</TableHead>
                                                                <TableHead className="whitespace-nowrap">Difficulty</TableHead>
                                                                <TableHead className="whitespace-nowrap">Production (BTC)</TableHead>
                                                                <TableHead className="whitespace-nowrap">Production ($)</TableHead>
                                                                <TableHead className="whitespace-nowrap">Hosting ($)</TableHead>
                                                                <TableHead className="whitespace-nowrap">Net Profit ($)</TableHead>
                                                                <TableHead className="whitespace-nowrap">BTC Held</TableHead>
                                                                <TableHead className="whitespace-nowrap">BTC Price Gain ($)</TableHead>
                                                                <TableHead className="whitespace-nowrap">Net Treasury Change (BTC)</TableHead>
                                                                <TableHead className="whitespace-nowrap">Net Treasury Change ($)</TableHead>
                                                                <TableHead className="whitespace-nowrap">Cash Balance ($)</TableHead>
                                                                <TableHead className="whitespace-nowrap">Portfolio Value ($)</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {r.projections.map((day, j) => {
                                                                if (j === 0) {
                                                                    // Debug Log for UI Visualization
                                                                    console.log(`[UI Debug ${r.name}] Day 0: BTC Held=${day.btcHeld}, Portfolio=${day.portfolioValueUSD}`);
                                                                }

                                                                // Calculate BTC price gain from previous day
                                                                const prevDay = j > 0 ? r.projections[j - 1] : null;
                                                                const btcPriceGainUSD = prevDay && !day.isShutdown
                                                                    ? prevDay.btcHeld * (day.btcPrice - prevDay.btcPrice)
                                                                    : 0;

                                                                // Calculate net treasury change in BTC: +hosting - production + price gain
                                                                // Price gain in BTC terms = btcPriceGainUSD / day.btcPrice
                                                                const hostingFeeBTC = day.totalDailyCostUSD / day.btcPrice;
                                                                const priceGainBTC = btcPriceGainUSD / (day.btcPrice || 1);
                                                                const netTreasuryChangeBTC = !day.isShutdown
                                                                    ? hostingFeeBTC - day.netProductionBTC + priceGainBTC
                                                                    : 0;
                                                                const netTreasuryChangeUSD = netTreasuryChangeBTC * day.btcPrice;

                                                                return (
                                                                    <TableRow key={j} className={day.isShutdown ? "opacity-50 bg-red-50" : ""}>
                                                                        <TableCell>{day.dayIndex + 1}</TableCell>
                                                                        <TableCell>{new Date(day.date).toLocaleDateString()}</TableCell>
                                                                        <TableCell>${day.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                                                        <TableCell>{(day.difficulty / 1e12).toFixed(0)} T</TableCell>
                                                                        <TableCell>{day.netProductionBTC.toFixed(6)}</TableCell>
                                                                        <TableCell>${day.dailyRevenueUSD.toFixed(2)}</TableCell>
                                                                        <TableCell>${day.totalDailyCostUSD.toFixed(2)}</TableCell>
                                                                        <TableCell className={day.dailyProfitUSD >= 0 ? "text-green-600" : "text-red-600"}>
                                                                            ${day.dailyProfitUSD.toFixed(2)}
                                                                        </TableCell>
                                                                        <TableCell>{day.btcHeld.toFixed(6)}</TableCell>
                                                                        <TableCell className={btcPriceGainUSD >= 0 ? "text-green-600" : "text-red-600"}>
                                                                            ${btcPriceGainUSD.toFixed(2)}
                                                                        </TableCell>
                                                                        <TableCell className={netTreasuryChangeBTC >= 0 ? "text-green-600" : "text-red-600"}>
                                                                            {netTreasuryChangeBTC.toFixed(6)} BTC
                                                                        </TableCell>
                                                                        <TableCell className={netTreasuryChangeUSD >= 0 ? "text-green-600" : "text-red-600"}>
                                                                            ${netTreasuryChangeUSD.toFixed(2)}
                                                                        </TableCell>
                                                                        <TableCell className={day.cashBalance >= 0 ? "text-green-600" : "text-red-600"}>
                                                                            ${day.cashBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                                        </TableCell>
                                                                        <TableCell className="font-medium">
                                                                            ${day.portfolioValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
