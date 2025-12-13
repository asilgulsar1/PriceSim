
'use client';

import { cn } from "@/lib/utils";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowUpDown, Search, Download } from "lucide-react";
import { CalculatedMiner, DailyProjection } from "@/lib/price-simulator-calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PriceSimulatorTableProps {
    results: CalculatedMiner[];
    sortConfig: { key: keyof CalculatedMiner; direction: 'asc' | 'desc' };
    setSortConfig: (config: { key: keyof CalculatedMiner; direction: 'asc' | 'desc' }) => void;
    filterText: string;
    setFilterText: (text: string) => void;
    filterCooling: string;
    setFilterCooling: (val: string) => void;
    durationYears: number;
}

export function PriceSimulatorTable({
    results,
    sortConfig,
    setSortConfig,
    filterText,
    setFilterText,
    filterCooling,
    setFilterCooling,
    durationYears
}: PriceSimulatorTableProps) {

    const exportToCSV = (minerName: string, projections: DailyProjection[]) => {
        const headers = [
            'Day', 'Date', 'BTC Price', 'Difficulty', 'Production (BTC)', 'Production ($)',
            'Hosting ($)', 'Net Profit ($)', 'BTC Held', 'BTC Price Gain ($)',
            'Net Treasury Change (BTC)', 'Net Treasury Change ($)', 'Cash Balance ($)',
            'Portfolio Value ($)', 'Closing BTC Treasury (BTC)'
        ];

        const rows = projections.map((day, j) => {
            const prevDay = j > 0 ? projections[j - 1] : null;
            const btcPriceGainUSD = prevDay && !day.isShutdown
                ? prevDay.btcHeld * (day.btcPrice - prevDay.btcPrice)
                : 0;

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

        const csvContent = [headers.join(','), ...rows].join('\n');
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

    const handleSort = (key: keyof CalculatedMiner) => {
        setSortConfig({
            key,
            direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
        });
    };

    const filteredMiners = results
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
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }
            return 0;
        });

    return (
        <div className="space-y-6">
            {/* Filters */}
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
                    Showing {filteredMiners.length} models
                </div>
            </div>

            {/* Table */}
            <Card>
                <CardHeader className="pb-3 border-b mb-2 md:mb-0 md:border-b-0">
                    <CardTitle>Miner Pricing Results</CardTitle>
                </CardHeader>
                <CardContent className="p-0 md:p-6">
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4 p-4">
                        {filteredMiners.map((r, i) => (
                            <div key={i} className="bg-white rounded-lg border shadow-sm p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg leading-tight">{r.name}</h3>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {r.hashrateTH} TH/s • {r.powerWatts} W • {(r.powerWatts / r.hashrateTH).toFixed(1)} J/T
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-emerald-600 text-lg">
                                            ${r.calculatedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                        <div className="text-xs text-muted-foreground">Target Price</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                                    <div>
                                        <span className="text-muted-foreground text-xs block">Daily Rev</span>
                                        <span className="font-medium text-emerald-600">${r.dailyRevenueUSD.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-xs block">Daily Exp</span>
                                        <span className="font-medium text-amber-600">${r.dailyExpenseUSD.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-xs block">Profitability</span>
                                        <span className="font-medium">{r.clientProfitabilityPercent.toFixed(0)}%</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-xs block">Treasury</span>
                                        <span className={cn("font-medium", r.finalTreasuryUSD >= 0 ? "text-green-600" : "text-red-600")}>
                                            ${r.finalTreasuryUSD.toLocaleString(undefined, { notation: "compact" })}
                                        </span>
                                    </div>
                                </div>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="w-full mt-2">View Analysis</Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle>Daily Logs - {r.name}</DialogTitle>
                                        </DialogHeader>
                                        <div className="overflow-x-auto">
                                            {/* Reuse table logic in dialog or simplified view */}
                                            <Table className="min-w-[800px]">
                                                {/* ... same logs header ... */}
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Day</TableHead>
                                                        <TableHead>BTC Price</TableHead>
                                                        <TableHead>Net Profit</TableHead>
                                                        <TableHead>Treasury</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {r.projections.slice(0, 50).map((day, j) => (
                                                        <TableRow key={j}>
                                                            <TableCell>{day.dayIndex + 1}</TableCell>
                                                            <TableCell>${day.btcPrice.toFixed(0)}</TableCell>
                                                            <TableCell className={day.dailyProfitUSD >= 0 ? "text-green-600" : "text-red-600"}>${day.dailyProfitUSD.toFixed(2)}</TableCell>
                                                            <TableCell>${day.cashBalance.toFixed(0)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {r.projections.length > 50 && <TableRow><TableCell colSpan={4}>... showing first 50 days only on mobile detail ...</TableCell></TableRow>}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table View */}
                    <Table className="hidden md:table">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                                    <div className="flex items-center gap-1">Miner Model <ArrowUpDown className="h-3 w-3" /></div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('calculatedPrice')}>
                                    <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold">Suggested Price <ArrowUpDown className="h-3 w-3" /></div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('clientProfitabilityPercent')}>
                                    <div className="flex items-center justify-end gap-1">Client Profitability <ArrowUpDown className="h-3 w-3" /></div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('dailyRevenueUSD')}>
                                    <div className="flex items-center justify-end gap-1">Daily Rev <ArrowUpDown className="h-3 w-3" /></div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('dailyExpenseUSD')}>
                                    <div className="flex items-center justify-end gap-1">Daily Exp <ArrowUpDown className="h-3 w-3" /></div>
                                </TableHead>
                                <TableHead>Specs</TableHead>
                                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('finalTreasuryUSD')}>
                                    <div className="flex items-center gap-1">Final Treasury (USD) <ArrowUpDown className="h-3 w-3" /></div>
                                </TableHead>
                                <TableHead>Final Treasury (BTC)</TableHead>
                                <TableHead>Project Life</TableHead>
                                <TableHead>Est. Expense (BTC)</TableHead>
                                <TableHead>Est. Revenue (BTC)</TableHead>
                                <TableHead>Logs</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredMiners.map((r, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">{r.name}</TableCell>
                                    <TableCell className="text-right">
                                        {r.calculatedPrice > 0 ? (
                                            <span className="font-bold text-emerald-600">${r.calculatedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        ) : (
                                            <span className="text-red-500 font-medium">Negative Price</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">{r.clientProfitabilityPercent.toFixed(2)}%</TableCell>
                                    <TableCell className="text-right font-medium text-emerald-600">${r.dailyRevenueUSD.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-medium text-amber-600">${r.dailyExpenseUSD.toFixed(2)}</TableCell>
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
                                                        <Download className="mr-2 h-4 w-4" /> Export CSV
                                                    </Button>
                                                </DialogHeader>
                                                <div className="h-[60vh] overflow-auto">
                                                    <Table className="w-max min-w-full whitespace-nowrap">
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Day</TableHead>
                                                                <TableHead>Date</TableHead>
                                                                <TableHead>BTC Price</TableHead>
                                                                <TableHead>Difficulty</TableHead>
                                                                <TableHead>Production (BTC)</TableHead>
                                                                <TableHead>Production ($)</TableHead>
                                                                <TableHead>Hosting ($)</TableHead>
                                                                <TableHead>Net Profit ($)</TableHead>
                                                                <TableHead>BTC Held</TableHead>
                                                                <TableHead>BTC Price Gain ($)</TableHead>
                                                                <TableHead>Treasury Change (BTC)</TableHead>
                                                                <TableHead>Treasury Change ($)</TableHead>
                                                                <TableHead>Cash ($)</TableHead>
                                                                <TableHead>Portfolio ($)</TableHead>
                                                                <TableHead>Closing Treasury (BTC)</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {r.projections.map((day, j) => {
                                                                const prevDay = j > 0 ? r.projections[j - 1] : null;
                                                                const btcPriceGainUSD = prevDay && !day.isShutdown
                                                                    ? prevDay.btcHeld * (day.btcPrice - prevDay.btcPrice)
                                                                    : 0;
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
                                                                        <TableCell className={day.dailyProfitUSD >= 0 ? "text-green-600" : "text-red-600"}>${day.dailyProfitUSD.toFixed(2)}</TableCell>
                                                                        <TableCell>{day.btcHeld.toFixed(6)}</TableCell>
                                                                        <TableCell className={btcPriceGainUSD >= 0 ? "text-green-600" : "text-red-600"}>${btcPriceGainUSD.toFixed(2)}</TableCell>
                                                                        <TableCell className={netTreasuryChangeBTC >= 0 ? "text-green-600" : "text-red-600"}>{netTreasuryChangeBTC.toFixed(6)} BTC</TableCell>
                                                                        <TableCell className={netTreasuryChangeUSD >= 0 ? "text-green-600" : "text-red-600"}>${netTreasuryChangeUSD.toFixed(2)}</TableCell>
                                                                        <TableCell className={day.cashBalance >= 0 ? "text-green-600" : "text-red-600"}>${day.cashBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                                                        <TableCell className="font-bold">${day.portfolioValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                                                        <TableCell>{day.btcHeld.toFixed(8)} BTC</TableCell>
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
