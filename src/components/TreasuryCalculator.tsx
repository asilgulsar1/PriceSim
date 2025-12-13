"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle, XCircle, Save, Play, RefreshCw, Loader2, Download, TrendingUp } from "lucide-react";
import { jsPDF } from 'jspdf';
import { toJpeg } from 'html-to-image';
import autoTable from 'jspdf-autotable';
import { TreasuryChart } from "@/components/treasury-chart";
import { TreasuryCalculatorLogic, TreasuryResult } from "@/lib/treasury-calculator";
import { MinerProfile, ContractTerms, MarketConditions, SimulationConfig } from "@/lib/calculator";
import { fetchMarketData } from "@/lib/api";

// Default Miner - matches first line item in Price Simulator
const defaultMiner: MinerProfile = {
    name: 'Antminer S21 XP Hydro',
    hashrateTH: 473,
    powerWatts: 5676,
    price: 12000
};

const defaultContract: ContractTerms = {
    electricityRate: 0.06,
    opexRate: 0.00,
    contractDurationYears: 5,
    poolFee: 1.0,
    advancePaymentYears: 0,
    setupFeeUSD: 0,
    setupFeeToBTCPercent: 0,
    hardwareCostUSD: 12000, // Match miner price
    markupToBTCPercent: 100,
    minProfitThreshold: 0,
    minProfitType: 'USD'
};

const defaultMarket: MarketConditions = {
    btcPrice: 92817, // Market-based default (matches Price Simulator)
    networkDifficulty: 109000000000000, // Market-based default (matches Price Simulator)
    blockReward: 3.125,
    difficultyGrowthMonthly: 4.0,
    btcPriceGrowthMonthly: 2.5, // ~34.5% annual
    btcPriceGrowthAnnual: 5, // Keep for compatibility
    nextHalvingDate: new Date('2028-05-01')
};

const defaultConfig: SimulationConfig = {
    startDate: new Date(),
    initialInvestment: 12000, // Match miner price
    reinvestMode: 'hold' // Not used in Treasury logic directly but part of config
};

