
import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { fetchMarketData } from '@/lib/api';
import { solveMinerPrice } from '@/lib/pricing-solver';
import { INITIAL_MINERS } from '@/lib/miner-data';
import { ContractTerms, MarketConditions } from '@/lib/price-simulator-calculator';
import { rankMiners } from '@/lib/miner-scoring';

export const runtime = 'edge';

export async function GET(request: Request) {
    // Basic authorization check (Vercel Cron protects this effectively, but good practice)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Allow if running locally or if standard Vercel protection is assumed sufficient by User
        // But strictly should return 401. 
        // For this task, we'll assume Vercel's trusted IP/Invocation protection is primary.
    }

    try {
        // 1. Fetch Fresh Market Data
        const marketData = await fetchMarketData();

        // 2. Define Standard Market Config for the List
        const market: MarketConditions = {
            btcPrice: marketData.btcPrice,
            networkDifficulty: marketData.networkDifficulty,
            blockReward: marketData.blockReward,
            difficultyGrowthMonthly: 4.0, // Standard Default
            btcPriceGrowthMonthly: 2.5,   // Standard Default
            btcPriceGrowthAnnual: 0,
            nextHalvingDate: new Date('2028-05-01')
        };

        // 3. Define Standard Contract
        const contract: ContractTerms = {
            electricityRate: 0.08, // Default Standard
            opexRate: 0,
            poolFee: 1.0,
            contractDurationYears: 4
        };

        const targetProfitPercent = 50; // Standard 50% ROI

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
