/*
 * 🔒 LOCKED LOGIC 🔒
 * This component's calculation integrations are finalized.
 *
 * PASSWORD REQUIRED FOR EDITS: "Pricesim"
 *
 * Do not modify this file unless the user explicitly provides the password "Pricesim" in the prompt.
 */
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    MinerProfile,
    ContractTerms,
    MarketConditions,
    SimulationConfig,
    MiningCalculator,
    SimulationResult
} from '@/lib/calculator';
import { fetchMarketData } from '@/lib/api';
import { Loader2, Save, Play, RefreshCw } from 'lucide-react';
import { ResultsChart } from '@/components/results-chart';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// Default Initial State
const defaultMiner: MinerProfile = {
    name: 'Antminer S21 Pro',
    hashrateTH: 235,
    powerWatts: 3500, // 15J/TH approx
    price: 2500
};

const defaultContract: ContractTerms = {
    electricityRate: 0.06,
    opexRate: 0.00,
    poolFee: 1.0,
    contractDurationYears: 6
};

const defaultMarket: MarketConditions = {
    btcPrice: 60000,
    networkDifficulty: 86000000000000,
    blockReward: 3.125,
    difficultyGrowthMonthly: 4.0,
    btcPriceGrowthMonthly: 2.5,
    btcPriceGrowthAnnual: 5.0, // Keep for compatibility
    nextHalvingDate: new Date('2028-05-01')
};

const defaultConfig: SimulationConfig = {
    startDate: new Date(),
    initialInvestment: 2500,
    reinvestMode: 'hold'
};

