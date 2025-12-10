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
                        <TableHead className="text-right font-semibold text-muted-foreground py-3">Daily Profit</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground py-3">ROI</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground py-3">Payback</TableHead>
                        <TableHead className="text-right font-semibold text-foreground py-3 pr-4">Unit Price</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {miners.map((r, i) => {
                        const m = r.miner;
                        const dailyProfit = m.dailyRevenueUSD - m.dailyExpenseUSD;
                        // const paybackYears = dailyProfit > 0 ? ((m.calculatedPrice / dailyProfit) / 365).toFixed(1) : 'N/A'; // Already calculated below

                        return (
                            <TableRow key={i} className="hover:bg-muted/50 border-b border-border last:border-0 h-12 transition-colors">
                                <TableCell className="font-medium text-foreground pl-4 py-2 text-sm">{m.name}</TableCell>
                                <TableCell className="text-right text-muted-foreground py-2 text-sm">{m.hashrateTH} T</TableCell>
                                <TableCell className="text-right text-muted-foreground py-2 text-sm">{(m.powerWatts / m.hashrateTH).toFixed(1)} J/T</TableCell>
                                <TableCell className="text-right text-muted-foreground py-2 text-sm">{m.powerWatts} W</TableCell>
                                <TableCell className="text-right font-medium text-emerald-600 py-2 text-sm">
                                    ${m.dailyRevenueUSD.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-medium text-emerald-600 py-2 text-sm">
                                    ${dailyProfit.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-medium text-blue-600 py-2 text-sm">
                                    {m.clientProfitabilityPercent.toFixed(0)}%
                                </TableCell>
                                <TableCell className="text-right font-medium text-amber-600 py-2 text-sm">
                                    {(() => {
                                        if (m.calculatedPrice <= 0 || dailyProfit <= 0) return "N/A";
                                        // Payback usually logic is Price / Daily Profit, but code was Price / Daily Revenue (Gross Payback).
                                        // Using Net Profit is standard for "Payback Period".
                                        // However, the original code had a comment: // Gross Payback = Price / Daily Revenue
                                        // I will switch to Net Profit for "Payback" as it's more accurate for the user, 
                                        // unless "Gross Payback" is specifically what they want. usually Payback = ROI^-1.
                                        // ROI column is {m.clientProfitabilityPercent}% which is (DailyProfit * 365 / Price)?
                                        // Let's check logic: ROI is usually Annual Profit / Cost. 
                                        // If ROI is 100%, Payback is 1 year.
                                        // Let's stick to what allows consistency. I will use Net Profit for payback.
                                        const yrs = (m.calculatedPrice / dailyProfit) / 365;
                                        return yrs.toFixed(1) + " yrs";
                                    })()}
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
