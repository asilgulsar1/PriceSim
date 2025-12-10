
import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { fetchMarketData } from '@/lib/api';
import { solveMinerPrice } from '@/lib/pricing-solver';
import { INITIAL_MINERS } from '@/lib/miner-data';
import { ContractTerms, MarketConditions } from '@/lib/price-simulator-calculator';
import { rankMiners } from '@/lib/miner-scoring';
import { DEFAULT_MARKET_CONDITIONS, DEFAULT_CONTRACT_TERMS, DEFAULT_TARGET_MARGIN } from '@/lib/constants';

export const runtime = 'edge';

export async function GET(request: Request) {
    // Basic authorization check
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Fetch Fresh Market Data
        const marketData = await fetchMarketData();

        // 2. Define Standard Market Config
        // Merge fetch data with Defaults for growth params
        const market: MarketConditions = {
            ...DEFAULT_MARKET_CONDITIONS,
            btcPrice: marketData.btcPrice,
            networkDifficulty: marketData.networkDifficulty
        };

        // 3. Define Standard Contract
        const contract: ContractTerms = DEFAULT_CONTRACT_TERMS;

        const targetProfitPercent = DEFAULT_TARGET_MARGIN; // Standard ROI from defaults

        // 4. Calculate for all Initial Miners
        const calculated = INITIAL_MINERS.map(miner => {
            return solveMinerPrice(miner, contract, market, targetProfitPercent, false);
        });

        // 5. Rank and Score
        const ranked = rankMiners(calculated);

        // 6. Create Payload with Timestamp
        const payload = {
            updatedAt: new Date().toISOString(),
            market,
            miners: ranked
        };

        // 7. Store to Vercel Blob
        // 'addRandomSuffix: false' ensures we overwrite or keep a predictable URL if we delete old ones
        // Actually, just uploading new will create new URL usually, but we want 'latest'.
        // Vercel Blob doesn't support 'overwrite' directly on same URL easily without `access: 'public'`.
        // We will just upload and the `list` in GET will grab the latest one (sorted by date usually).
        // Better: Upload with same pathname but Vercel Blob adds suffix.
        // We rely on `list` to find the newest.

        await put('miners-latest.json', JSON.stringify(payload), {
            access: 'public',
            addRandomSuffix: false // Try to keep clean name, though Blob might still version it
        });

        return NextResponse.json({ success: true, count: ranked.length, timestamp: payload.updatedAt });

    } catch (error) {
        console.error('Cron job failed:', error);
        return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
    }
}
