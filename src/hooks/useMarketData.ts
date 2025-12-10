import { useState, useEffect } from 'react';
import { fetchMarketData } from '@/lib/api';
import { DEFAULT_MARKET_CONDITIONS } from '@/lib/constants';
import { MarketConditions } from '@/lib/price-simulator-calculator';

interface UseMarketDataResult {
    market: MarketConditions;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    setMarket: (market: MarketConditions) => void;
}


export function useMarketData(initialMarket?: MarketConditions): UseMarketDataResult {
    const [market, setMarket] = useState<MarketConditions>(initialMarket || DEFAULT_MARKET_CONDITIONS);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchMarketData();
            // Merge fetched data with current state or defaults to preserve user overrides if any,
            // but usually we want fresh data to override.
            // Here we map the specific fields we expect from the API.
            setMarket(prev => ({
                ...prev,
                btcPrice: data.btcPrice,
                networkDifficulty: data.networkDifficulty
            }));
        } catch (e) {
            console.error("Failed to load market data", e);
            setError(e instanceof Error ? e : new Error('Unknown error fetching market data'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    return {
        market,
        loading,
        error,
        refresh: loadData,
        setMarket
    };
}
