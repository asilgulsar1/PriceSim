"use client";

import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMarketData } from "@/hooks/useMarketData";
import { INITIAL_MINERS } from "@/lib/miner-data";
import { normalizeMinerName, findBestStaticMatch } from "@/lib/market-matching";
import { calculateHashpriceUSD, calculateMinerRevenueUSD } from "@/lib/mining-math";
import { DEFAULT_CONTRACT_TERMS } from "@/lib/constants";

interface TelegramRateTableProps {
    telegramMiners: any[];
}

export function TelegramRateTable({ telegramMiners }: TelegramRateTableProps) {
    const { market } = useMarketData();

    // Enrich Data logic... (unchanged, just ensuring variable scope)
    const enrichedData = useMemo(() => {
        if (!telegramMiners || !Array.isArray(telegramMiners)) return [];

        let liveHashpriceUSD = 0;
        if (market.networkDifficulty > 0 && market.btcPrice > 0) {
            liveHashpriceUSD = calculateHashpriceUSD(market.networkDifficulty, market.blockReward, market.btcPrice);
        }

        return telegramMiners.filter(tg => tg.name).map(tg => {
            // 1. Find Specs (Power)
            // Use improved matcher that handles synonyms (EXPH -> XP Hydro)
            const match = findBestStaticMatch(tg.name, INITIAL_MINERS);

            let powerW = 0;
            if (match) {
                powerW = match.powerWatts;
            } else if (tg.specs?.powerW > 0) {
                powerW = tg.specs.powerW;
            } else if (tg.powerW > 0) {
                powerW = tg.powerW; // Use parsed power
            } else {
                // Estimator
                if (tg.hashrateTH > 300) powerW = tg.hashrateTH * 16; // S21-class
                else if (tg.hashrateTH > 200) powerW = tg.hashrateTH * 19; // S19 XP
                else powerW = tg.hashrateTH * 22; // S19 Pro
            }

            // Price Fallback (Robustness for older blobs or missing parses)
            const price = tg.price || tg.stats?.minPrice || tg.stats?.middlePrice || 0;

            // 2. Calculate Financials
            let dailyRevenueUSD = 0;
            if (liveHashpriceUSD > 0 && tg.hashrateTH > 0) {
                dailyRevenueUSD = calculateMinerRevenueUSD(tg.hashrateTH, liveHashpriceUSD, 1.0);
            }

            const kwhPrice = DEFAULT_CONTRACT_TERMS.electricityRate || 0.055;
            const dailyExpenseUSD = (powerW / 1000) * 24 * kwhPrice;
            const dailyNet = dailyRevenueUSD - dailyExpenseUSD;

            // 3. ROI (Annual)
            let roi = 0;
            if (price > 0 && dailyRevenueUSD > 0) {
                if (dailyNet > 0) {
                    roi = ((dailyNet * 365) / price) * 100;
                } else {
                    roi = 0;
                }
            }

            return {
                ...tg,
                price, // Override with safe price
                powerW,
                dailyRevenueUSD,
                dailyExpenseUSD,
                dailyNet,
                roi,
                matchName: match ? match.name : 'Estimated'
            };
        }).sort((a, b) => b.hashrateTH - a.hashrateTH);
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
                        <TableHead className="text-right">Lowest Price</TableHead>
                        <TableHead className="text-right">Source</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {enrichedData.map((m: any, i: number) => (
                        <Row key={i} m={m} />
                    ))}
                </TableBody>
            </Table>
            <div className="p-4 text-xs text-muted-foreground bg-muted/20 border-t">
                * ROI calculated based on Net Daily Profit (Rev - Exp) using ${(market.btcPrice || 0).toLocaleString()} BTC and ${DEFAULT_CONTRACT_TERMS.electricityRate}/kWh.
                <br />
                * Power estimated unless parsed from message text.
            </div>
        </div>
    );
}

function Row({ m }: { m: any }) {
    const [open, setOpen] = React.useState(false);
    const hasListings = m.listings && m.listings.length > 0;

    return (
        <>
            <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={() => hasListings && setOpen(!open)}>
                <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                        {hasListings && (
                            <span className="text-xs text-muted-foreground">{open ? '▼' : '▶'}</span>
                        )}
                        {m.name}
                        {m.matchName === 'Estimated' && !m.powerW && <span className="ml-2 text-[10px] text-amber-500">(Est. Power)</span>}
                    </div>
                </TableCell>
                <TableCell className="text-right">{(m.hashrateTH || 0).toFixed(0)} TH</TableCell>
                <TableCell className="text-right">{(m.powerW || 0).toFixed(0)} W</TableCell>
                <TableCell className="text-right text-green-600">${(m.dailyRevenueUSD || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right text-red-500">-${(m.dailyExpenseUSD || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right font-bold text-green-700">${(m.dailyNet || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-blue-600">{(m.roi || 0).toFixed(1)}%</TableCell>
                <TableCell className="text-right font-bold text-lg">${(m.price || 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                    {hasListings ? `${m.listings.length} Vendors` : "Telegram"}
                </TableCell>
            </TableRow>
            {open && hasListings && (
                <TableRow className="bg-muted/10">
                    <TableCell colSpan={9} className="p-0">
                        <div className="p-4 bg-muted/20 border-b">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Vendor Listings</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                {m.listings.map((l: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-sm p-2 bg-card border rounded shadow-sm">
                                        <span className="font-medium">{l.source || 'Unknown'}</span>
                                        <span className="font-bold font-mono">${(l.price || 0).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}