export function TreasuryCalculator() {
    // --- State ---
    const [miner, setMiner] = useState<MinerProfile>(defaultMiner);
    const [contract, setContract] = useState<ContractTerms>(defaultContract);
    const [market, setMarket] = useState<MarketConditions>(defaultMarket);
    const [config, setConfig] = useState<SimulationConfig>(defaultConfig);

    const [result, setResult] = useState<TreasuryResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [marketLoading, setMarketLoading] = useState(false);

    const [savedSimulations, setSavedSimulations] = useState<string[]>([]);
    const [simName, setSimName] = useState('');

    // Load saved simulations
    useEffect(() => {
        const saved = Object.keys(localStorage).filter(k => k.startsWith('treasury_sim_'));
        setSavedSimulations(saved.map(k => k.replace('treasury_sim_', '')));
    }, []);

    const saveSimulation = () => {
        if (!simName) return;
        const data = { miner, contract, market, config };
        localStorage.setItem(`treasury_sim_${simName}`, JSON.stringify(data));
        setSavedSimulations(prev => [...new Set([...prev, simName])]);
        setSimName('');
    };

    const loadSimulation = (name: string) => {
        const dataStr = localStorage.getItem(`treasury_sim_${name}`);
        if (dataStr) {
            const data = JSON.parse(dataStr);
            if (data.config.startDate) data.config.startDate = new Date(data.config.startDate);
            if (data.market.nextHalvingDate) data.market.nextHalvingDate = new Date(data.market.nextHalvingDate);
            setMiner(data.miner);
            setContract(data.contract);
            setMarket(data.market);
            setConfig(data.config);

            // Run simulation directly with loaded data to avoid stale state closures
            setLoading(true);
            setTimeout(() => {
                const res = TreasuryCalculatorLogic.calculate(data.miner, data.contract, data.market, data.config);
                setResult(res);
                setLoading(false);
            }, 100);
        }
    };

    // Fetch Market Data
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

    const runSimulation = () => {
        setLoading(true);
        setTimeout(() => {
            const res = TreasuryCalculatorLogic.calculate(miner, contract, market, config);
            setResult(res);
            setLoading(false);
        }, 100);
    };

    // Auto-run when market data loads
    useEffect(() => {
        if (!marketLoading) {
            // runSimulation logic inline to satisfy lint or add deps
            setLoading(true);
            setTimeout(() => {
                const res = TreasuryCalculatorLogic.calculate(miner, contract, market, config);
                setResult(res);
                setLoading(false);
            }, 100);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marketLoading]);

    const markup = Math.max(0, miner.price - (contract.hardwareCostUSD || 0));

    const exportPDF = async () => {
        console.log("Starting PDF Export...");
        if (!result) {
            console.error("No result to export");
            return;
        }

        const element = document.getElementById('treasury-dashboard');
        if (!element) {
            console.error("Dashboard element not found");
            return;
        }

        // Show loading state if needed, but for now just run it
        try {
            console.log("Capturing dashboard with html-to-image (JPEG)...");
            const imgData = await toJpeg(element, {
                backgroundColor: '#ffffff', // Ensure white background
                quality: 0.8, // Compress image
                pixelRatio: 1 // Standard resolution
            });
            console.log("Image captured");

            const pdf = new jsPDF('p', 'mm', 'a4');
            console.log("PDF created");
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // We need to get the image dimensions. 
            // html-to-image returns a data URL. We can create an Image object to get dimensions, 
            // or just use the element's dimensions since we know them?
            // Better to load the image to be sure of aspect ratio.

            const imgProps = pdf.getImageProperties(imgData);
            const imgWidth = pdfWidth;
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

            // If image is taller than page, we might need to split or just scale to fit?
            // For now, let's just add it. If it's too long, it might get cut off or we can scale it down.
            // Let's scale to fit if it's too tall
            let finalWidth = imgWidth;
            let finalHeight = imgHeight;

            if (finalHeight > pdfHeight) {
                const ratio = pdfHeight / finalHeight;
                finalWidth = finalWidth * ratio;
                finalHeight = pdfHeight;
            }

            pdf.addImage(imgData, 'JPEG', 0, 0, finalWidth, finalHeight);

            // Add Summary Text
            pdf.addPage();
            pdf.setFontSize(14);
            pdf.text("Simulation Summary", 14, 15);

            pdf.setFontSize(10);
            let yPos = 25;

            if (result.summary.shutdownDate) {
                pdf.text(`Shutdown Date: ${result.summary.shutdownDate.toLocaleDateString()}`, 14, yPos);
                yPos += 6;
                pdf.text(`Shutdown Reason: ${result.summary.shutdownReason}`, 14, yPos);
                yPos += 6;
                if (result.summary.shutdownBtcPrice) {
                    pdf.text(`BTC Price at Shutdown: $${result.summary.shutdownBtcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 14, yPos);
                    yPos += 6;
                }
            } else {
                pdf.text("Miner ran for full contract duration.", 14, yPos);
                yPos += 6;
            }

            yPos += 10;
            pdf.text("Daily Simulation Logs", 14, yPos);
            yPos += 6;

            const tableData = result.projections.map(p => [
                p.dayIndex,
                p.date.toLocaleDateString(),
                `$${p.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                p.dailyYieldBTC.toFixed(6),
                `$${p.dailyYieldUSD.toFixed(2)}`,
                `$${p.dailyOpExUSD.toFixed(2)}`,
                `$${p.netProfitUSD.toFixed(2)}`,
                p.treasuryBTC.toFixed(4),
                `$${p.treasuryCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                `$${p.treasuryUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            ]);

            autoTable(pdf, {
                head: [['Day', 'Date', 'BTC Price', 'Yield (BTC)', 'Yield (USD)', 'OpEx (USD)', 'Net Profit', 'Treasury (BTC)', 'Treasury (Cash)', 'Total (USD)']],
                body: tableData,
                startY: yPos,
                styles: { fontSize: 7 },
                headStyles: { fillColor: [22, 163, 74] }
            });

            const sanitizedMinerName = miner.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `treasury_simulation_${sanitizedMinerName}_${dateStr}.pdf`;

            // Manual save to ensure filename and extension
            const blob = pdf.output('blob');
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.type = 'application/pdf'; // Explicitly set MIME type
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            console.log(`PDF saved as ${fileName}`);
        } catch (error) {
            console.error("PDF Export failed", error);
            alert("PDF Export failed. Please check console for details.");
        }
    };

    const exportCSV = () => {
        if (!result) return;

        const headers = ['Day', 'Date', 'BTC Price', 'Yield (BTC)', 'Yield (USD)', 'OpEx (USD)', 'Net Profit (USD)', 'Treasury (BTC)', 'Treasury (Cash)', 'Total (USD)'];
        const rows = result.projections.map(p => [
            p.dayIndex,
            p.date.toLocaleDateString(),
            p.btcPrice.toFixed(2),
            p.dailyYieldBTC.toFixed(8),
            p.dailyYieldUSD.toFixed(2),
            p.dailyOpExUSD.toFixed(2),
            p.netProfitUSD.toFixed(2),
            p.treasuryBTC.toFixed(8),
            p.treasuryCash.toFixed(2),
            p.treasuryUSD.toFixed(2)
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const sanitizedMinerName = miner.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `treasury_simulation_${sanitizedMinerName}_${dateStr}.csv`;

        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            {/* Header / Controls */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Configuration</h2>
                    <p className="text-muted-foreground">Setup the synthetic mining parameters</p>
                </div>
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
                                                    localStorage.removeItem(`treasury_sim_${name}`);
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
                    <Button onClick={runSimulation} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        Run Simulation
                    </Button>
                </div>
            </div>

            <div id="treasury-dashboard" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* --- Inputs (Left Col) --- */}
                <div className="lg:col-span-4 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Miner & Markup</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Miner Name</Label>
                                <Input value={miner.name} onChange={e => setMiner({ ...miner, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Sale Price ($)</Label>
                                    <Input type="number" value={miner.price} onChange={e => setMiner({ ...miner, price: Number(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>H/W Cost ($)</Label>
                                    <Input type="number" value={contract.hardwareCostUSD || 0} onChange={e => setContract({ ...contract, hardwareCostUSD: Number(e.target.value) })} />
                                </div>
                            </div>
                            <div className="p-3 bg-muted rounded-md text-sm">
                                <div className="flex justify-between">
                                    <span>Markup:</span>
                                    <span className="font-bold">${markup.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label>Markup Split (BTC / Cash)</Label>
                                    <span className="text-xs text-muted-foreground">{contract.markupToBTCPercent}% BTC</span>
                                </div>
                                <Slider
                                    value={[contract.markupToBTCPercent || 0]}
                                    min={0} max={100} step={5}
                                    onValueChange={([val]) => setContract({ ...contract, markupToBTCPercent: val })}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Hashrate (TH/s)</Label>
                                    <Input type="number" value={miner.hashrateTH} onChange={e => setMiner({ ...miner, hashrateTH: Number(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Power (Watts)</Label>
                                    <Input type="number" value={miner.powerWatts} onChange={e => setMiner({ ...miner, powerWatts: Number(e.target.value) })} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Contract & Fees</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Elec Rate ($/kWh)</Label>
                                    <Input type="number" step="0.01" value={contract.electricityRate} onChange={e => setContract({ ...contract, electricityRate: Number(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Margin/OpEx ($/kWh)</Label>
                                    <Input type="number" step="0.01" value={contract.opexRate || 0} onChange={e => setContract({ ...contract, opexRate: Number(e.target.value) })} />
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

                            <div className="space-y-2 border-t pt-2">
                                <Label>Advance Hosting Payment (Years)</Label>
                                <Slider
                                    value={[contract.advancePaymentYears || 0]}
                                    min={0} max={contract.contractDurationYears} step={1}
                                    onValueChange={([val]) => setContract({ ...contract, advancePaymentYears: val })}
                                />
                                <div className="text-right text-sm text-muted-foreground">{contract.advancePaymentYears || 0} Years Prepaid</div>
                            </div>

                            <div className="space-y-2 border-t pt-2">
                                <Label>Setup Fee ($)</Label>
                                <Input type="number" value={contract.setupFeeUSD || 0} onChange={e => setContract({ ...contract, setupFeeUSD: Number(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label>Setup Fee Split (BTC / Cash)</Label>
                                    <span className="text-xs text-muted-foreground">{contract.setupFeeToBTCPercent || 0}% BTC</span>
                                </div>
                                <Slider
                                    value={[contract.setupFeeToBTCPercent || 0]}
                                    min={0} max={100} step={5}
                                    onValueChange={([val]) => setContract({ ...contract, setupFeeToBTCPercent: val })}
                                />
                            </div>

                            <div className="space-y-2 border-t pt-2">
                                <Label className="text-base font-semibold">Advisory Settings</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Min Profit Type</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={contract.minProfitType || 'USD'}
                                            onChange={e => setContract({ ...contract, minProfitType: e.target.value as 'USD' | 'BTC' | 'percent_sales' })}
                                        >
                                            <option value="USD">Net Profit ($)</option>
                                            <option value="BTC">Treasury (BTC)</option>
                                            <option value="percent_sales">ROI (%)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Threshold</Label>
                                        <Input
                                            type="number"
                                            value={contract.minProfitThreshold || 0}
                                            onChange={e => setContract({ ...contract, minProfitThreshold: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Market Assumptions</CardTitle>
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Diff Growth (%/mo)</Label>
                                    <Input type="number" step="0.1" value={market.difficultyGrowthMonthly} onChange={e => setMarket({ ...market, difficultyGrowthMonthly: Number(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Price Growth (%/mo)</Label>
                                    <Input type="number" step="0.1" value={market.btcPriceGrowthMonthly || 0} onChange={e => setMarket({ ...market, btcPriceGrowthMonthly: Number(e.target.value) })} />
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
                </div>

                {/* --- Results (Right Col) --- */}
                <div className="lg:col-span-8 space-y-6">
                    {result ? (
                        <>
                            {/* Status Banner */}
                            <div className={`p-4 rounded-lg border ${result.summary.isNegative || result.summary.isAdvisoryTriggered ? 'bg-red-950/30 border-red-900' : result.summary.isWin ? 'bg-emerald-950/30 border-emerald-900' : 'bg-yellow-950/30 border-yellow-900'}`}>
                                <div className="flex items-center gap-3">
                                    {result.summary.isNegative || result.summary.isAdvisoryTriggered ? <XCircle className="text-red-500 h-8 w-8" /> :
                                        result.summary.isWin ? <CheckCircle className="text-emerald-500 h-8 w-8" /> :
                                            <AlertTriangle className="text-yellow-500 h-8 w-8" />}
                                    <div>
                                        <h3 className={`text-lg font-bold ${result.summary.isNegative || result.summary.isAdvisoryTriggered ? 'text-red-400' : result.summary.isWin ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                            {result.summary.isNegative
                                                ? "ADVISORY: DO NOT DEAL"
                                                : result.summary.isAdvisoryTriggered
                                                    ? "ADVISORY: DO NOT DEAL (BELOW MINIMUM PROFIT)"
                                                    : result.summary.isWin
                                                        ? "WIN: DEAL APPROVED"
                                                        : "CAUTION: MARGINAL RESULT"}
                                        </h3>
                                        <div className="text-sm text-muted-foreground">
                                            {result.summary.isNegative
                                                ? "Treasury goes negative before contract ends."
                                                : result.summary.isAdvisoryTriggered
                                                    ? result.summary.advisoryMessage
                                                    : result.summary.isWin
                                                        ? "Treasury surplus exceeds 50% of total client investment."
                                                        : "Treasury is positive but below 50% target."}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Key Metrics */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className={`text-2xl font-bold ${result.summary.finalTreasuryUSD < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                            ${result.summary.finalTreasuryUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                        <p className="text-sm text-muted-foreground">Final Treasury (Total)</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold">
                                            {result.summary.finalTreasuryBTC.toFixed(4)} ₿
                                        </div>
                                        <p className="text-sm text-muted-foreground">In BTC</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold">
                                            ${result.summary.finalTreasuryCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                        <p className="text-sm text-muted-foreground">In Cash</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold">
                                            {result.summary.roiPercent.toFixed(1)}%
                                        </div>
                                        <p className="text-sm text-muted-foreground">ROI vs Investment</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Chart */}
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold">Treasury Projection</h3>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm">Show Daily Logs</Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-6xl w-full h-[80vh] flex flex-col">
                                        <DialogHeader>
                                            <DialogTitle>Daily Simulation Logs</DialogTitle>
                                        </DialogHeader>
                                        <ScrollArea className="flex-1 mt-4 -mx-6 px-6 min-h-0">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left whitespace-nowrap">
                                                    <thead className="text-xs uppercase bg-muted sticky top-0 z-10">
                                                        <tr>
                                                            <th className="px-4 py-2">Day</th>
                                                            <th className="px-4 py-2">Date</th>
                                                            <th className="px-4 py-2">BTC Price</th>
                                                            <th className="px-4 py-2">Yield (BTC)</th>
                                                            <th className="px-4 py-2">Yield (USD)</th>
                                                            <th className="px-4 py-2">OpEx (USD)</th>
                                                            <th className="px-4 py-2">Net Profit (USD)</th>
                                                            <th className="px-4 py-2">Treasury (BTC)</th>
                                                            <th className="px-4 py-2">Treasury (Cash)</th>
                                                            <th className="px-4 py-2">Total (USD)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {result?.projections.map((p) => (
                                                            <tr key={p.dayIndex} className="border-b hover:bg-muted/50">
                                                                <td className="px-4 py-1">{p.dayIndex}</td>
                                                                <td className="px-4 py-1">{p.date.toLocaleDateString()}</td>
                                                                <td className="px-4 py-1">${p.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                                <td className="px-4 py-1">{p.dailyYieldBTC.toFixed(6)}</td>
                                                                <td className="px-4 py-1">${p.dailyYieldUSD.toFixed(2)}</td>
                                                                <td className="px-4 py-1">${p.dailyOpExUSD.toFixed(2)}</td>
                                                                <td className="px-4 py-1 font-semibold text-emerald-600">${p.netProfitUSD.toFixed(2)}</td>
                                                                <td className="px-4 py-1">{p.treasuryBTC.toFixed(4)}</td>
                                                                <td className="px-4 py-1">${p.treasuryCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                                <td className="px-4 py-1 font-medium">${p.treasuryUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </ScrollArea>
                                    </DialogContent>
                                </Dialog>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={exportCSV}>
                                        <Download className="mr-2 h-4 w-4" /> Export CSV
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={exportPDF}>
                                        <Download className="mr-2 h-4 w-4" /> Export PDF
                                    </Button>
                                </div>
                            </div>
                            <Card>
                                <CardContent className="pt-6">
                                    <TreasuryChart data={result.projections} />
                                </CardContent>
                            </Card>

                            {/* Analysis */}
                            <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                                <CardHeader>
                                    <CardTitle className="text-blue-700 dark:text-blue-400 text-lg">Analysis</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm leading-relaxed">
                                        The simulation runs for <strong>{result.summary.totalDays} days</strong>.
                                        {result.summary.shutdownDate && (
                                            <>
                                                {' '}Mining operations cease on <strong>{result.summary.shutdownDate.toLocaleDateString()}</strong> due to: <em>{result.summary.shutdownReason}</em>.
                                                {result.summary.shutdownBtcPrice && (
                                                    <> BTC Price at shutdown: <strong>${result.summary.shutdownBtcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>.</>
                                                )}
                                            </>
                                        )}
                                        {!result.summary.shutdownDate && " The miner remains profitable throughout the contract duration."}
                                        <br /><br />
                                        <strong>Initial Setup:</strong>
                                        <ul className="list-disc list-inside ml-2 mt-1 mb-2">
                                            <li>Client pays <strong>${result.summary.initialInvestmentUSD.toLocaleString()}</strong> total.</li>
                                            <li>Markup: <strong>${markup.toLocaleString()}</strong> ({contract.markupToBTCPercent}% to BTC).</li>
                                            <li>Setup Fee: <strong>${(contract.setupFeeUSD || 0).toLocaleString()}</strong> ({contract.setupFeeToBTCPercent}% to BTC).</li>
                                            <li>Advance Hosting: <strong>{contract.advancePaymentYears} years</strong> (Converted to BTC).</li>
                                        </ul>
                                        The final treasury value is <strong>${result.summary.finalTreasuryUSD.toLocaleString()}</strong>, representing a <strong>{result.summary.roiPercent.toFixed(1)}%</strong> return on the total client investment.
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <TrendingUp className="h-12 w-12 mb-4 opacity-20" />
                            <p>Loading simulation...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
