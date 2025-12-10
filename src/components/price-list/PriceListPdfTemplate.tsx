"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MinerScoreDetail } from "@/lib/miner-scoring";

interface Recommendations {
    topROI: MinerScoreDetail[];
    topRevenue: MinerScoreDetail[];
    topEfficiency: MinerScoreDetail[];
}

interface PriceListPdfTemplateProps {
    documentRef: React.RefObject<HTMLDivElement | null>; // Fix: Explicitly allow null
    clientName: string;
    recommendations: Recommendations;
    filteredResults: MinerScoreDetail[];
}

export function PriceListPdfTemplate({
    documentRef,
    clientName,
    recommendations,
    filteredResults
}: PriceListPdfTemplateProps) {
    return (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            <div
                ref={documentRef}
                className="bg-white p-12 shadow-none border-none w-[210mm] text-slate-900"
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

                {/* Price Table */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-slate-800">
                            Hardware Configuration & Pricing
                        </h3>
                    </div>
                    <div className="rounded-lg overflow-hidden border border-slate-200">
                        <Table>
                            <TableHeader className="bg-slate-900">
                                <TableRow className="hover:bg-slate-900 border-none">
                                    <TableHead className="font-bold text-white py-2 pl-4 h-10">Model</TableHead>
                                    <TableHead className="text-right font-bold text-white py-2 h-10">Score</TableHead>
                                    <TableHead className="text-right font-bold text-slate-200 py-2 h-10">Hashrate</TableHead>
                                    <TableHead className="text-right font-bold text-slate-200 py-2 h-10">Power</TableHead>
                                    <TableHead className="text-right font-bold text-slate-200 py-2 h-10">Eff</TableHead>
                                    <TableHead className="text-right font-bold text-emerald-300 py-2 h-10">Daily Rev</TableHead>
                                    <TableHead className="text-right font-bold text-blue-300 py-2 h-10">ROI</TableHead>
                                    <TableHead className="text-right font-bold text-amber-300 py-2 h-10">Payback</TableHead>
                                    <TableHead className="text-right font-bold text-white py-2 pr-4 h-10">Unit Price</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredResults.map((r, i) => {
                                    const m = r.miner;
                                    const dailyProfit = m.dailyRevenueUSD - m.dailyExpenseUSD;
                                    const paybackYears = dailyProfit > 0 ? ((m.calculatedPrice / dailyProfit) / 365).toFixed(1) : 'N/A';
                                    return (
                                        <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 h-10">
                                            <TableCell className="font-semibold text-slate-800 pl-4 py-2 text-sm">{m.name}</TableCell>
                                            <TableCell className="text-right font-bold text-white py-2 text-sm">{r.score.toFixed(0)}</TableCell>
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
                                                {paybackYears} <span className="text-xs font-normal text-slate-400">yrs</span>
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
        </div>
    );
}
