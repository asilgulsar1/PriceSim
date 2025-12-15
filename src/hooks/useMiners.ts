import { useState, useEffect } from 'react';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { MinerProfile } from '@/lib/calculator';
import { processAndSelectMiners, INITIAL_MINERS } from '@/lib/miner-data';

interface UseMinersResult {
    miners: MinerProfile[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

export function useMiners(): UseMinersResult {
    const [miners, setMiners] = useState<MinerProfile[]>(INITIAL_MINERS);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const loadMiners = async () => {
        setLoading(true);
        setError(null);
        try {
            // Use standard market/latest API which is the authoritative source
            const res = await fetch('/api/market/latest');
            if (!res.ok) throw new Error('Failed to fetch market miners');

            const json = await res.json();
            const data: any[] = json.miners || [];

            let processedMiners: MinerProfile[] = [];

            if (data.length > 0) {
                // Dynamic Mode: Use ONLY market miners (filtered & selected)
                processedMiners = processAndSelectMiners(data);
            } else {
                // Fallback
                processedMiners = [...INITIAL_MINERS];
            }

            if (processedMiners.length > 0) {
                setMiners(processedMiners);
            }
        } catch (e) {
            console.error("Error loading dynamic miners:", e);
            // Fallback to initial miners is already set as default state, 
            // but we might want to ensure it remains if fetch failed.
            // (State holds INITIAL_MINERS by default, so we are good).
            setError(e instanceof Error ? e : new Error('Unknown error fetching miners'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMiners();
    }, []);

    return {
        miners,
        loading,
        error,
        refresh: loadMiners
    };
}
