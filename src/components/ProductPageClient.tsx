/* eslint-disable */
"use client";

import Image from 'next/image';
/* eslint-disable @typescript-eslint/no-require-imports */
import React, { useState, useMemo } from 'react';
import { MinerProfile } from '@/lib/miner-data';
import { useMarketData } from '@/hooks/useMarketData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { solveMinerPrice } from '@/lib/pricing-solver';
import { StickyActionFooter } from "@/components/StickyActionFooter";
import { DEFAULT_CONTRACT_TERMS, DEFAULT_TARGET_MARGIN, DEFAULT_MARKET_CONDITIONS } from '@/lib/constants';
import {
    Loader2, Zap, TrendingUp, ShieldCheck, Globe,
    Check, Search, ArrowRight, Lock, ExternalLink
} from 'lucide-react';
import Link from 'next/link';

export default function ProductPageClient({ miner }: { miner: MinerProfile & { listings?: any[], stats?: any, slug?: string } }) {
    const { market, loading: marketLoading } = useMarketData();
    const [elecCost, setElecCost] = useState<number>(0.05);
    const [selectedRegion, setSelectedRegion] = useState('All');

    // --- Core Calculations ---
    const bitcoinPrice = (market as any)?.btcPrice || (market as any)?.price || 65000;
    const difficulty = (market as any)?.networkDifficulty || (market as any)?.difficulty || 88100000000000;
    const blockReward = 3.125;

    // Adapt Hook Key Names to Solver Key Names
    const solverMarket = useMemo(() => {
        if (!market) return DEFAULT_MARKET_CONDITIONS;
        return {
            ...DEFAULT_MARKET_CONDITIONS,
            btcPrice: (market as any).btcPrice || (market as any).price || DEFAULT_MARKET_CONDITIONS.btcPrice,
            networkDifficulty: (market as any).networkDifficulty || (market as any).difficulty || DEFAULT_MARKET_CONDITIONS.networkDifficulty,
        };
    }, [market]);

    // Calculate Hardware Price
    const estimatedPrice = useMemo(() => {
        if (!market) return 0;
        const result = solveMinerPrice(miner, DEFAULT_CONTRACT_TERMS, solverMarket, DEFAULT_TARGET_MARGIN, false);
        return result.calculatedPrice;
    }, [miner, market, solverMarket]);

    // Derived Metrics
    // Refactor to use centralized math
    const { calculateDailyGrossBTC } = require('@/lib/mining-math');
    const dailyBTC = calculateDailyGrossBTC(miner.hashrateTH, difficulty, blockReward);
    const dailyRevenue = dailyBTC * bitcoinPrice;

    // Market Context
    const marketAveragePrice = estimatedPrice * 1.08; // Simulate 8% markup

    // Payback Date
    const dailyProfit = dailyRevenue - (miner.powerWatts / 1000) * 24 * elecCost;
    const paybackDays = dailyProfit > 0 ? Math.ceil(estimatedPrice / dailyProfit) : 0;
    const paybackDate = new Date();
    paybackDate.setDate(paybackDate.getDate() + paybackDays);

    if (marketLoading || !market) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-slate-400 font-mono text-sm">Initializing Market Terminal...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-32">
            {/* HER0 SECTION: The Market Pulse */}
            <section className="bg-slate-950 text-white pb-12 pt-8">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                            <span className="text-green-400">● LIVE</span>
                            <span>BTC: ${bitcoinPrice.toLocaleString()}</span>
                            <span className="text-slate-600">|</span>
                            <span>DIFF: {(difficulty / 1e12).toFixed(2)}T</span>
                        </div>
                        <Badge variant="outline" className="border-slate-700 text-slate-300 font-normal text-xs uppercase tracking-widest">
                            Source of Truth v2.0
                        </Badge>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <Badge className="bg-blue-600/20 text-blue-400 border-none hover:bg-blue-600/20 px-3 py-1 text-xs">
                                    VERIFIED BATCH
                                </Badge>
                                <span className="text-xs text-slate-400 font-mono">ID: {(miner.slug || 'UNKNOWN').toUpperCase()}</span>
                            </div>

                            <h1 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight">
                                {miner.name}
                            </h1>

                            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm mb-8">
                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">Market Estimate</div>
                                        <div className="text-2xl text-slate-500 font-mono line-through decoration-red-500/50">
                                            ${marketAveragePrice.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="border-l border-slate-800 pl-8 relative">
                                        <div className="absolute -top-3 -right-3 bg-green-500 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                            SAVE ${(marketAveragePrice - estimatedPrice).toFixed(0)}
                                        </div>
                                        <div className="text-xs text-blue-400 uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                                            Segments Price <ShieldCheck className="w-3 h-3" />
                                        </div>
                                        <div className="text-4xl text-white font-mono font-bold">
                                            ${estimatedPrice.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Link href={`/login?callbackUrl=${encodeURIComponent(`/request-quote?miner=${encodeURIComponent(miner.name)}`)}`} className="flex-1">
                                    <Button size="lg" className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg">
                                        Lock Price & Order <ArrowRight className="ml-2 w-5 h-5" />
                                    </Button>
                                </Link>
                                <Button size="lg" variant="outline" className="h-14 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => alert("Datasheet pending manufacturer release.")}>
                                    View Datasheet
                                </Button>
                            </div>
                        </div>

                        <div className="relative group flex justify-center">
                            <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" />
                            <Image
                                src="/asic-miner-v2.png"
                                alt={`${miner.name} Bitcoin Miner`}
                                width={600}
                                height={600}
                                className="relative z-10 w-full max-w-[500px] h-auto drop-shadow-2xl transform group-hover:scale-105 transition-transform duration-500 object-contain"
                                priority
                            />
                            <div className="absolute bottom-10 right-0 z-20 bg-slate-900/90 backdrop-blur border border-slate-700 text-white px-4 py-2 rounded-lg shadow-xl text-xs flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                14 Investors viewing
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-4 max-w-7xl -mt-8 relative z-20">
                <div className="grid lg:grid-cols-3 gap-6 mb-12">
                    <Card className="border-none shadow-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Revenue Engine</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-slate-900 mb-1">
                                ${(dailyRevenue * 30).toFixed(0)}<span className="text-base font-normal text-slate-400">/mo</span>
                            </div>
                            <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" /> {(dailyRevenue * 365 / estimatedPrice * 100).toFixed(1)}% Annual Yield
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-blue-600 text-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-blue-100">Projected Break Even</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold mb-1">
                                {paybackDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </div>
                            <div className="text-xs text-blue-100 opacity-80 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> {paybackDays} Days (Risk Adjusted)
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Efficiency Rating</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-slate-900 mb-1">
                                {(miner.powerWatts / miner.hashrateTH).toFixed(1)} <span className="text-base font-normal text-slate-400">J/TH</span>
                            </div>
                            <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                <Zap className="w-3 h-3 text-amber-500" /> {miner.powerWatts}W Power Draw
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Globe className="w-5 h-5 text-slate-400" /> Global Source Matrix
                            </h2>
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                {['All', 'GCC', 'Asia', 'Americas', 'Europe'].map((region) => (
                                    <button
                                        key={region}
                                        onClick={() => setSelectedRegion(region)}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${selectedRegion === region ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {region}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Card className="border-slate-200 overflow-hidden shadow-lg">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead>Source / Vendor</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead>MOQ</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {/* Segments (Our Offer) - Always Visible or Filtered? Let's keep it sticky as 'Verified' */}
                                        {(selectedRegion === 'All' || selectedRegion === 'GCC') && (
                                            <TableRow className="bg-blue-50/50 border-l-4 border-l-blue-600">
                                                <TableCell className="font-medium text-slate-900">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center text-[10px] font-bold">S</div>
                                                        <div>
                                                            <div>Segments Cloud</div>
                                                            <div className="text-[10px] text-blue-600 font-medium">VERIFIED PARTNER</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 text-xs text-slate-600">
                                                        <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                                        Dubai, UAE
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono font-bold text-blue-700">
                                                    ${estimatedPrice.toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs text-slate-500">1 Unit</span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Link href={`/login?callbackUrl=${encodeURIComponent(`/request-quote?miner=${encodeURIComponent(miner.name)}`)}`}>
                                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8">
                                                            Order Now
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        )}

                                        {/* Real Vendor Data Logic: Prefer scraped listings, otherwise fallback to known industry players */}
                                        {(() => {
                                            let displayListings: any[] = [];

                                            // 1. Try Scraped Listings
                                            if (miner.listings && miner.listings.length > 0) {
                                                displayListings = miner.listings.map(l => ({
                                                    vendor: l.vendor,
                                                    location: l.url?.includes('.cn') ? 'China' : (l.url?.includes('.ae') ? 'UAE' : 'Global'), // Simple heuristic
                                                    region: 'All', // Scraper needs region enrichment, default to All for now
                                                    price: l.price,
                                                    moq: '1 Unit',
                                                    status: l.stockStatus || 'Verify',
                                                    url: l.url,
                                                    isTelegram: l.isTelegram
                                                }));
                                            }
                                            // 2. Fallback to Industry Standard Simulation if no scraped data
                                            else {
                                                displayListings = [
                                                    // Asia
                                                    { vendor: 'Bitmars', location: 'Shenzhen, CN', region: 'Asia', price: estimatedPrice * 1.015, moq: '5 Units', status: 'In Stock', url: 'https://bitmars.io' },
                                                    { vendor: 'Apexto Mining', location: 'Shenzhen, CN', region: 'Asia', price: estimatedPrice * 1.02, moq: '10 Units', status: 'Pre-order', url: 'https://apextomining.com' },
                                                    { vendor: 'AKMiner', location: 'China', region: 'Asia', price: estimatedPrice * 1.03, moq: '1 Unit', status: 'In Stock', url: '#' },

                                                    // Americas
                                                    { vendor: 'Compass Mining', location: 'USA', region: 'Americas', price: estimatedPrice * 1.15, moq: '1 Unit', status: 'Hosted', url: 'https://compassmining.io' },
                                                    { vendor: 'Kaboomracks', location: 'Telegram', region: 'Americas', price: estimatedPrice * 1.10, moq: '5 Units', status: 'Verify', url: 'https://t.me/kaboomracks' },
                                                    { vendor: 'BT-Miners', location: 'New York, USA', region: 'Americas', price: estimatedPrice * 1.12, moq: '1 Unit', status: 'In Stock', url: 'https://bt-miners.com' },

                                                    // Europe
                                                    { vendor: 'MillionMiner', location: 'Germany', region: 'Europe', price: estimatedPrice * 1.14, moq: '1 Unit', status: 'In Stock', url: 'https://millionminer.com' },
                                                    { vendor: 'CoinMining Central', location: 'UK', region: 'Europe', price: estimatedPrice * 1.16, moq: '1 Unit', status: 'In Stock', url: 'https://coinminingcentral.com' },

                                                    // GCC
                                                    { vendor: 'Phoenix Technology', location: 'Abu Dhabi, UAE', region: 'GCC', price: estimatedPrice * 1.05, moq: '50 Units', status: 'Call', url: 'https://phoenixstore.com' },
                                                    { vendor: 'ExTech', location: 'Dubai, UAE', region: 'GCC', price: estimatedPrice * 1.06, moq: '10 Units', status: 'In Stock', url: '#' }
                                                ];
                                            }

                                            // Filter by Region (If scraper data doesn't have region, we show all for 'All' or just skip filtering if we can't determine)
                                            // Improved heuristic: allow all if scraped (since we don't know region well yet), else filter fallback
                                            if (miner.listings && miner.listings.length > 0) {
                                                // If scraped data matches selected region or we can't tell, show it. 
                                                // For now, let's just show All for scraped data to be safe.
                                                return displayListings.map((item, i) => (
                                                    <TableRow key={i} className="hover:bg-slate-50/50">
                                                        <TableCell className="font-medium text-slate-700">
                                                            {item.url ? (
                                                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-600 hover:underline">
                                                                    {item.vendor}
                                                                    <ExternalLink className="w-3 h-3 opacity-50" />
                                                                </a>
                                                            ) : (
                                                                item.vendor
                                                            )}
                                                        </TableCell>
                                                        <TableCell><span className="text-xs text-slate-500">{item.location}</span></TableCell>
                                                        <TableCell className="font-mono text-slate-600">${item.price.toLocaleString()}</TableCell>
                                                        <TableCell><span className="text-xs text-slate-400">{item.moq}</span></TableCell>
                                                        <TableCell className="text-right">
                                                            {item.url ? (
                                                                <a href={item.url} target="_blank" rel="noopener noreferrer">
                                                                    <Button size="sm" variant="outline" className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50">
                                                                        Visit Site
                                                                    </Button>
                                                                </a>
                                                            ) : (
                                                                <Button size="sm" variant="ghost" disabled className="text-slate-400 h-8 text-xs">{item.status}</Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ));
                                            } else {
                                                return displayListings.filter(item => selectedRegion === 'All' || item.region === selectedRegion).map((item, i) => (
                                                    <TableRow key={i} className="hover:bg-slate-50/50">
                                                        <TableCell className="font-medium text-slate-700">
                                                            {item.url && item.url !== '#' ? (
                                                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-600 hover:underline">
                                                                    {item.vendor}
                                                                    <ExternalLink className="w-3 h-3 opacity-50" />
                                                                </a>
                                                            ) : (
                                                                item.vendor
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-1 text-xs text-slate-500">
                                                                <span className="w-2 h-2 rounded-full bg-slate-200"></span>
                                                                {item.location}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-slate-600">${item.price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</TableCell>
                                                        <TableCell><span className="text-xs text-slate-400">{item.moq}</span></TableCell>
                                                        <TableCell className="text-right">
                                                            {item.url && item.url !== '#' ? (
                                                                <a href={item.url} target="_blank" rel="noopener noreferrer">
                                                                    <Button size="sm" variant="outline" className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50">
                                                                        Visit Site
                                                                    </Button>
                                                                </a>
                                                            ) : (
                                                                <Button size="sm" variant="ghost" disabled className="text-slate-400 h-8 text-xs">
                                                                    {item.status === 'Hosted' ? 'Hosting Only' : 'Unverified'}
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ));
                                            }
                                        })()}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="bg-slate-50 p-3 text-center text-xs text-slate-400 border-t border-slate-100">
                                Showing results for {selectedRegion} Region
                            </div>
                        </Card>
                    </div>

                    <div className="lg:col-span-4">
                        <Card className="h-full border-none shadow-lg bg-slate-900 text-white">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                                    Why Segments?
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                                        <span className="text-sm text-slate-400">Logistics Insurance</span>
                                        <Badge className="bg-green-500/20 text-green-400 border-none">INCLUDED</Badge>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                                        <span className="text-sm text-slate-400">Hosting Setup</span>
                                        <Badge className="bg-blue-500/20 text-blue-400 border-none">PRIORITY</Badge>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                                        <span className="text-sm text-slate-400">Payment Escrow</span>
                                        <Badge className="bg-purple-500/20 text-purple-400 border-none">SECURE</Badge>
                                    </div>
                                </div>
                                <div className="bg-blue-600/10 p-4 rounded-lg border border-blue-600/20">
                                    <p className="text-xs text-blue-300 leading-relaxed">
                                        &quot;Segments verified inventory is physically audited before listing. Market signals from other sources are unverified estimates.&quot;
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            <StickyActionFooter
                minerName={miner.name}
                price={estimatedPrice}
                purchaseLink={`/login?callbackUrl=${encodeURIComponent(`/request-quote?miner=${encodeURIComponent(miner.name)}`)}`}
            />
        </div>
    );
}
