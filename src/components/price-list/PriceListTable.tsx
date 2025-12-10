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
                <TableHeader className="bg-slate-50">
                    <TableRow className="hover:bg-slate-50">
                        <TableHead className="font-bold text-slate-900 py-3 pl-4">Model</TableHead>
                        <TableHead className="text-center font-bold text-purple-600 py-3">Score</TableHead>
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
                    {miners.map((r, i) => {
                        const m = r.miner;
                        const dailyProfit = m.dailyRevenueUSD - m.dailyExpenseUSD;
                        const paybackYears = dailyProfit > 0 ? ((m.calculatedPrice / dailyProfit) / 365).toFixed(1) : 'N/A';
                        return (
                            <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 h-10">
                                <TableCell className="font-semibold text-slate-800 pl-4 py-2 text-sm">{m.name}</TableCell>
                                <TableCell className="text-center font-bold text-purple-600 py-2 text-sm">{r.score.toFixed(0)}</TableCell>
                                <TableCell className="text-right text-slate-600 py-2 text-sm">{m.hashrateTH} T</TableCell>
                                <TableCell className="text-right text-slate-600 py-2 text-sm">{m.powerWatts} W</TableCell>
                                <TableCell className="text-right text-slate-600 py-2 text-sm">{(m.powerWatts / m.hashrateTH).toFixed(1)}</TableCell>
                                <TableCell className="text-right font-bold text-emerald-600 py-2 text-sm">
                                    ${m.dailyRevenueUSD.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-bold text-blue-600 py-2 text-sm">
                                    {m.clientProfitabilityPercent.toFixed(0)}%
                                </TableCell>
                                <TableCell className="text-right font-bold text-amber-600 py-2 text-sm">
                                    {(() => {
                                        if (m.calculatedPrice <= 0 || m.dailyRevenueUSD <= 0) return "N/A";
                                        // Gross Payback = Price / Daily Revenue
                                        const yrs = (m.calculatedPrice / m.dailyRevenueUSD) / 365;
                                        return yrs.toFixed(1) + " yrs";
                                    })()}
                                </TableCell>
                                <TableCell className="text-right font-extrabold text-lg text-slate-900 pr-4 py-2">
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
