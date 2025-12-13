/* eslint-disable */
"use client";

import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trophy, Zap, TrendingUp, Calendar, DollarSign } from "lucide-react";
import { fetchMarketData } from "@/lib/api";
import { solveMinerPrice } from "@/lib/pricing-solver";
import { INITIAL_MINERS } from "@/lib/miner-data";
import { rankMiners, MinerScoreDetail } from "@/lib/miner-scoring";
import { ContractTerms } from "@/lib/price-simulator-calculator";

const CACHE_KEY = 'miner_ranker_v1';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 Hours

export function MinerRanker() {
    const [rankings, setRankings] = useState<MinerScoreDetail[]>([]);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    const loadData = React.useCallback(async (forceRefresh = false) => {
        setLoading(true);
        try {
            // Check Cache
            if (!forceRefresh) {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const age = Date.now() - parsed.timestamp;
                    if (age < CACHE_DURATION_MS) {
                        setRankings(parsed.data);
                        setLastUpdated(parsed.timestamp);
                        setLoading(false);
                        return;
                    }
                }
            }

            // Calculate Fresh
            const marketData = await fetchMarketData();

            // Re-construct market object compatible with solver
            const marketObj = {
                btcPrice: marketData.btcPrice,
                networkDifficulty: marketData.networkDifficulty,
                blockReward: 3.125,
                difficultyGrowthMonthly: 4,
                btcPriceGrowthMonthly: 2.5,
                btcPriceGrowthAnnual: 0,
                nextHalvingDate: new Date('2028-04-20') // Approx
            };

            const contract: ContractTerms = {
                electricityRate: 0.08,
                opexRate: 0,
                poolFee: 1.0,
                contractDurationYears: 4
            };

            // Assume 50% ROI for base pricing to get consistent comparison
            const targetProfit = 50;

            const solved = INITIAL_MINERS.map(m => solveMinerPrice(m, contract, marketObj, targetProfit, false));

            const ranked = rankMiners(solved);

            setRankings(ranked);
            setLastUpdated(Date.now());

            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: ranked
            }));

        } catch (e) {
            console.error("Failed to update rankings", e);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const getScoreColor = (score: number) => {
        if (score >= 90) return "text-emerald-600 bg-emerald-100";
        if (score >= 75) return "text-blue-600 bg-blue-100";
        if (score >= 60) return "text-amber-600 bg-amber-100";
        return "text-slate-600 bg-slate-100";
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold flex items-center gap-2">
                        <Trophy className="h-8 w-8 text-amber-500" />
                        Miner Power Rankings
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Scoring based on Profitability, Revenue, Efficiency, and Model Age.
                    </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {lastUpdated && <span>Updated: {new Date(lastUpdated).toLocaleString()}</span>}
                    <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={loading}>
                        {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Refresh Scores
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {rankings.map((item, index) => (
                    <Card key={index} className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow">
                        <div className="flex flex-col md:flex-row">
                            {/* Rank & Score */}
                            <div className={`p-6 flex flex-col items-center justify-center min-w-[150px] ${index < 3 ? 'bg-gradient-to-br from-amber-50 to-orange-50' : 'bg-slate-50'}`}>
                                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Rank</div>
                                <div className="text-4xl font-black text-slate-800">#{index + 1}</div>
                                <span className={`mt-3 px-3 py-1 rounded-full text-lg font-bold ${getScoreColor(item.score)}`}>
                                    {item.score.toFixed(1)}
                                </span>
                            </div>

                            {/* Details */}
                            <div className="p-6 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-1">{item.miner.name}</h3>
                                    <div className="flex gap-4 text-sm text-slate-500 mb-4">
                                        <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {item.miner.hashrateTH} TH/s</span>
                                        <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {item.miner.powerWatts} W</span>
                                        <span className="flex items-center gap-1 bg-slate-100 px-2 rounded-full font-medium text-slate-700">
                                            {(item.miner.powerWatts / item.miner.hashrateTH).toFixed(1)} J/TH
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <div className="text-muted-foreground">Daily Revenue</div>
                                            <div className="font-semibold text-lg text-emerald-600">${item.raw.revenue.toFixed(2)}</div>
                                        </div>
                                        <div> {/* Fixed cost 0 in raw, using year */}
                                            <div className="text-muted-foreground">Model Year</div>
                                            <div className="font-semibold text-lg">{item.raw.year}</div>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="text-muted-foreground">Est. ROI (Annual)</div>
                                            <div className="font-semibold text-lg text-blue-600">{item.raw.profitability.toFixed(1)}%</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Score Breakdown */}
                                <div className="space-y-3 justify-center flex flex-col">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Score Breakdown</h4>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="flex items-center gap-1 text-emerald-600"><DollarSign className="h-3 w-3" /> Profitability (30%)</span>
                                            <span className="font-medium">{item.metrics.profitabilityScore.toFixed(1)} / 30</span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                                            <div className="h-full bg-emerald-500" style={{ width: `${(item.metrics.profitabilityScore / 30) * 100}%` }} />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="flex items-center gap-1 text-blue-600"><TrendingUp className="h-3 w-3" /> Daily Revenue (30%)</span>
                                            <span className="font-medium">{item.metrics.revenueScore.toFixed(1)} / 30</span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
                                            <div className="h-full bg-blue-500" style={{ width: `${(item.metrics.revenueScore / 30) * 100}%` }} />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="flex items-center gap-1 text-purple-600"><Calendar className="h-3 w-3" /> Modernity / Age (20%)</span>
                                            <span className="font-medium">{item.metrics.ageScore.toFixed(1)} / 20</span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-purple-100">
                                            <div className="h-full bg-purple-500" style={{ width: `${(item.metrics.ageScore / 20) * 100}%` }} />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="flex items-center gap-1 text-amber-600"><Zap className="h-3 w-3" /> Efficiency (20%)</span>
                                            <span className="font-medium">{item.metrics.efficiencyScore.toFixed(1)} / 20</span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-amber-100">
                                            <div className="h-full bg-amber-500" style={{ width: `${(item.metrics.efficiencyScore / 20) * 100}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
