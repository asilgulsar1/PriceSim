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
import { Loader2, RefreshCw, Calculator, Download, ArrowUpDown, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PriceSimulatorCalculator, MinerProfile, ContractTerms, MarketConditions, SimulationConfig, DailyProjection } from '@/lib/price-simulator-calculator';
import { fetchMarketData } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { solveMinerPrice } from '@/lib/pricing-solver';

// Hardcoded Miner List
// Hardcoded Miner List - Sourced from User Image
import { INITIAL_MINERS } from "@/lib/miner-data";

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
    clientProfitabilityPercent: number;
    dailyRevenueUSD: number;
    dailyExpenseUSD: number;
}

export function PriceSimulator() {
    // Inputs
    const [targetProfitPercent, setTargetProfitPercent] = useState(50);
    const [isBtcTarget, setIsBtcTarget] = useState(false);

    // Sort and Filter State
    const [sortConfig, setSortConfig] = useState<{ key: keyof CalculatedMiner; direction: 'asc' | 'desc' }>({ key: 'calculatedPrice', direction: 'desc' });
    const [filterText, setFilterText] = useState('');
    const [filterCooling, setFilterCooling] = useState('all');

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
    const [isAddingMiner, setIsAddingMiner] = useState(false);

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
        setIsAddingMiner(false);
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
            'Portfolio Value ($)',
            'Closing BTC Treasury (BTC)'
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
                day.portfolioValueUSD.toFixed(2),
                day.btcHeld.toFixed(8)
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
        // Small timeout to allow UI to render loading state
        setTimeout(() => {
            const calculated = miners.map(miner => {
                const contract: ContractTerms = {
                    electricityRate: hostingRate,
                    opexRate: 0, // Assuming all-in hosting rate
                    poolFee: 1.0,
                    contractDurationYears: durationYears
                };

                // Use the shared solver - Single Source of Truth
                return solveMinerPrice(
                    miner,
                    contract,
                    market,
                    targetProfitPercent,
                    isBtcTarget
                );
            });

            // Initial sort by calculatedPrice descending
            calculated.sort((a, b) => b.calculatedPrice - a.calculatedPrice);

            setResults(calculated as CalculatedMiner[]);
            setLoading(false);
        }, 100);
    };

    // Auto-calc on load/change
    useEffect(() => {
        // Only auto-calculate after market data has been loaded
        if (marketDataLoaded) {
            calculatePrices();
        }
    }, [marketDataLoaded, targetProfitPercent, market, durationYears, hostingRate, miners]);



    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Miner Pricing Simulator</h2>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsAddingMiner(!isAddingMiner)}>
                        {isAddingMiner ? 'Cancel' : 'Add Custom Miner'}
                    </Button>
                    <Button onClick={calculatePrices} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {!loading && <RefreshCw className="mr-2 h-4 w-4" />}
                        Calculate
                    </Button>
                </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Target Profit Margin</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={targetProfitPercent}
                                onChange={e => setTargetProfitPercent(Number(e.target.value))}
                                className="text-2xl font-bold"
                            />
                            <span className="text-muted-foreground">%</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <Switch checked={isBtcTarget} onCheckedChange={setIsBtcTarget} />
                            <Label className="text-xs text-muted-foreground">{isBtcTarget ? 'BTC Target' : 'USD Target'}</Label>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Market Assumptions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">BTC Price:</span>
                            <span className="font-medium">${market.btcPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Difficulty:</span>
                            <span className="font-medium">{(market.networkDifficulty / 1e12).toFixed(0)} T</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Diff Growth:</span>
                            <div className="flex items-center gap-1">
                                <Input
                                    className="h-6 w-16 text-right px-1"
                                    value={market.difficultyGrowthMonthly}
                                    onChange={e => setMarket({ ...market, difficultyGrowthMonthly: Number(e.target.value) })}
                                />
                                <span className="text-xs">% / mo</span>
                            </div>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Price Growth:</span>
                            <div className="flex items-center gap-1">
                                <Input
                                    className="h-6 w-16 text-right px-1"
                                    value={market.btcPriceGrowthMonthly}
                                    onChange={e => setMarket({ ...market, btcPriceGrowthMonthly: Number(e.target.value) })}
                                />
                                <span className="text-xs">% / mo</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Contract Terms</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Hosting Rate:</span>
                            <div className="flex items-center gap-1">
                                <span className="text-xs">$</span>
                                <Input
                                    className="h-6 w-16 text-right px-1"
                                    value={hostingRate}
                                    onChange={e => setHostingRate(Number(e.target.value))}
                                />
                                <span className="text-xs">/ kWh</span>
                            </div>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Duration:</span>
                            <div className="flex items-center gap-1">
                                <Input
                                    className="h-6 w-16 text-right px-1"
                                    value={durationYears}
                                    onChange={e => setDurationYears(Number(e.target.value))}
                                />
                                <span className="text-xs">years</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Custom Miner Input */}
            {isAddingMiner && (
                <Card className="bg-muted/50 border-dashed">
                    <CardContent className="flex items-end gap-4 pt-6">
                        <div className="space-y-2 flex-1">
                            <Label>Miner Name</Label>
                            <Input value={newMiner.name} onChange={e => setNewMiner({ ...newMiner, name: e.target.value })} placeholder="Antminer S21 Pro" />
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

            {/* Filters and Search - Lite UI */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
                <div className="w-full md:w-1/3 relative">
                    <Label className="mb-2 block text-sm font-medium">Search Model</Label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="e.g. S21..."
                            className="pl-9"
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    </div>
                </div>

                <div className="w-full md:w-1/4">
                    <Label className="mb-2 block text-sm font-medium">Cooling Type</Label>
                    <Select value={filterCooling} onValueChange={setFilterCooling}>
                        <SelectTrigger>
                            <SelectValue placeholder="All Cooling" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="air">Air Cooled</SelectItem>
                            <SelectItem value="hydro">Hydro / Immersion</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="text-sm text-muted-foreground pb-3 ml-auto">
                    Showing {
                        results.filter(r => {
                            const coolingMatch = filterCooling === 'all' ? true :
                                filterCooling === 'hydro' ? (r.name.includes('Hydro') || r.name.includes('Immersion')) :
                                    !r.name.includes('Hydro') && !r.name.includes('Immersion');
                            const searchMatch = r.name.toLowerCase().includes(filterText.toLowerCase());
                            return coolingMatch && searchMatch;
                        }).length
                    } models
                </div>
            </div>

            {/* Results Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Miner Pricing Results</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSortConfig({ key: 'name', direction: sortConfig.key === 'name' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                                    <div className="flex items-center gap-1">
                                        Miner Model
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSortConfig({ key: 'calculatedPrice', direction: sortConfig.key === 'calculatedPrice' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })}>
                                    <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold">
                                        Suggested Price
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSortConfig({ key: 'clientProfitabilityPercent', direction: sortConfig.key === 'clientProfitabilityPercent' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })}>
                                    <div className="flex items-center justify-end gap-1">
                                        Client Profitability (Annual)
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSortConfig({ key: 'dailyRevenueUSD', direction: sortConfig.key === 'dailyRevenueUSD' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })}>
                                    <div className="flex items-center justify-end gap-1">
                                        Daily Rev ($)
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSortConfig({ key: 'dailyExpenseUSD', direction: sortConfig.key === 'dailyExpenseUSD' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })}>
                                    <div className="flex items-center justify-end gap-1">
                                        Daily Exp ($)
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead>Specs</TableHead>
                                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSortConfig({ key: 'finalTreasuryUSD', direction: sortConfig.key === 'finalTreasuryUSD' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })}>
                                    <div className="flex items-center gap-1">
                                        Final Treasury (USD)
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead>Final Treasury (BTC)</TableHead>
                                <TableHead>Project Life</TableHead>
                                <TableHead>Est. Expense (BTC)</TableHead>
                                <TableHead>Est. Revenue (Hosting BTC)</TableHead>
                                <TableHead>Logs</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {results
                                .filter(r => {
                                    const coolingMatch = filterCooling === 'all' ? true :
                                        filterCooling === 'hydro' ? (r.name.includes('Hydro') || r.name.includes('Immersion')) :
                                            !r.name.includes('Hydro') && !r.name.includes('Immersion');

                                    const searchMatch = r.name.toLowerCase().includes(filterText.toLowerCase());

                                    return coolingMatch && searchMatch;
                                })
                                .sort((a, b) => {
                                    const valA = a[sortConfig.key];
                                    const valB = b[sortConfig.key];

                                    // Handle string comparison for names
                                    if (typeof valA === 'string' && typeof valB === 'string') {
                                        return sortConfig.direction === 'asc'
                                            ? valA.localeCompare(valB)
                                            : valB.localeCompare(valA);
                                    }

                                    // Handle number comparison
                                    if (typeof valA === 'number' && typeof valB === 'number') {
                                        return sortConfig.direction === 'asc'
                                            ? valA - valB
                                            : valB - valA;
                                    }

                                    return 0;
                                })
                                .map((r, i) => (
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
                                        <TableCell className="text-right">
                                            {r.clientProfitabilityPercent.toFixed(2)}%
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-emerald-600">
                                            ${r.dailyRevenueUSD.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-amber-600">
                                            ${r.dailyExpenseUSD.toFixed(2)}
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
                                                                    <TableHead className="whitespace-nowrap">Closing BTC Treasury (BTC)</TableHead>
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
                                                                            <TableCell className="font-bold">
                                                                                ${day.portfolioValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                {day.btcHeld.toFixed(8)} BTC
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
