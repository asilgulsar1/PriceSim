"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MarketConditions } from "@/lib/price-simulator-calculator";

interface PriceSimulatorControlsProps {
    targetProfitPercent: number;
    setTargetProfitPercent: (val: number) => void;
    isBtcTarget: boolean;
    setIsBtcTarget: (val: boolean) => void;
    market: MarketConditions;
    setMarket: (val: MarketConditions) => void;
    hostingRate: number;
    setHostingRate: (val: number) => void;
    durationYears: number;
    setDurationYears: (val: number) => void;
}

export function PriceSimulatorControls({
    targetProfitPercent,
    setTargetProfitPercent,
    isBtcTarget,
    setIsBtcTarget,
    market,
    setMarket,
    hostingRate,
    setHostingRate,
    durationYears,
    setDurationYears
}: PriceSimulatorControlsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Target Profit */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Target Profit Margin</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            value={targetProfitPercent}
                            onChange={e => setTargetProfitPercent(Number(e.target.value))}
                            className="text-2xl font-bold"
                        />
                        <span className="text-muted-foreground">%</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <Switch checked={isBtcTarget} onCheckedChange={setIsBtcTarget} />
                        <Label className="text-xs text-muted-foreground">{isBtcTarget ? 'BTC Target' : 'USD Target'}</Label>
                    </div>
                </CardContent>
            </Card>

            {/* Market Assumptions */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Market Assumptions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">BTC Price:</span>
                        <span className="font-medium">${market.btcPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Difficulty:</span>
                        <span className="font-medium">{(market.networkDifficulty / 1e12).toFixed(0)} T</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Diff Growth:</span>
                        <div className="flex items-center gap-1">
                            <Input
                                className="h-6 w-16 text-right px-1"
                                value={market.difficultyGrowthMonthly}
                                onChange={e => setMarket({ ...market, difficultyGrowthMonthly: Number(e.target.value) })}
                            />
                            <span className="text-xs">% / mo</span>
                        </div>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Price Growth:</span>
                        <div className="flex items-center gap-1">
                            <Input
                                className="h-6 w-16 text-right px-1"
                                value={market.btcPriceGrowthMonthly}
                                onChange={e => setMarket({ ...market, btcPriceGrowthMonthly: Number(e.target.value) })}
                            />
                            <span className="text-xs">% / mo</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Contract Terms */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Contract Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Hosting Rate:</span>
                        <div className="flex items-center gap-1">
                            <span className="text-xs">$</span>
                            <Input
                                className="h-6 w-16 text-right px-1"
                                value={hostingRate}
                                onChange={e => setHostingRate(Number(e.target.value))}
                            />
                            <span className="text-xs">/ kWh</span>
                        </div>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Duration:</span>
                        <div className="flex items-center gap-1">
                            <Input
                                className="h-6 w-16 text-right px-1"
                                value={durationYears}
                                onChange={e => setDurationYears(Number(e.target.value))}
                            />
                            <span className="text-xs">years</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
