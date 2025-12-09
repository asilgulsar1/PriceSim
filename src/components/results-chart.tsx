'use client';

import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { DailyProjection } from '@/lib/calculator';

interface ResultsChartProps {
    data: DailyProjection[];
}

export function ResultsChart({ data }: ResultsChartProps) {
    // Downsample data for performance if too many points
    const chartData = data.filter((_, i) => i % 7 === 0 || i === data.length - 1).map(d => ({
        date: d.date.toLocaleDateString(),
        profit: d.cumulativeProfitUSD,
        revenue: d.cumulativeRevenueUSD,
        cost: d.cumulativeCostUSD,
        btcValue: d.portfolioValueUSD
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
                        className="text-xs text-muted-foreground"
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                    />
                    <Legend />
                    <Area
                        type="monotone"
                        dataKey="btcValue"
                        name="Portfolio Value"
                        stroke="#2563eb"
                        fill="#3b82f6"
                        fillOpacity={0.2}
                        strokeWidth={2}
                    />
                    <Area
                        type="monotone"
                        dataKey="cost"
                        name="Cumulative Cost"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.1}
                        strokeWidth={2}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
