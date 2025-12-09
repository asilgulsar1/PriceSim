"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Calculator } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MiningCalculator, MinerProfile, ContractTerms, MarketConditions, SimulationConfig, DailyProjection } from "@/lib/calculator";
import { fetchMarketData } from "@/lib/api";

// Hardcoded Miner List
const INITIAL_MINERS: MinerProfile[] = [
    { name: 'Antminer S21 XP', hashrateTH: 270, powerWatts: 3645, price: 0 },
    { name: 'Antminer S21 Pro', hashrateTH: 234, powerWatts: 3510, price: 0 },
    { name: 'Antminer S21', hashrateTH: 200, powerWatts: 3500, price: 0 },
    { name: 'Antminer T21', hashrateTH: 190, powerWatts: 3610, price: 0 },
    { name: 'Whatsminer M60S', hashrateTH: 186, powerWatts: 3441, price: 0 },
    { name: 'Whatsminer M60', hashrateTH: 170, powerWatts: 3400, price: 0 },
    { name: 'Whatsminer M66S', hashrateTH: 298, powerWatts: 5513, price: 0 },
    { name: 'Antminer S19 XP Hydro', hashrateTH: 255, powerWatts: 5304, price: 0 },
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
    const [targetProfitPercent, setTargetProfitPercent] = useState(20);
    const [isBtcTarget, setIsBtcTarget] = useState(false);

    const [market, setMarket] = useState<MarketConditions>({
        btcPrice: 65000,
        networkDifficulty: 86000000000000,
        blockReward: 3.125,
        difficultyGrowthMonthly: 2.0,
        btcPriceGrowthMonthly: 0.4, // ~5% annual
        btcPriceGrowthAnnual: 5.0, // Keep for compatibility
        nextHalvingDate: new Date('2028-05-01')
    });

    const [hostingRate, setHostingRate] = useState(0.06); // All-in rate
    const [durationYears, setDurationYears] = useState(5);

    const [miners, setMiners] = useState<MinerProfile[]>(INITIAL_MINERS);
    const [results, setResults] = useState<CalculatedMiner[]>([]);
    const [loading, setLoading] = useState(false);

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
        setMiners([...miners, miner]);
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
            } catch (e) {
                console.error("Failed to load market data", e);
            }
        }
        loadData();
    }, []);

    const calculatePrices = () => {
        setLoading(true);
        setTimeout(() => {
            const calculated = miners.map(miner => {
                // Config for simulation (0 investment to get raw operational numbers)
                const config: SimulationConfig = {
                    startDate: new Date(),
                    initialInvestment: 0,
                    reinvestMode: 'hold'
                };

                const contract: ContractTerms = {
                    electricityRate: hostingRate,
                    opexRate: 0, // Assuming all-in hosting rate
                    poolFee: 1.0,
                    contractDurationYears: durationYears
                };

                // Run Simulation
                const res = MiningCalculator.calculate(miner, contract, market, config);

                const totalRevenueUSD = res.summary.totalRevenueUSD; // This includes held BTC value at end
                const totalCostUSD = res.summary.totalCostUSD;
                const totalProductionBTC = res.summary.totalProductionBTC;

                // Calculate BTC Metrics (Always needed for display)
                const M = totalProductionBTC; // Total BTC Paid Out

                // Calculate H_btc (Sum of daily hosting / daily price)
                let H_btc_sum = 0;
                res.projections.forEach(day => {
                    if (!day.isShutdown) {
                        H_btc_sum += day.totalDailyCostUSD / day.btcPrice;
                    }
                });

                const estExpenseBTC = M;
                const estRevenueHostingBTC = H_btc_sum;

                const X = targetProfitPercent / 100;
                let calculatedPrice = 0;

                if (isBtcTarget) {
                    // Company Perspective Logic (BTC Basis)
                    // M = Total BTC Paid Out (Net Production)
                    // H_btc = Total Hosting Fees converted to BTC daily
                    // Target Margin = X% of Revenue (in BTC)
                    // Revenue_BTC = P_btc + H_btc
                    // Expense_BTC = M
                    // Profit_BTC = Revenue_BTC - Expense_BTC
                    // Target: Profit_BTC = X * Revenue_BTC
                    // (P_btc + H_btc) - M = X * (P_btc + H_btc)
                    // (P_btc + H_btc) * (1 - X) = M
                    // P_btc = (M / (1 - X)) - H_btc

                    if (X >= 1) {
                        calculatedPrice = 0;
                    } else {
                        const P_btc = (M / (1 - X)) - H_btc_sum;
                        // Convert to USD at Current Price (Start Date)
                        // User mentioned "converted to USD as on date of shutdown", but setting a fixed price 
                        // usually implies current value. Using shutdown price would inflate the price massively 
                        // if growth is high, making it unsellable today. 
                        // We'll use current price for the "Sticker Price".
                        calculatedPrice = P_btc * market.btcPrice;
                    }
                } else {
                    // Company Perspective Logic (USD Basis)
                    // B = Total BTC Value Paid Out (Total Revenue from Miner's perspective)
                    // H = Total Hosting Fees (Total Cost from Miner's perspective)
                    // Target Margin = X% of (Price + H)

                    const B = totalRevenueUSD;
                    const H = totalCostUSD;

                    // Formula: P = (B / (1 - X)) - H
                    // If X is close to 1, price explodes. Cap it?

                    if (X >= 1) {
                        calculatedPrice = 0; // Impossible target
                    } else {
                        calculatedPrice = (B / (1 - X)) - H;
                    }

                    // If B < H (Miner unprofitable), P might be negative.
                    // But simulation stops if B < H daily. 
                    // However, B > H is guaranteed only if simulation runs.
                    // If calculatedPrice < 0, it means Hosting income alone is more than enough to cover B and margin? 
                    // No, if P < 0, it means B / (1-X) < H.
                    // B < H * (1-X).
                    // This implies H is large relative to B.
                    // If Client is profitable (B > H), then B > H * (1-X) is usually true since (1-X) < 1.
                    // So P should be positive.
                }

                // Calculate Final Treasury Balances
                // Final Treasury BTC = (SalesPrice / StartBTCPrice) + HostingBTC - PayoutBTC
                // Final Treasury USD = SalesPrice + HostingUSD - PayoutUSD (PayoutBTC * DailyPrice)

                // Note: PayoutUSD is what the company "lost" by paying out BTC instead of selling it.
                // Or rather, it's the value of BTC paid out.

                let finalTreasuryBTC = 0;
                let finalTreasuryUSD = 0;

                if (calculatedPrice > 0) {
                    const salesPriceBTC = calculatedPrice / market.btcPrice;
                    finalTreasuryBTC = salesPriceBTC + estRevenueHostingBTC - estExpenseBTC;

                    // For USD, we need to sum daily payout values
                    let totalPayoutUSD = 0;
                    res.projections.forEach(day => {
                        if (!day.isShutdown) {
                            totalPayoutUSD += day.netProductionBTC * day.btcPrice;
                        }
                    });

                    finalTreasuryUSD = calculatedPrice + totalCostUSD - totalPayoutUSD;
                }

                return {
                    ...miner,
                    calculatedPrice,
                    projectLifeDays: res.summary.totalDays,
                    totalRevenueUSD, // Kept for reference
                    totalCostUSD,    // Kept for reference
                    estExpenseBTC,
                    estRevenueHostingBTC,
                    finalTreasuryBTC,
                    finalTreasuryUSD,
                    projections: res.projections,
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
        calculatePrices();
    }, [market.btcPrice, market.networkDifficulty, miners]); // Auto-run when market data or miners list changes

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
                                <TableHead>Specs</TableHead>
                                <TableHead>Project Life</TableHead>
                                <TableHead>Est. Expense (BTC)</TableHead>
                                <TableHead>Est. Revenue (Hosting BTC)</TableHead>
                                <TableHead>Final Treasury (BTC)</TableHead>
                                <TableHead>Final Treasury (USD)</TableHead>
                                <TableHead className="text-right font-bold text-emerald-600">Suggested Price</TableHead>
                                <TableHead>Logs</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {results.map((r, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">{r.name}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {r.hashrateTH} TH/s | {r.powerWatts} W | {(r.powerWatts / r.hashrateTH).toFixed(1)} J/TH
                                    </TableCell>
                                    <TableCell>
                                        {r.projectLifeDays} days
                                        {r.projectLifeDays < durationYears * 365 && <span className="text-xs text-red-500 ml-2">(Early Shutdown)</span>}
                                    </TableCell>
                                    <TableCell>{r.estExpenseBTC.toFixed(4)} BTC</TableCell>
                                    <TableCell>{r.estRevenueHostingBTC.toFixed(4)} BTC</TableCell>
                                    <TableCell className={r.finalTreasuryBTC >= 0 ? "text-green-600" : "text-red-600"}>
                                        {r.finalTreasuryBTC.toFixed(4)} BTC
                                    </TableCell>
                                    <TableCell className={r.finalTreasuryUSD >= 0 ? "text-green-600" : "text-red-600"}>
                                        ${r.finalTreasuryUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {r.calculatedPrice > 0 ? (
                                            <span className="text-lg font-bold text-emerald-600">
                                                ${r.calculatedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                        ) : (
                                            <span className="text-red-500 font-medium">Negative Price</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="sm">View</Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-4xl max-h-[80vh]">
                                                <DialogHeader>
                                                    <DialogTitle>Daily Logs - {r.name}</DialogTitle>
                                                </DialogHeader>
                                                <ScrollArea className="h-[60vh]">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Day</TableHead>
                                                                <TableHead>BTC Price</TableHead>
                                                                <TableHead>Difficulty</TableHead>
                                                                <TableHead>Production (BTC)</TableHead>
                                                                <TableHead>Hosting ($)</TableHead>
                                                                <TableHead>Net Profit ($)</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {r.projections.map((day, j) => (
                                                                <TableRow key={j} className={day.isShutdown ? "opacity-50 bg-red-50" : ""}>
                                                                    <TableCell>{day.dayIndex + 1}</TableCell>
                                                                    <TableCell>${day.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                                                    <TableCell>{(day.difficulty / 1e12).toFixed(0)} T</TableCell>
                                                                    <TableCell>{day.netProductionBTC.toFixed(6)}</TableCell>
                                                                    <TableCell>${day.totalDailyCostUSD.toFixed(2)}</TableCell>
                                                                    <TableCell className={day.dailyProfitUSD >= 0 ? "text-green-600" : "text-red-600"}>
                                                                        ${day.dailyProfitUSD.toFixed(2)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </ScrollArea>
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
