"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MinerScoreDetail } from "@/lib/miner-scoring";

interface PriceListTableProps {
    miners: MinerScoreDetail[];
}

export function PriceListTable({ miners }: PriceListTableProps) {
    return (
        <div className="rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white">
            <Table>
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
                                <TableCell className="font-medium text-foreground pl-4 py-2 text-sm">{m.name}</TableCell>
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
