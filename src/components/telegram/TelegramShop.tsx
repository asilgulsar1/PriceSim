"use client";

import React, { useState, useEffect } from 'react';
import { fetchMarketData } from "@/lib/api";
import { solveMinerPrice, SolvedMiner } from "@/lib/pricing-solver";
import { MarketConditions, ContractTerms } from "@/lib/price-simulator-calculator";
import { Loader2, ShoppingCart, Zap, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Re-importing INITIAL_MINERS from library
import { INITIAL_MINERS } from "@/lib/miner-data";

export function TelegramShop() {
    const [market, setMarket] = useState<MarketConditions>({
        btcPrice: 96500,
        networkDifficulty: 101.6e12,
        blockReward: 3.125,
        difficultyGrowthMonthly: 4,
        btcPriceGrowthMonthly: 2.5,
        btcPriceGrowthAnnual: 0
    });
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<SolvedMiner[]>([]);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const data = await fetchMarketData();
                setMarket(prev => ({
                    ...prev,
                    btcPrice: data.btcPrice,
                    networkDifficulty: data.networkDifficulty
                }));
            } catch (e) {
                console.error("Failed to load market data", e);
            }
            setLoading(false);
        }
        load();
    }, []);

    useEffect(() => {
        calculate();
    }, [market]);

    const calculate = () => {
        const miners = INITIAL_MINERS;
        const calculated = miners.map(miner => {
            const contract: ContractTerms = {
                electricityRate: 0.08,
                opexRate: 0,
                poolFee: 1.0,
                contractDurationYears: 4
            };

            // Fixed 50% margin for the shop for now, standardizing the offer
            const targetProfit = 50;

            return solveMinerPrice(miner, contract, market, targetProfit, false);
        });

        // Sort by ROI (profitability) descending
        calculated.sort((a, b) => b.clientProfitabilityPercent - a.clientProfitabilityPercent);
        setResults(calculated);
    };

    const handleBuy = (miner: SolvedMiner) => {
        // In a real Telegram WebApp, this would trigger a payment or open a chat
        // @ts-ignore
        if (window.Telegram?.WebApp) {
            // @ts-ignore
            window.Telegram.WebApp.sendData(JSON.stringify({
                action: 'buy_request',
                model: miner.name,
                price: miner.calculatedPrice,
                currency: 'USD'
            }));
            // @ts-ignore
            window.Telegram.WebApp.close();
        } else {
            alert(`Buy Request for ${miner.name} at $${miner.calculatedPrice.toLocaleString()}`);
        }
    };

    if (loading && results.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 pb-20 max-w-md mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Segments Shop</h1>
                <p className="text-slate-500 text-sm">Enterprise Bitcoin Mining Hardware</p>
            </header>

            <div className="space-y-4">
                {results.map((miner, i) => (
                    <Card key={i} className="overflow-hidden border-0 shadow-md bg-white">
                        <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500" />
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900">{miner.name}</h3>
                                    <div className="flex gap-2 text-xs text-slate-500 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Zap className="h-3 w-3" /> {miner.hashrateTH} TH/s
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <TrendingUp className="h-3 w-3" /> {miner.powerWatts} W
                                        </span>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 font-bold">
                                    {miner.clientProfitabilityPercent.toFixed(0)}% ROI
                                </Badge>
                            </div>

                            <div className="mt-4 flex items-end justify-between">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium uppercase">Unit Price</p>
                                    <p className="text-xl font-extrabold text-slate-900">
                                        ${miner.calculatedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </p>
                                </div>
                                <Button onClick={() => handleBuy(miner)} size="sm" className="bg-blue-600 hover:bg-blue-700">
                                    <ShoppingCart className="h-4 w-4 mr-2" /> Buy Now
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t text-center text-xs text-slate-400">
                Prices update in real-time based on BTC market data.
            </div>
        </div>
    );
}
