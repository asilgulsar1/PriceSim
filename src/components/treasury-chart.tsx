"use client";

import React from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import { TreasuryProjection } from '@/lib/treasury-calculator';

interface TreasuryChartProps {
    data: TreasuryProjection[];
}

export function TreasuryChart({ data }: TreasuryChartProps) {
    // Downsample data
    const chartData = data.filter((_, i) => i % 7 === 0 || i === data.length - 1).map(d => ({
        date: d.date.toLocaleDateString(),
        treasuryUSD: d.treasuryUSD,
        treasuryBTC: d.treasuryBTC,
        btcPrice: d.btcPrice
    }));

    return (
        <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    margin={{
                        top: 10,
                        right: 30,
                        left: 0,
                        bottom: 0,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                        dataKey="date"
                        className="text-xs text-muted-foreground"
                        tickMargin={10}
                        minTickGap={30}
                    />
                    <YAxis
                        yAxisId="left"
                        className="text-xs text-muted-foreground"
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        className="text-xs text-muted-foreground"
                        tickFormatter={(value) => `${value.toFixed(2)} ₿`}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                        formatter={(value: number, name: string) => {
                            if (name === "Treasury (USD)") return [`$${value.toLocaleString()}`, name];
                            if (name === "Treasury (BTC)") return [`${value.toFixed(4)} ₿`, name];
                            return [value, name];
                        }}
                    />
                    <Legend />
                    <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="treasuryUSD"
                        name="Treasury (USD)"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.2}
                        strokeWidth={2}
                    />
                    <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="treasuryBTC"
                        name="Treasury (BTC)"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.1}
                        strokeWidth={2}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
