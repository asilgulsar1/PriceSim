"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, Download, RefreshCw, Loader2, Search, ArrowUpDown } from "lucide-react";
import { fetchMarketData } from "@/lib/api";
import { solveMinerPrice, SolvedMiner } from "@/lib/pricing-solver";
import { INITIAL_MINERS } from "@/lib/miner-data";
import { MarketConditions, ContractTerms } from "@/lib/price-simulator-calculator";
import { rankMiners, MinerScoreDetail } from "@/lib/miner-scoring";
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

export function PriceListGenerator() {
    // State
    const [clientName, setClientName] = useState('Valued Client');
    const [marginMode, setMarginMode] = useState<'percent' | 'usd'>('percent');
    const [marginValue, setMarginValue] = useState<number>(50); // Default 50% Client ROI

    // Market Data
    const [market, setMarket] = useState<MarketConditions>({
        btcPrice: 96500,
        networkDifficulty: 101.6e12,
        blockReward: 3.125,
        difficultyGrowthMonthly: 4,
        btcPriceGrowthMonthly: 2.5,
        btcPriceGrowthAnnual: 0
    });
    const [loading, setLoading] = useState(false);

    // Results
    const [results, setResults] = useState<SolvedMiner[]>([]);
    const [recommendations, setRecommendations] = useState<{
        topROI: MinerScoreDetail[];
        topRevenue: MinerScoreDetail[];
        topEfficiency: MinerScoreDetail[];
    }>({ topROI: [], topRevenue: [], topEfficiency: [] });

    // Filter & Sort State
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'price' | 'roi' | 'payback' | 'efficiency' | 'revenue'>('roi');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const filteredResults = React.useMemo(() => {
        return results
            .filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                let valA = 0, valB = 0;
                const direction = sortOrder === 'asc' ? 1 : -1;

                switch (sortBy) {
                    case 'price': valA = a.calculatedPrice; valB = b.calculatedPrice; break;
                    case 'roi': valA = a.clientProfitabilityPercent; valB = b.clientProfitabilityPercent; break;
                    case 'payback':
                        const profitA = a.dailyRevenueUSD - a.dailyExpenseUSD;
                        const profitB = b.dailyRevenueUSD - b.dailyExpenseUSD;
                        valA = profitA > 0 ? (a.calculatedPrice / profitA) : 99999;
                        valB = profitB > 0 ? (b.calculatedPrice / profitB) : 99999;
                        break;
                    case 'efficiency': valA = a.powerWatts / a.hashrateTH; valB = b.powerWatts / b.hashrateTH; break;
                    case 'revenue': valA = a.dailyRevenueUSD; valB = b.dailyRevenueUSD; break;
                }
                return (valA - valB) * direction;
            });
    }, [results, searchTerm, sortBy, sortOrder]);

    // Ref for PDF generation
    const documentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function load() {
            setLoading(true);
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
            setLoading(false);
        }
        load();
    }, []);

    useEffect(() => {
        calculate();
    }, [market, marginValue, marginMode]);

    const calculate = () => {
        const miners = INITIAL_MINERS;
        const calculated = miners.map(miner => {
            const contract: ContractTerms = {
                electricityRate: 0.08, // Default, maybe make adjustable?
                opexRate: 0,
                poolFee: 1.0,
                contractDurationYears: 4 // Default
            };

            const targetProfit = marginMode === 'percent' ? marginValue : 50;

            return solveMinerPrice(miner, contract, market, targetProfit, false);
        });

        // Sort by name for the list, or price
        calculated.sort((a, b) => b.calculatedPrice - a.calculatedPrice);
        setResults(calculated);

        // Generate Recommendations
        const ranked = rankMiners(calculated);
        if (ranked.length > 0) {
            // Clone for different sorts to avoid mutating reference issues if sort was in-place (it usually is)
            const byROI = [...ranked].sort((a, b) => b.raw.profitability - a.raw.profitability).slice(0, 2);
            const byRev = [...ranked].sort((a, b) => b.raw.revenue - a.raw.revenue).slice(0, 2);
            const byEff = [...ranked].sort((a, b) => a.raw.efficiency - b.raw.efficiency).slice(0, 2); // Lower is better

            setRecommendations({
                topROI: byROI,
                topRevenue: byRev,
                topEfficiency: byEff
            });
        }
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

            // Calculate height in PDF mm based on aspect ratio
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

    const handleExportCSV = () => {
        const headers = ['Model', 'Hashrate (TH/s)', 'Power (W)', 'Efficiency (J/TH)', 'Unit Price ($)', 'Daily Revenue ($)', 'Payback (Years)', 'ROI (%)'];
        const rows = filteredResults.map(r => {
            const dailyProfit = r.dailyRevenueUSD - r.dailyExpenseUSD;
            const paybackYears = dailyProfit > 0 ? ((r.calculatedPrice / dailyProfit) / 365).toFixed(1) : 'N/A';
            return [
                r.name,
                r.hashrateTH,
                r.powerWatts,
                (r.powerWatts / r.hashrateTH).toFixed(1),
                r.calculatedPrice.toFixed(0),
                r.dailyRevenueUSD.toFixed(2),
                paybackYears,
                r.clientProfitabilityPercent.toFixed(0) + '%'
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

    return (
        <div className="space-y-8 p-4">

            {/* Control Panel */}
            <Card className="border-l-4 border-l-blue-600">
                <CardHeader>
                    <CardTitle>Price List Configuration</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-6 items-end">
                    <div className="w-full md:w-1/3 space-y-2">
                        <Label>Client Name</Label>
                        <Input
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            placeholder="Enter Client Name"
                        />
                    </div>

                    <div className="w-full md:w-1/4 space-y-2">
                        <Label>Client Target Margin (ROI)</Label>
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                value={marginValue}
                                onChange={(e) => setMarginValue(Number(e.target.value))}
                            />
                            <div className="flex items-center bg-muted px-3 rounded-md text-sm font-medium">
                                %
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <Button variant="outline" onClick={handleExportCSV}>
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                        <Button onClick={handleDownloadPDF}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Export PDF
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Filter / Sort Controls */}
            <div className="flex gap-4 items-center bg-white p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search models..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="roi">Sort by ROI</SelectItem>
                        <SelectItem value="price">Sort by Price</SelectItem>
                        <SelectItem value="payback">Sort by Payback</SelectItem>
                        <SelectItem value="revenue">Sort by Revenue</SelectItem>
                        <SelectItem value="efficiency">Sort by Efficiency</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                    <ArrowUpDown className={`h-4 w-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                </Button>
            </div>

            {/* Interactive Table View */}
            <div className="rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="hover:bg-slate-50">
                            <TableHead className="font-bold text-slate-900 py-3 pl-4">Model</TableHead>
                            <TableHead className="text-right font-bold text-slate-700 py-3">Hashrate</TableHead>
                            <TableHead className="text-right font-bold text-slate-700 py-3">Power</TableHead>
                            <TableHead className="text-right font-bold text-slate-700 py-3">Eff</TableHead>
                            <TableHead className="text-right font-bold text-emerald-600 py-3">Daily Rev</TableHead>
                            <TableHead className="text-right font-bold text-blue-600 py-3">ROI</TableHead>
                            <TableHead className="text-right font-bold text-amber-600 py-3">Payback</TableHead>
                            <TableHead className="text-right font-bold text-slate-900 py-3 pr-4">Unit Price</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredResults.map((r, i) => {
                            const dailyProfit = r.dailyRevenueUSD - r.dailyExpenseUSD;
                            const paybackYears = dailyProfit > 0 ? ((r.calculatedPrice / dailyProfit) / 365).toFixed(1) : 'N/A';
                            return (
                                <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 h-10">
                                    <TableCell className="font-semibold text-slate-800 pl-4 py-2 text-sm">{r.name}</TableCell>
                                    <TableCell className="text-right text-slate-600 py-2 text-sm">{r.hashrateTH} T</TableCell>
                                    <TableCell className="text-right text-slate-600 py-2 text-sm">{r.powerWatts} W</TableCell>
                                    <TableCell className="text-right text-slate-600 py-2 text-sm">{(r.powerWatts / r.hashrateTH).toFixed(1)}</TableCell>
                                    <TableCell className="text-right font-bold text-emerald-600 py-2 text-sm">
                                        ${r.dailyRevenueUSD.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-blue-600 py-2 text-sm">
                                        {r.clientProfitabilityPercent.toFixed(0)}%
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-amber-600 py-2 text-sm">
                                        {paybackYears} <span className="text-xs font-normal text-slate-400">yrs</span>
                                    </TableCell>
                                    <TableCell className="text-right font-extrabold text-lg text-slate-900 pr-4 py-2">
                                        ${r.calculatedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Hidden Document Template for PDF Generation */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <ProposalDocument
                    ref={documentRef}
                    clientName={clientName}
                    recommendations={recommendations}
                    filteredResults={filteredResults}
                />
            </div>
        </div >
    );
}

// ----------------------------------------------------------------------
// Reusable Proposal Document Component
// ----------------------------------------------------------------------

interface ProposalDocumentProps {
    clientName: string;
    recommendations: {
        topROI: MinerScoreDetail[];
        topRevenue: MinerScoreDetail[];
        topEfficiency: MinerScoreDetail[];
    };
    filteredResults: SolvedMiner[];
}

const ProposalDocument = React.forwardRef<HTMLDivElement, ProposalDocumentProps>(({ clientName, recommendations, filteredResults }, ref) => {
    return (
        <div
            ref={ref}
            className="bg-white p-6 shadow-none border-none w-[210mm] text-slate-900"
            style={{ minHeight: 'fit-content' }}
        >

            {/* Header / Brand */}
            <div className="flex justify-between items-start mb-8 border-b pb-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Segments Cloud</h1>
                    <p className="text-slate-500 font-medium mt-1">Enterprise Mining Solutions</p>
                </div>
                <div className="text-right text-sm text-slate-500">
                    <p>{new Date().toLocaleDateString()}</p>
                    <p className="mt-1">Prepared for: <span className="font-semibold text-slate-900 block text-base">{clientName || 'Valued Client'}</span></p>
                </div>
            </div>

            {/* Letter */}
            <div className="mb-8 prose prose-slate max-w-none">
                <h3 className="text-lg font-semibold mb-2 text-slate-800">Proposal for Bitcoin Mining Infrastructure</h3>
                <p className="mb-2 text-sm leading-relaxed text-slate-600">
                    Dear {clientName || 'Partner'},
                </p>
                <p className="mb-2 text-sm leading-relaxed text-slate-600">
                    We are pleased to present our latest pricing for premium Bitcoin mining hardware hosted at our facilities.
                    Segments Cloud is dedicated to providing high-performance infrastructure with optimized efficiency.
                </p>

                {/* Recommendations Section */}
                {(recommendations.topROI.length > 0) && (
                    <div className="my-4 bg-slate-50 p-4 rounded-md border border-slate-100">
                        <h4 className="text-sm font-bold text-slate-800 mb-2">Strategic Recommendations</h4>
                        <ul className="text-sm space-y-1 text-slate-600 list-disc list-inside">
                            <li>
                                <span className="font-semibold text-emerald-600">Highest ROI:</span> {recommendations.topROI.map(r => r.miner.name).join(' & ')}
                            </li>
                            <li>
                                <span className="font-semibold text-blue-600">Best Daily Revenue:</span> {recommendations.topRevenue.map(r => r.miner.name).join(' & ')}
                            </li>
                            <li>
                                <span className="font-semibold text-amber-600">Most Efficient:</span> {recommendations.topEfficiency.map(r => r.miner.name).join(' & ')}
                            </li>
                        </ul>
                    </div>
                )}

                <p className="text-sm leading-relaxed text-slate-600">
                    The table below outlines our current offering, specifically selected to meet your investment goals.
                </p>
            </div>

            {/* Price Table - Compact for PDF (A4) */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-800">
                        Hardware Configuration & Pricing
                    </h3>
                </div>
                <div className="rounded-lg overflow-hidden border border-slate-200">
                    <Table className="w-full table-fixed">
                        <TableHeader className="bg-slate-900">
                            <TableRow className="hover:bg-slate-900 border-none">
                                <TableHead className="font-bold text-white py-1 pl-2 h-8 text-xs w-[20%]">Model</TableHead>
                                <TableHead className="text-right font-bold text-slate-200 py-1 h-8 text-xs w-[12%]">Hashrate</TableHead>
                                <TableHead className="text-right font-bold text-slate-200 py-1 h-8 text-xs w-[12%]">Power</TableHead>
                                <TableHead className="text-right font-bold text-slate-200 py-1 h-8 text-xs w-[10%]">Eff</TableHead>
                                <TableHead className="text-right font-bold text-emerald-300 py-1 h-8 text-xs w-[12%]">Daily Rev</TableHead>
                                <TableHead className="text-right font-bold text-blue-300 py-1 h-8 text-xs w-[10%]">ROI</TableHead>
                                <TableHead className="text-right font-bold text-amber-300 py-1 h-8 text-xs w-[12%]">Payback</TableHead>
                                <TableHead className="text-right font-bold text-white py-1 pr-2 h-8 text-xs w-[12%]">Unit Price</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredResults.map((r, i) => {
                                const dailyProfit = r.dailyRevenueUSD - r.dailyExpenseUSD;
                                const paybackYears = dailyProfit > 0 ? ((r.calculatedPrice / dailyProfit) / 365).toFixed(1) : 'N/A';
                                return (
                                    <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 h-8">
                                        <TableCell className="font-semibold text-slate-800 pl-2 py-1 text-xs truncate">{r.name}</TableCell>
                                        <TableCell className="text-right text-slate-600 py-1 text-xs">{r.hashrateTH} T</TableCell>
                                        <TableCell className="text-right text-slate-600 py-1 text-xs">{r.powerWatts} W</TableCell>
                                        <TableCell className="text-right text-slate-600 py-1 text-xs">{(r.powerWatts / r.hashrateTH).toFixed(1)}</TableCell>
                                        <TableCell className="text-right font-bold text-emerald-600 py-1 text-xs">
                                            ${r.dailyRevenueUSD.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-blue-600 py-1 text-xs">
                                            {r.clientProfitabilityPercent.toFixed(0)}%
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-amber-600 py-1 text-xs">
                                            {paybackYears} <span className="text-[10px] font-normal text-slate-400">yrs</span>
                                        </TableCell>
                                        <TableCell className="text-right font-extrabold text-sm text-slate-900 pr-2 py-1">
                                            ${r.calculatedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Terms / Footer */}
            <div className="text-xs text-slate-500 border-t pt-4 mt-auto">
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-semibold text-slate-700 mb-1">Terms & Conditions</h4>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                            <li>Prices are subject to change based on market conditions.</li>
                            <li>Hosting rates and terms are defined in the Hosting Service Agreement.</li>
                        </ul>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-slate-900">Segments Cloud</p>
                        <p>www.segments.ae</p>
                    </div>
                </div>
                <div className="mt-4 text-center text-slate-400">
                    Generated on {new Date().toLocaleDateString()}
                </div>
            </div>
        </div>
    );
});
ProposalDocument.displayName = 'ProposalDocument';
