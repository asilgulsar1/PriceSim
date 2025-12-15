
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { fetchMarketData } from '@/lib/api';
import { split } from 'postcss/lib/list'; // Ensure no bad auto-imports.
import { saveSimulationLog } from '@/lib/storage';
import { solveMinerPrice } from '@/lib/pricing-solver';
import { INITIAL_MINERS } from '@/lib/miner-data';
import { ContractTerms, MarketConditions } from '@/lib/price-simulator-calculator';
import { rankMiners } from '@/lib/miner-scoring';
import { DEFAULT_MARKET_CONDITIONS, DEFAULT_CONTRACT_TERMS, DEFAULT_TARGET_MARGIN } from '@/lib/constants';

export const runtime = 'edge';

export async function GET(request: Request) {
    // Basic authorization check
    const authHeader = request.headers.get('authorization');

    // Secure Check: Fail if secret is missing or doesn't match
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Fetch Fresh Market Data
        const marketData = await fetchMarketData();

        // 2. Define Standard Market Config
        const market: MarketConditions = {
            ...DEFAULT_MARKET_CONDITIONS,
            btcPrice: marketData.btcPrice,
            networkDifficulty: marketData.networkDifficulty
        };

        // 3. Define Standard Contract & Target
        const contract: ContractTerms = DEFAULT_CONTRACT_TERMS;
        const targetProfitPercent = DEFAULT_TARGET_MARGIN;

        // 4. Fetch Market Miners (for new models)
        // We replicate PriceSimulator logic server-side
        let marketMiners: unknown[] = [];
        try {
            // We use the internal API route logic via direct Blob List for speed/reliability in Cron
            // But we can just use the public URL if we knew it? 
            // Better to list.
            const { list } = await import('@vercel/blob');
            const { blobs } = await list({ prefix: 'market-prices.json', limit: 1 });
            if (blobs.length > 0) {
                const res = await fetch(blobs[0].url, { cache: 'no-store' });
                const json = await res.json();
                marketMiners = json.miners || [];
            }
        } catch (e) {
            console.error("Failed to fetch market miners in cron", e);
        }

        // 5. Merge & Filter Miners (Smart Selection)
        const { processAndSelectMiners } = await import('@/lib/miner-data');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let combinedMiners: any[] = [];

        if (marketMiners.length > 0) {
            // Dynamic Mode: Use ONLY market miners (filtered & selected)
            // We cast because we assume the JSON structure matches our interface for now
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            combinedMiners = processAndSelectMiners(marketMiners as any);
        } else {
            // Fallback: Use Manual List if API fails
            combinedMiners = [...INITIAL_MINERS];
        }

        // 6. Calculate for ALL miners
        const calculated = combinedMiners.map(miner => {
            return solveMinerPrice(miner, contract, market, targetProfitPercent, false);
        });

        // 7. Rank and Score
        const ranked = rankMiners(calculated);

        // 8. Create Payload with Timestamp
        const payload = {
            updatedAt: new Date().toISOString(),
            market,
            miners: ranked
        };

        // 9. Store using centralized storage utility
        await saveSimulationLog(payload, false);

        return NextResponse.json({ success: true, count: ranked.length, timestamp: payload.updatedAt });

    } catch (error) {
        console.error('Cron job failed:', error);
        return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
    }
}
