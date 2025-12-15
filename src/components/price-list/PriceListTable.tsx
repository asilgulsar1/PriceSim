"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MinerScoreDetail } from "@/lib/miner-scoring";
import { Badge } from "@/components/ui/badge";
interface PriceListTableProps {
    miners: MinerScoreDetail[];
}

export function PriceListTable({ miners }: PriceListTableProps) {
    return (
        <div className="rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white">

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 p-4 bg-muted/20">
                {miners.map((r, i) => {
                    const m = r.miner;
                    let paybackYears = "N/A";
                    let grossROI = 0;

                    if (m.dailyRevenueUSD > 0 && m.calculatedPrice > 0) {
                        const years = (m.calculatedPrice / m.dailyRevenueUSD) / 365;
                        paybackYears = years.toFixed(1) + " yrs";
                        grossROI = ((m.dailyRevenueUSD * 365) / m.calculatedPrice) * 100;
                    }

                    return (
                        <div key={i} className="bg-white p-4 rounded-lg border shadow-sm space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="font-bold text-lg block leading-tight text-foreground">
                                        {m.name}
                                    </span>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {m.hashrateTH} TH/s • {m.powerWatts} W • {(m.powerWatts / m.hashrateTH).toFixed(1)} J/T
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-lg text-foreground">
                                        ${m.calculatedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-sm border-t pt-2">
                                <div className="text-center">
                                    <span className="block text-xs text-muted-foreground">Daily Rev</span>
                                    <span className="font-medium text-emerald-600">${m.dailyRevenueUSD.toFixed(2)}</span>
                                </div>
                                <div className="text-center">
                                    <span className="block text-xs text-muted-foreground">Gross ROI</span>
                                    <span className="font-medium text-blue-600">{grossROI.toFixed(0)}%</span>
                                </div>
                                <div className="text-center">
                                    <span className="block text-xs text-muted-foreground">Payback</span>
                                    <span className="font-medium text-amber-600">{paybackYears}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop Table View */}
            <Table className="hidden md:table">
                <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-muted/50">
                        <TableHead className="font-semibold text-foreground py-3 pl-4">Model</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground py-3">Hashrate</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground py-3">Efficiency</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground py-3">Power</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground py-3">Daily Rev</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground py-3">Gross ROI</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground py-3">Payback</TableHead>
                        <TableHead className="text-right font-semibold text-foreground py-3 pr-4">Unit Price</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {miners.map((r, i) => {
                        const m = r.miner;

                        // Gross Logic
                        let paybackYears = "N/A";
                        let grossROI = 0;

                        if (m.dailyRevenueUSD > 0 && m.calculatedPrice > 0) {
                            const years = (m.calculatedPrice / m.dailyRevenueUSD) / 365;
                            paybackYears = years.toFixed(1) + " yrs";
                            grossROI = ((m.dailyRevenueUSD * 365) / m.calculatedPrice) * 100;
                        }


                        return (

                            <TableRow key={i} className="hover:bg-muted/50 border-b border-border last:border-0 h-12 transition-colors">
                                <TableCell className="font-medium text-foreground pl-4 py-2 text-sm">
                                    <span className="text-foreground">
                                        {m.name}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground py-2 text-sm">{m.hashrateTH} T</TableCell>
                                <TableCell className="text-right text-muted-foreground py-2 text-sm">{(m.powerWatts / m.hashrateTH).toFixed(1)} J/T</TableCell>
                                <TableCell className="text-right text-muted-foreground py-2 text-sm">{m.powerWatts} W</TableCell>
                                <TableCell className="text-right font-medium text-emerald-600 py-2 text-sm">
                                    ${m.dailyRevenueUSD.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-medium text-blue-600 py-2 text-sm">
                                    {grossROI.toFixed(0)}%
                                </TableCell>
                                <TableCell className="text-right font-medium text-amber-600 py-2 text-sm">
                                    {paybackYears}
                                </TableCell>
                                <TableCell className="text-right font-bold text-lg text-foreground pr-4 py-2">
                                    ${m.calculatedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
