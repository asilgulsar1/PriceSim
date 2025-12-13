
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
        let marketMiners: any[] = [];
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

        // 5. Merge & Filter Miners
        const { getMinerReleaseYear } = await import('@/lib/miner-data');

        const combinedMiners = [...INITIAL_MINERS];
        const existingNames = new Set(INITIAL_MINERS.map(m => m.name));

        for (const m of marketMiners) {
            if (existingNames.has(m.name)) continue;

            // Specs Check
            if (!m.specs || !m.specs.hashrateTH || !m.specs.powerW) continue;

            // Year Filter (Same as PriceSimulator)
            // We allow INITIAL_MINERS always, but for NEW ones, enforcing 2023+
            const year = getMinerReleaseYear(m.name);
            if (year < 2023) continue;

            combinedMiners.push({
                name: m.name,
                hashrateTH: m.specs.hashrateTH,
                powerWatts: m.specs.powerW,
                price: 0 // Will be solved below
            });
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