export default function Dashboard() {
    const [miner, setMiner] = useState<MinerProfile>(defaultMiner);
    const [contract, setContract] = useState<ContractTerms>(defaultContract);
    const [market, setMarket] = useState<MarketConditions>(defaultMarket);
    const [config, setConfig] = useState<SimulationConfig>(defaultConfig);

    const [result, setResult] = useState<SimulationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [marketLoading, setMarketLoading] = useState(false);

    const [savedSimulations, setSavedSimulations] = useState<string[]>([]);
    const [simName, setSimName] = useState('');

    // Load saved simulations list
    useEffect(() => {
        const saved = Object.keys(localStorage).filter(k => k.startsWith('sim_'));
        setSavedSimulations(saved.map(k => k.replace('sim_', '')));
    }, []);

    const saveSimulation = () => {
        if (!simName) return;
        const data = { miner, contract, market, config };
        localStorage.setItem(`sim_${simName}`, JSON.stringify(data));
        setSavedSimulations(prev => [...new Set([...prev, simName])]);
        setSimName('');
    };

    const loadSimulation = (name: string) => {
        const dataStr = localStorage.getItem(`sim_${name}`);
        if (dataStr) {
            const data = JSON.parse(dataStr);
            // Restore dates properly
            if (data.config.startDate) data.config.startDate = new Date(data.config.startDate);

            setMiner(data.miner);
            setContract(data.contract);
            setMarket(data.market);
            setConfig(data.config);
            // Trigger run
            setTimeout(() => runSimulation(), 100);
        }
    };

    // Fetch initial market data
    useEffect(() => {
        async function loadData() {
            setMarketLoading(true);
            try {
                const data = await fetchMarketData();
                setMarket(prev => ({
                    ...prev,
                    btcPrice: data.btcPrice,
                    networkDifficulty: data.networkDifficulty
                }));
            } catch (e) {
                console.error("Failed to load market data", e);
            } finally {
                setMarketLoading(false);
            }
        }
        loadData();
    }, []);

    // Run simulation
    const runSimulation = () => {
        setLoading(true);
        // Small timeout to allow UI to show loading state if calculation is heavy (it's not really, but good UX)
        setTimeout(() => {
            const res = MiningCalculator.calculate(miner, contract, market, config);
            setResult(res);
            setLoading(false);
        }, 100);
    };

    // Auto-run on load or when data is ready? Maybe wait for user.
    // Let's auto-run once market data is loaded.
    useEffect(() => {
        if (!marketLoading) {
            runSimulation();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marketLoading]);

    return (
        <div className="container mx-auto p-4 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Cloud Mining Profitability</h1>
                <div className="flex gap-2">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline"><Save className="mr-2 h-4 w-4" /> Load/Save</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Manage Simulations</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input placeholder="Simulation Name" value={simName} onChange={e => setSimName(e.target.value)} />
                                    <Button onClick={saveSimulation}>Save</Button>
                                </div>
                                <div className="space-y-2">
                                    <Label>Saved Simulations</Label>
                                    <ScrollArea className="h-[200px] border rounded-md p-2">
                                        {savedSimulations.length === 0 && <p className="text-sm text-muted-foreground">No saved simulations.</p>}
                                        {savedSimulations.map(name => (
                                            <div key={name} className="flex justify-between items-center p-2 hover:bg-muted rounded cursor-pointer" onClick={() => loadSimulation(name)}>
                                                <span>{name}</span>
                                                <Button variant="ghost" size="sm" onClick={(e) => {
                                                    e.stopPropagation();
                                                    localStorage.removeItem(`sim_${name}`);
                                                    setSavedSimulations(prev => prev.filter(n => n !== name));
                                                }}>Delete</Button>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button variant="outline" onClick={() => window.location.reload()}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Reset
                    </Button>
                    <Button onClick={runSimulation} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        Run Simulation
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Input Panel */}
                <div className="lg:col-span-4 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Miner & Contract</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Miner Name</Label>
                                <Input value={miner.name} onChange={e => setMiner({ ...miner, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Hashrate (TH/s)</Label>
                                    <Input type="number" value={miner.hashrateTH} onChange={e => setMiner({ ...miner, hashrateTH: Number(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Power (Watts)</Label>
                                    <Input type="number" value={miner.powerWatts} onChange={e => setMiner({ ...miner, powerWatts: Number(e.target.value) })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Miner Price ($)</Label>
                                <Input type="number" value={miner.price} onChange={e => {
                                    const val = Number(e.target.value);
                                    setMiner({ ...miner, price: val });
                                    setConfig(prev => ({ ...prev, initialInvestment: val }));
                                }} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Elec Rate ($/kWh)</Label>
                                    <Input type="number" step="0.01" value={contract.electricityRate} onChange={e => setContract({ ...contract, electricityRate: Number(e.target.value) })} />
                                </div>

                            </div>
                            <div className="space-y-2">
                                <Label>Contract Duration (Years)</Label>
                                <Slider
                                    value={[contract.contractDurationYears]}
                                    min={1} max={10} step={1}
                                    onValueChange={([val]) => setContract({ ...contract, contractDurationYears: val })}
                                />
                                <div className="text-right text-sm text-muted-foreground">{contract.contractDurationYears} Years</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Market Conditions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>BTC Price ($)</Label>
                                <Input type="number" value={market.btcPrice} onChange={e => setMarket({ ...market, btcPrice: Number(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Network Difficulty</Label>
                                <Input type="number" value={market.networkDifficulty} onChange={e => setMarket({ ...market, networkDifficulty: Number(e.target.value) })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Diff Growth (%/mo)</Label>
                                    <Input type="number" step="0.1" value={market.difficultyGrowthMonthly} onChange={e => setMarket({ ...market, difficultyGrowthMonthly: Number(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Price Growth (%/mo)</Label>
                                    <Input type="number" step="0.1" value={market.btcPriceGrowthMonthly} onChange={e => setMarket({ ...market, btcPriceGrowthMonthly: Number(e.target.value) })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Next Halving Date</Label>
                                <Input
                                    type="date"
                                    value={market.nextHalvingDate ? market.nextHalvingDate.toISOString().split('T')[0] : ''}
                                    onChange={e => setMarket({ ...market, nextHalvingDate: e.target.value ? new Date(e.target.value) : undefined })}
                                />
                                <p className="text-xs text-muted-foreground">Approx April 2028</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Strategy</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="reinvest-mode">Sell Daily to Pay Bills?</Label>
                                <Switch
                                    id="reinvest-mode"
                                    checked={config.reinvestMode === 'sell_daily'}
                                    onCheckedChange={(checked) => setConfig({ ...config, reinvestMode: checked ? 'sell_daily' : 'hold' })}
                                />
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {config.reinvestMode === 'sell_daily'
                                    ? 'BTC produced is sold daily to cover electricity costs.'
                                    : 'All BTC is held. Electricity costs are paid from external pocket (USD).'}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-8 space-y-6">
                    {result && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold text-green-600">
                                            ${result.summary.netProfitUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                        <p className="text-sm text-muted-foreground">Net Profit (USD)</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold">
                                            {result.summary.roiPercent.toFixed(1)}%
                                        </div>
                                        <p className="text-sm text-muted-foreground">ROI</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold">
                                            {result.summary.breakevenDate ? result.summary.breakevenDate.toLocaleDateString() : 'Never'}
                                        </div>
                                        <p className="text-sm text-muted-foreground">Break-even Date</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Detailed Stats */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Simulation Results</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                        <div>
                                            <div className="text-lg font-semibold">{result.summary.totalProductionBTC.toFixed(4)} BTC</div>
                                            <div className="text-xs text-muted-foreground">Total Mined</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-semibold text-red-500">${result.summary.totalCostUSD.toLocaleString()}</div>
                                            <div className="text-xs text-muted-foreground">Total Cost</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-semibold">${result.summary.totalRevenueUSD.toLocaleString()}</div>
                                            <div className="text-xs text-muted-foreground">Total Value Generated</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-semibold">{result.summary.totalDays} Days</div>
                                            <div className="text-xs text-muted-foreground">Operational Days</div>
                                        </div>
                                    </div>

                                    <ResultsChart data={result.projections} />
                                </CardContent>
                            </Card>

                            {/* Explanation Box */}
                            <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                                <CardHeader>
                                    <CardTitle className="text-blue-700 dark:text-blue-400 text-lg">Analysis</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm">
                                        Based on the current simulation, your miner {result.summary.netProfitUSD > 0 ? 'is profitable' : 'is not profitable'}.
                                        With a difficulty growth of {market.difficultyGrowthMonthly}%/mo and BTC price growth of {market.btcPriceGrowthMonthly}%/mo,
                                        you are expected to break even {result.summary.breakevenDate ? `by ${result.summary.breakevenDate.toLocaleDateString()}` : 'never'}.
                                        {result.summary.shutdownDate && ` The miner is projected to become unprofitable (revenue < cost) on ${result.summary.shutdownDate.toLocaleDateString()}.`}
                                    </p>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
