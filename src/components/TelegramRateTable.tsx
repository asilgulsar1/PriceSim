"use client";

import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMarketData } from "@/hooks/useMarketData";
import { INITIAL_MINERS } from "@/lib/miner-data";
import { normalizeMinerName } from "@/lib/market-matching";
import { calculateHashpriceUSD, calculateMinerRevenueUSD } from "@/lib/mining-math";
import { DEFAULT_CONTRACT_TERMS } from "@/lib/constants";

interface TelegramRateTableProps {
    telegramMiners: any[];
}

export function TelegramRateTable({ telegramMiners }: TelegramRateTableProps) {
    const { market } = useMarketData();

    // Enrich Data
    const enrichedData = useMemo(() => {
        if (!telegramMiners || !Array.isArray(telegramMiners)) return [];

        let liveHashpriceUSD = 0;
        if (market.networkDifficulty > 0 && market.btcPrice > 0) {
            liveHashpriceUSD = calculateHashpriceUSD(market.networkDifficulty, market.blockReward, market.btcPrice);
        }

        return telegramMiners.filter(tg => tg.name).map(tg => {
            // 1. Find Specs (Power)
            const normTg = normalizeMinerName(tg.name);
            const match = INITIAL_MINERS.find(m => normalizeMinerName(m.name).includes(normTg) || normTg.includes(normalizeMinerName(m.name)));

            let powerW = 0;
            if (match) {
                powerW = match.powerWatts;
            } else if (tg.specs?.powerW > 0) {
                powerW = tg.specs.powerW;
            } else {
                // Estimator
                if (tg.hashrateTH > 300) powerW = tg.hashrateTH * 16; // S21-class
                else if (tg.hashrateTH > 200) powerW = tg.hashrateTH * 19; // S19 XP
                else powerW = tg.hashrateTH * 22; // S19 Pro
            }

            // 2. Calculate Financials
            let dailyRevenueUSD = 0;
            if (liveHashpriceUSD > 0 && tg.hashrateTH > 0) {
                dailyRevenueUSD = calculateMinerRevenueUSD(tg.hashrateTH, liveHashpriceUSD, 1.0); // 1% pool fee assumed
            }

            const kwhPrice = DEFAULT_CONTRACT_TERMS.electricityRate || 0.055;
            const dailyExpenseUSD = (powerW / 1000) * 24 * kwhPrice;
            const dailyNet = dailyRevenueUSD - dailyExpenseUSD;

            // 3. ROI (Annual)
            let roi = 0;
            if (tg.price > 0 && dailyRevenueUSD > 0) {
                roi = ((dailyRevenueUSD * 365) / tg.price) * 100; // Gross Revenue ROI? Or Net?
                // Price List usually shows "Client Profitability" on Revenue basis for specific formula, 
                // OR Net ROI. 
                // Let's use standard: (Net Annual / Price) * 100
                if (dailyNet > 0) {
                    roi = ((dailyNet * 365) / tg.price) * 100;
                } else {
                    roi = 0;
                }
            }

            return {
                ...tg,
                powerW,
                dailyRevenueUSD,
                dailyExpenseUSD,
                dailyNet,
                roi,
                matchName: match ? match.name : 'Estimated'
            };
        }).sort((a, b) => b.hashrateTH - a.hashrateTH); // Default sort by hashrate
    }, [telegramMiners, market]);

    if (!telegramMiners || !Array.isArray(telegramMiners) || telegramMiners.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">No recent Telegram data found in snapshot.</div>;
    }

    return (
        <div className="rounded-lg border shadow-sm bg-card">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead>Miner Model</TableHead>
                        <TableHead className="text-right">Hashrate</TableHead>
                        <TableHead className="text-right">Power</TableHead>
                        <TableHead className="text-right">Daily Rev</TableHead>
                        <TableHead className="text-right">Daily Exp</TableHead>
                        <TableHead className="text-right">Daily Net</TableHead>
                        <TableHead className="text-right">ROI (Net)</TableHead>
                        <TableHead className="text-right">Telegram Price</TableHead>
                        <TableHead className="text-right">Source</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {enrichedData.map((m: any, i: number) => (
                        <TableRow key={i} className="hover:bg-muted/50">
                            <TableCell className="font-medium">
                                {m.name}
                                {m.matchName === 'Estimated' && <span className="ml-2 text-[10px] text-amber-500">(Est. Power)</span>}
                            </TableCell>
                            <TableCell className="text-right">{m.hashrateTH} TH</TableCell>
                            <TableCell className="text-right">{m.powerW.toFixed(0)} W</TableCell>
                            <TableCell className="text-right text-green-600">${m.dailyRevenueUSD.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-red-500">-${m.dailyExpenseUSD.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-bold text-green-700">${m.dailyNet.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono text-blue-600">{m.roi.toFixed(1)}%</TableCell>
                            <TableCell className="text-right font-bold text-lg">${m.price.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                                {m.listings && m.listings.length > 0 ? (
                                    <div className="flex flex-col items-end">
                                        {m.listings.map((l: any, idx: number) => (
                                            <span key={idx}>{l.source}</span>
                                        ))}
                                    </div>
                                ) : (
                                    "Telegram"
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <div className="p-4 text-xs text-muted-foreground bg-muted/20 border-t">
                * ROI calculated based on Net Daily Profit (Rev - Exp) using ${market.btcPrice.toLocaleString()} BTC and ${DEFAULT_CONTRACT_TERMS.electricityRate}/kWh.
            </div>
        </div>
    );
}
