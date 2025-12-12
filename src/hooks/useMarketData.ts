import { useState, useEffect } from 'react';
import { getMarketDataAction } from '@/app/actions';
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
            // Use Server Action to avoid CORS and Client-side fetch issues
            const data = await getMarketDataAction();

            setMarket(prev => ({
                ...prev,
                btcPrice: data.btcPrice,
                networkDifficulty: data.networkDifficulty
            }));
        } catch (e) {
            console.error("Failed to load market data", e);
            // Even on error, we set loading false (finally block handles this), 
            // and we already have defaults in state, so app continues.
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
