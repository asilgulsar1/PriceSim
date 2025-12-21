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
    const [filterText, setFilterText] = React.useState("");
    const [sortConfig, setSortConfig] = React.useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // Enrich Data logic
    const enrichedData = useMemo(() => {
        if (!telegramMiners || !Array.isArray(telegramMiners)) return [];

        let liveHashpriceUSD = 0;
        if (market.networkDifficulty > 0 && market.btcPrice > 0) {
            liveHashpriceUSD = calculateHashpriceUSD(market.networkDifficulty, market.blockReward, market.btcPrice);
        }

        let processed = telegramMiners.filter(tg => tg.name).map(tg => {
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
                // Estimator fallback
                if (tg.hashrateTH > 300) powerW = tg.hashrateTH * 16;
                else if (tg.hashrateTH > 200) powerW = tg.hashrateTH * 19;
                else powerW = tg.hashrateTH * 22;
            }

            // Price Fallback
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
                price,
                powerW,
                dailyRevenueUSD,
                dailyExpenseUSD,
                dailyNet,
                roi: dailyNet > 0 ? roi : -100, // Normalize negative ROI
                matchName: match ? match.name : 'Estimated'
            };
        });

        // Search Filter
        if (filterText) {
            processed = processed.filter(m => m.name.toLowerCase().includes(filterText.toLowerCase()));
        }

        // Logic Filter (ROI > 500% = Bad Data or Outlier)
        processed = processed.filter(m => m.roi <= 500);

        // Sorting
        if (sortConfig !== null) {
            processed.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        } else {
            // Default Sort: Hashrate Desc
            processed.sort((a, b) => b.hashrateTH - a.hashrateTH);
        }

        return processed;
    }, [telegramMiners, market, filterText, sortConfig]);

    // Grouping Logic
    const groupedData = useMemo(() => {
        const groups: Record<string, any> = {};

        enrichedData.forEach(m => {
            if (!groups[m.name]) {
                groups[m.name] = {
                    name: m.name,
                    minHash: m.hashrateTH,
                    maxHash: m.hashrateTH,
                    minPrice: m.price,
                    minRoi: m.roi,
                    maxRoi: m.roi,
                    count: 0,
                    children: []
                };
            }

            const g = groups[m.name];
            g.children.push(m);
            g.minHash = Math.min(g.minHash, m.hashrateTH);
            g.maxHash = Math.max(g.maxHash, m.hashrateTH);
            g.minPrice = Math.min(g.minPrice, m.price);
            if (m.roi > -99) {
                g.minRoi = Math.min(g.minRoi, m.roi);
                g.maxRoi = Math.max(g.maxRoi, m.roi);
            }
            g.count++;
        });

        // Convert to array and Sort Groups
        const sortedGroups = Object.values(groups).sort((a: any, b: any) => {
            if (sortConfig) {
                if (sortConfig.key === 'price') {
                    return sortConfig.direction === 'asc' ? a.minPrice - b.minPrice : b.minPrice - a.minPrice;
                }
                if (sortConfig.key === 'roi') {
                    return sortConfig.direction === 'asc' ? a.maxRoi - b.maxRoi : b.maxRoi - a.maxRoi;
                }
                if (sortConfig.key === 'name') {
                    return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                }
            }
            return b.maxHash - a.maxHash;
        });

        // Recursively Sort Children (Variants) if Sort Config exists
        // This enables "Sort for Global rows" feeling while keeping groups
        if (sortConfig) {
            sortedGroups.forEach((g: any) => {
                g.children.sort((a: any, b: any) => {
                    let valA, valB;
                    if (sortConfig.key === 'price') {
                        valA = a.price; valB = b.price;
                    } else if (sortConfig.key === 'roi') {
                        valA = a.roi; valB = b.roi;
                    } else if (sortConfig.key === 'name') {
                        // Sort children by hashrate if name sorted, or vendor name?
                        // Usually sorting by price is most useful for variants.
                        // Let's stick to the key.
                        valA = a.name; valB = b.name;
                    } else {
                        valA = a.hashrateTH; valB = b.hashrateTH;
                    }

                    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                });
            });
        }

        return sortedGroups;

    }, [enrichedData, sortConfig]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    if (!telegramMiners || !Array.isArray(telegramMiners) || telegramMiners.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">No recent Telegram data found in snapshot.</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-2">
                <input
                    type="text"
                    placeholder="Search miner models..."
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 max-w-sm"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                />
                <Badge variant="outline" className="ml-auto">
                    {groupedData.length} Models ({enrichedData.length} Variants)
                </Badge>
            </div>

            <div className="rounded-lg border shadow-sm bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Miner Model</TableHead>
                            <TableHead className="text-right">Hashrate Range</TableHead>
                            <TableHead className="text-right">Est. Power</TableHead>
                            <TableHead className="text-right">Daily Rev</TableHead>
                            <TableHead className="text-right">Daily Exp</TableHead>
                            <TableHead className="text-right">Daily Net</TableHead>
                            <TableHead className="text-right">ROI (Net)</TableHead>
                            <TableHead className="text-right">Lowest Price</TableHead>
                            <TableHead className="text-right">Variants</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupedData.map((group: any, i: number) => (
                            <GroupRow key={i} group={group} />
                        ))}
                    </TableBody>
                </Table>
                <div className="p-4 text-xs text-muted-foreground bg-muted/20 border-t">
                    * ROI calculated based on Net Daily Profit (Rev - Exp) using ${(market.btcPrice || 0).toLocaleString()} BTC and ${DEFAULT_CONTRACT_TERMS.electricityRate}/kWh.
                    <br />
                    * Hiding entries with ROI {'>'} 500% (likely data errors).
                    <br />
                    * Power estimated unless parsed from message text.
                </div>
            </div>
        </div>
    );
}

function GroupRow({ group }: { group: any }) {
    const [open, setOpen] = React.useState(false);

    // Sort children by Hashrate Desc
    const children = group.children.sort((a: any, b: any) => b.hashrateTH - a.hashrateTH);
    const topVariant = children[0]; // Representative for columns if needed

    // Logic: If only 1 child, just render the child row directly? 
    // Or render Group Row but expanded by default? 
    // Let's render Group Row, but make it look like a single item if count is 1.
    // Actually, user wants to collapse "combinations". Single items don't need collapsing.

    if (group.count === 1) {
        return <Row m={topVariant} isChild={false} />;
    }

    return (
        <>
            <TableRow className="hover:bg-muted/50 cursor-pointer border-l-4 border-l-transparent hover:border-l-primary" onClick={() => setOpen(!open)}>
                <TableCell className="font-bold flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{open ? '▼' : '▶'}</span>
                    {group.name}
                </TableCell>
                <TableCell className="text-right font-medium">
                    {group.minHash === group.maxHash ?
                        `${group.maxHash} TH` :
                        `${group.minHash} - ${group.maxHash} TH`}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
                <TableCell className="text-right font-mono text-blue-600">
                    {group.minRoi === group.maxRoi ? `${group.maxRoi.toFixed(0)}%` : `${group.minRoi.toFixed(0)}% - ${group.maxRoi.toFixed(0)}%`}
                </TableCell>
                <TableCell className="text-right font-bold">From ${group.minPrice.toLocaleString()}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{group.count} Variants</TableCell>
            </TableRow>
            {open && (
                <>
                    {children.map((m: any, idx: number) => (
                        <Row key={idx} m={m} isChild={true} />
                    ))}
                </>
            )}
        </>
    );
}

function Row({ m, isChild = false }: { m: any, isChild?: boolean }) {
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
