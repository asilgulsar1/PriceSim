"use client";

import React, { useState, useEffect } from 'react';
import { MinerProfile } from '@/lib/miner-data';
import { useMarketData } from '@/hooks/useMarketData';
import { solveMinerPrice } from '@/lib/pricing-solver';
import { DEFAULT_CONTRACT_TERMS, DEFAULT_TARGET_MARGIN } from '@/lib/constants';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductPricingProps {
    miner: MinerProfile;
}

export function ProductPricing({ miner }: ProductPricingProps) {
    const { market, loading: marketLoading } = useMarketData();
    const [price, setPrice] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!marketLoading && market) {
            // Calculate price based on default contract terms
            // We assume a standard contract for the "Displayed Price"
            const contract = DEFAULT_CONTRACT_TERMS;

            try {
                const result = solveMinerPrice(
                    miner,
                    contract,
                    market,
                    DEFAULT_TARGET_MARGIN,
                    false // Not BTC target
                );
                setPrice(result.calculatedPrice);
            } catch (e) {
                console.error("Failed to calculate price", e);
            } finally {
                setLoading(false);
            }
        }
    }, [market, marketLoading, miner]);

    if (marketLoading || loading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Calculating live market price...</span>
            </div>
        );
    }

    if (!price) {
        return <div className="text-amber-500">Price currently unavailable</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">
                    ${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-sm text-muted-foreground">
                    USD / unit
                </span>
            </div>
            <div className="text-xs text-muted-foreground">
                Updated based on live market difficulty & BTC price.
            </div>

            <Button className="w-full md:w-auto" size="lg">
                Request Quote
            </Button>
        </div>
    );
}
