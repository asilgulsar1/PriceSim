
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

        // 7. Store using centralized storage utility (saves to logs/ AND miners-latest.json)
        // Importing dynamically or at top? Let's add import at top.
        await saveSimulationLog(payload, false);

        return NextResponse.json({ success: true, count: ranked.length, timestamp: payload.updatedAt });

    } catch (error) {
        console.error('Cron job failed:', error);
        return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
    }
}
