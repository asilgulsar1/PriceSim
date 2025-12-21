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
                    const dailyProfit = m.dailyRevenueUSD - (m.dailyExpenseUSD || 0);

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
                                    <span className="block font-bold text-lg text-primary">
                                        ${m.calculatedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="text-xs text-muted-foreground">Unit Price</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t pt-3">
                                <div>
                                    <span className="text-xs text-muted-foreground block">Daily Net</span>
                                    <span className="font-medium text-green-600">
                                        ${dailyProfit.toFixed(2)}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-muted-foreground block">ROI (Annual)</span>
                                    <span className="font-medium text-blue-600">
                                        {m.clientProfitabilityPercent.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop Table View */}
            <Table className="hidden md:table">
                <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-[30%]">Miner Model</TableHead>
                        <TableHead className="text-right">Hashrate</TableHead>
                        <TableHead className="text-right">Power</TableHead>
                        <TableHead className="text-right">Daily Rev</TableHead>
                        <TableHead className="text-right">Daily Exp</TableHead>
                        <TableHead className="text-right">Daily Net</TableHead>
                        <TableHead className="text-right">ROI</TableHead>
                        <TableHead className="text-right pr-4">Unit Price</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {miners.map((r, i) => {
                        const m = r.miner;
                        const dailyProfit = m.dailyRevenueUSD - (m.dailyExpenseUSD || 0);
                        const roi = m.clientProfitabilityPercent;

                        return (
                            <TableRow key={i} className="hover:bg-muted/50 border-b border-border last:border-0 h-12 transition-colors">
                                <TableCell className="font-medium text-foreground">
                                    {m.name}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                    {m.hashrateTH} TH
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                    {m.powerWatts} W
                                </TableCell>
                                <TableCell className="text-right text-green-600">
                                    ${m.dailyRevenueUSD.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right text-red-500">
                                    -${m.dailyExpenseUSD.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-medium text-green-700">
                                    ${dailyProfit.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-medium text-blue-600">
                                    {roi.toFixed(1)}%
                                </TableCell>
                                <TableCell className="text-right font-bold text-lg text-foreground pr-4">
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
