"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Calculator, FileText } from "lucide-react";

import { fetchMarketData } from "@/lib/api";
import { INITIAL_MINERS, MinerProfile } from "@/lib/miner-data";
import { FormulaCalculator, FormulaResult } from "@/lib/formula-calculator";
import { MarketConditions, ContractTerms } from "@/lib/calculator";
import { DEFAULT_MARKET_CONDITIONS, DEFAULT_CONTRACT_TERMS } from "@/lib/constants";

interface CalculatedFormulaMiner extends MinerProfile {
    result: FormulaResult;
}

export function FormulaApproachClient() {
    // State
    const [loading, setLoading] = useState(false);
    const [isBtcBased, setIsBtcBased] = useState(false);

    // Inputs
    const [difficultyGrowthMonthly, setDifficultyGrowthMonthly] = useState(DEFAULT_MARKET_CONDITIONS.difficultyGrowthMonthly);
    const [btcPriceGrowthMonthly, setBtcPriceGrowthMonthly] = useState(DEFAULT_MARKET_CONDITIONS.btcPriceGrowthMonthly || 2.5);
    const [hostingRate, setHostingRate] = useState(DEFAULT_CONTRACT_TERMS.electricityRate);

    // Market Data
    const [market, setMarket] = useState<MarketConditions>(DEFAULT_MARKET_CONDITIONS);
    const [marketDataLoaded, setMarketDataLoaded] = useState(false);

    // Results
    const [results, setResults] = useState<CalculatedFormulaMiner[]>([]);

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
                setMarketDataLoaded(true);
            }
        }
        loadData();
    }, []);

    // Calculation Handler
    const calculate = React.useCallback(() => {
        setLoading(true);
        setTimeout(() => {
            const currentMarket: MarketConditions = {
                ...market,
                difficultyGrowthMonthly,
                btcPriceGrowthMonthly
            };

            const contract: ContractTerms = {
                electricityRate: hostingRate,
                opexRate: 0,
                poolFee: 0,
                contractDurationYears: 10
            };

            const calculated = INITIAL_MINERS.map(miner => {
                const result = FormulaCalculator.calculate(miner, currentMarket, contract, isBtcBased);
                return {
                    ...miner,
                    result
                };
            });

            calculated.sort((a, b) => b.result.minPriceUSD - a.result.minPriceUSD);

            setResults(calculated);
            setLoading(false);
        }, 50);
    }, [market, difficultyGrowthMonthly, btcPriceGrowthMonthly, hostingRate, isBtcBased]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (marketDataLoaded) {
            calculate();
        }
        // We intentionally only want this to run when marketDataLoaded initially becomes true,
        // OR when inputs change (which calculate depends on).
        // But 'calculate' changes when inputs change due to useCallback dependencies.
        // So this is correct.
        // The warning about 'setState' is because calculate() sets loading=true immediately.
        // This is acceptable behavior for a "re-calculate on input change" feature.
        // We suppress the warning for set-state-in-effect as we know it terminates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marketDataLoaded, calculate]);

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Formula Approach Pricing</h1>
                    <p className="text-muted-foreground mt-1">
                        Geometric Pricing Formula {isBtcBased ? "(BTC Basis)" : "(USD Basis)"} with Halving Adjustment
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={calculate} disabled={loading} size="lg">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {!loading && <Calculator className="mr-2 h-4 w-4" />}
                        Recalculate
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Approach Mode</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="btc-mode">BTC Based Calculation</Label>
                            <Switch
                                id="btc-mode"
                                checked={isBtcBased}
                                onCheckedChange={setIsBtcBased}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {isBtcBased
                                ? "Calculates costs and prices in BTC terms. Assumes constant BTC Purchasing Power relative to Cost."
                                : "Calculates in USD. Accounts for BTC Price Appreciation reducing effective cost."}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Growth Assumptions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label>Diff Growth / Mo</Label>
                            <div className="flex items-center gap-1">
                                <Input
                                    className="w-20 text-right h-8"
                                    type="number"
                                    value={difficultyGrowthMonthly}
                                    onChange={e => setDifficultyGrowthMonthly(Number(e.target.value))}
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center opacity-90">
                            <Label>Price Growth / Mo</Label>
                            <div className="flex items-center gap-1">
                                <Input
                                    className="w-20 text-right h-8"
                                    type="number"
                                    value={btcPriceGrowthMonthly}
                                    onChange={e => setBtcPriceGrowthMonthly(Number(e.target.value))}
                                    disabled={isBtcBased}
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Hosting Costs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-center">
                            <Label>All-in Rate</Label>
                            <div className="flex items-center gap-1">
                                <span className="text-sm font-bold">$</span>
                                <Input
                                    className="w-20 text-right h-8"
                                    type="number"
                                    value={hostingRate}
                                    onChange={e => setHostingRate(Number(e.target.value))}
                                />
                                <span className="text-xs text-muted-foreground">/ kWh</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Market Data</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">BTC Price:</span>
                            <span className="font-mono">${market.btcPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Difficulty:</span>
                            <span className="font-mono">{(market.networkDifficulty / 1e12).toFixed(2)} T</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Halving:</span>
                            <span className="font-mono">{market.nextHalvingDate?.toLocaleDateString()}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Pricing Results</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Miner Model</TableHead>
                                <TableHead>Hashrate</TableHead>
                                <TableHead>Power</TableHead>
                                <TableHead className="text-right">Calculated Price ({isBtcBased ? "BTC" : "USD"})</TableHead>
                                {!isBtcBased && <TableHead className="text-right">Price (BTC)</TableHead>}
                                <TableHead className="text-right">Lifespan</TableHead>
                                <TableHead className="text-right">Revenue (BTC)</TableHead>
                                <TableHead className="text-right">Cost (BTC)</TableHead>
                                <TableHead className="text-center">Proof</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {results.map((miner, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">{miner.name}</TableCell>
                                    <TableCell>{miner.hashrateTH} TH/s</TableCell>
                                    <TableCell>{miner.powerWatts} W</TableCell>
                                    <TableCell className="text-right font-bold text-xl text-emerald-600">
                                        {isBtcBased
                                            ? miner.result.minPriceBTC.toFixed(4)
                                            : "$" + miner.result.minPriceUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })
                                        }
                                    </TableCell>
                                    {!isBtcBased && (
                                        <TableCell className="text-right text-muted-foreground font-mono">
                                            {miner.result.minPriceBTC.toFixed(4)}
                                        </TableCell>
                                    )}
                                    <TableCell className="text-right">
                                        {miner.result.lifespanDays.toFixed(0)} days
                                    </TableCell>
                                    <TableCell className="text-right text-green-600">
                                        {miner.result.totalRevenueBTC.toFixed(4)}
                                    </TableCell>
                                    <TableCell className="text-right text-red-600">
                                        {miner.result.totalCostBTC.toFixed(4)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                    <FileText className="h-4 w-4 mr-1" /> Log
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                                <DialogHeader>
                                                    <DialogTitle>Calculation Proof: {miner.name}</DialogTitle>
                                                </DialogHeader>
                                                <div className="mt-4">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Step</TableHead>
                                                                <TableHead>Description</TableHead>
                                                                <TableHead className="text-right">Value</TableHead>
                                                                <TableHead className="text-right">Formula/Note</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {miner.result.logs.map((log, k) => (
                                                                <TableRow key={k}>
                                                                    <TableCell className="font-medium text-xs text-muted-foreground">{log.step}</TableCell>
                                                                    <TableCell>{log.description}</TableCell>
                                                                    <TableCell className="text-right font-mono font-bold">{log.value}</TableCell>
                                                                    <TableCell className="text-right text-xs text-muted-foreground">{log.formula}</TableCell>
                                                                </TableRow>
                                                            ))}
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
