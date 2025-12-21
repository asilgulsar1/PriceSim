/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { solveMinerPrice, SolvedMiner } from "@/lib/pricing-solver";
import { rankMiners } from "@/lib/miner-scoring";
import { findMatchingMarketMiner, SimpleMarketMiner } from "@/lib/market-matching";
import { DEFAULT_CONTRACT_TERMS, DEFAULT_TARGET_MARGIN } from "@/lib/constants";
import { INITIAL_MINERS } from "@/lib/miner-data";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // 0. Security Check
        const authHeader = request.headers.get('x-api-key');
        if (authHeader !== process.env.PRICE_LIST_API_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch Market Prices (Parallel)
        const marketPromise = (async () => {
            const { blobs } = await list({ prefix: 'market-prices.json', limit: 1 });
            if (blobs.length === 0) return [];
            // Cache busting
            const blobUrl = `${blobs[0].url}?t=${Date.now()}`;
            const res = await fetch(blobUrl, { cache: 'no-store' });
            if (!res.ok) return [];
            const data = await res.json();
            if (data.miners && Array.isArray(data.miners)) {
                const list: SimpleMarketMiner[] = [];
                data.miners.forEach((miner: any) => {
                    if (miner.name && miner.stats && miner.stats.middlePrice > 0) {
                        list.push({
                            name: miner.name,
                            stats: { middlePrice: miner.stats.middlePrice },
                            specs: { hashrateTH: miner.specs?.hashrateTH || 0 }
                        });
                    }
                });
                return list;
            }
            return [];
        })();

        // 2. Fetch Simulator Data (Parallel)
        const simPromise = (async () => {
            const { blobs } = await list({ prefix: 'miners-latest.json', limit: 1 });
            if (blobs.length === 0) return null;
            const res = await fetch(blobs[0].url, { cache: 'no-store' });
            if (!res.ok) return null;
            return await res.json();
        })();

        const [marketDataList, simData] = await Promise.all([marketPromise, simPromise]);

        // 3. Determine Base Miners
        let minersToRank: SolvedMiner[] = [];
        const marketConditions = simData?.market; // Use stored market if available

        if (simData && simData.miners && Array.isArray(simData.miners)) {
            // Use cached simulation data
            minersToRank = simData.miners.map((x: any) => x.miner || x); // Handle wrapped vs unwrapped
        } else {
            // Fallback: Calculate Locally
            // Need market conditions. If not in simData, fetch/mock? 
            // Ideally we should fetch market conditions too, but for now we might have to rely on constants if not found
            // Or use the one from simData (which might be null).
            // Let's use DEFAULT constants if no simData.
            const market = simData?.market || (await import("@/lib/constants")).DEFAULT_MARKET_CONDITIONS;

            // Actually, locally calculating is expensive on Edge. 
            // Ideally we rely on 'miners-latest.json'. 
            // But if it's missing, we do a quick calc.
            minersToRank = INITIAL_MINERS.map(miner => {
                return solveMinerPrice(miner, DEFAULT_CONTRACT_TERMS, market, DEFAULT_TARGET_MARGIN, false);
            });
        }

        // 4. Rank and Adjust Prices
        // Rank first to match UI logic (though UI ranks after adjustment? No, UI ranks then adjusts? 
        // Logic in UI: 
        //  1. rankMiners(rawMiners) -> baseResults
        //  2. results = baseResults.map(item => { ... market match ... })
        //  3. rankMiners(minersOnly) again? No, it re-ranks.

        // Let's mimic UI: Map then Rank.
        // Actually UI does: ranked = rankMiners(rawMiners). SetBaseResults.
        // Then useMemo results: map baseResults (apply market price), then rankMiners(minersOnly).

        // So:
        // A. Rank raw (optional, but good for scoring)
        // B. Apply Market Match logic
        // C. Re-Rank

        // Step A is implicitly handled if we just map then rank.

        const adjustedMiners = minersToRank.map(miner => {
            // Clone
            const m = { ...miner };

            // Market Match
            const matchResult = findMatchingMarketMiner(m, marketDataList);
            const basePrice = Math.max(m.calculatedPrice, matchResult.price);

            m.calculatedPrice = basePrice;

            // Recalculate ROI (Profitability)
            if (m.calculatedPrice > 0 && m.dailyRevenueUSD > 0) {
                m.clientProfitabilityPercent = ((m.dailyRevenueUSD * 365) / m.calculatedPrice) * 100;
            } else {
                m.clientProfitabilityPercent = 0;
            }

            return m;
        });

        const finalRanked = rankMiners(adjustedMiners);

        // 5. Filter for Public Display
        const publicMiners = finalRanked.map(item => {
            const m = item.miner;
            return {
                name: m.name,
                hashrateTH: m.hashrateTH,
                powerWatts: m.powerWatts,
                efficiency: (m.powerWatts / m.hashrateTH).toFixed(2),
                price: m.calculatedPrice,
                dailyRevenueUSD: m.dailyRevenueUSD,
                roiPercent: m.clientProfitabilityPercent.toFixed(2),
                score: item.score
            };
        });

        return NextResponse.json({
            updatedAt: new Date().toISOString(),
            count: publicMiners.length,
            miners: publicMiners
        });

    } catch (error) {
        console.error('Error generating price list API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
