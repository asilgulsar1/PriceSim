"use client";

import React, { useState } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

/**
 * Shared Component for Displaying a Miner Row.
 * Includes "View-Time" Sanitization to clean up dirty names and weird prices from Web Sources.
 */

interface MinerDisplayProps {
    miner: any;
    userRole?: string;
}

export function MinerRow({ miner, userRole }: MinerDisplayProps) {
    const [open, setOpen] = useState(false);

    // Data is now pre-sanitized by mergeMarketData
    const displayName = miner.name;
    const hashrate = miner.specs.hashrateTH;
    const powerW = miner.specs.powerW;
    const displayPrice = miner.stats.middlePrice;

    // Only expand if there are ACTUAL listings > 0.
    // Sometimes listings might be 1 but it's just the aggregated row itself.
    // Logic: If vendorCount > 1 OR (vendorCount == 1 and listings[0].url != '#')
    const hasListings = miner.listings && miner.listings.length > 1;

    // Determine Profitability (Visual)
    const kwhPrice = 0.055;
    const dailyExp = (powerW / 1000) * 24 * kwhPrice;

    return (
        <>
            <TableRow className={`hover:bg-muted/50 cursor-pointer group ${!hasListings ? 'cursor-default' : ''}`} onClick={() => hasListings && setOpen(!open)}>
                {/* Model Name */}
                <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                        {hasListings && (
                            <span className="text-xs text-muted-foreground w-4">{open ? '▼' : '▶'}</span>
                        )}
                        <span className="text-base text-primary/90 font-semibold group-hover:text-blue-600 transition-colors">
                            {displayName}
                        </span>
                    </div>
                </TableCell>

                {/* Hashrate */}
                <TableCell>
                    <Badge variant="secondary" className="font-mono">
                        {hashrate.toFixed(0)} TH/s
                    </Badge>
                </TableCell>

                {/* Power */}
                <TableCell className="text-muted-foreground font-mono text-xs">
                    {powerW.toFixed(0)} W
                </TableCell>

                {/* Middle Price */}
                <TableCell>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-green-600 text-lg">
                            ${displayPrice.toLocaleString()}
                        </span>
                        {/* Telegram Badge handled here if passed in source/listing? 
                            Or we check listing tags. The prompt mentioned sanitization logic primarily.
                        */}
                    </div>
                </TableCell>

                {/* Vendors */}
                <TableCell className="text-right">
                    <Badge variant="outline">{miner.stats.vendorCount || 1}</Badge>
                </TableCell>
            </TableRow>

            {/* Expanded Listings */}
            {open && hasListings && (
                <TableRow className="bg-muted/5 animation-fade-in">
                    <TableCell colSpan={6} className="p-0">
                        <div className="p-4 bg-slate-50/50 border-b shadow-inner">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                                Available Listings
                                <span className="h-px bg-slate-200 flex-1"></span>
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {miner.listings.map((l: any, idx: number) => {
                                    // Data is pre-sanitized in Listings array too
                                    const lPrice = l.price;

                                    return (
                                        <div key={idx} className="flex justify-between items-center text-sm p-3 bg-white border rounded-md shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-slate-700">{l.vendor}</span>
                                                {/* @ts-ignore */}
                                                {l.isTelegram && (
                                                    <Badge variant="secondary" className="text-[10px] h-5 bg-sky-100 text-sky-800 border-sky-200">
                                                        Telegram
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold font-mono text-slate-900">${Math.round(lPrice).toLocaleString()}</span>
                                                {l.url && l.url !== '#' && (
                                                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}
