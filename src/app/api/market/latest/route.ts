
import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const runtime = 'edge';
export const dynamic = 'force-dynamic'; // Ensure no caching

export async function GET(request: Request) {
    try {
        // 1. Fetch ASIC Miner Value Data (Blob)
        let marketData = { miners: [] };
        try {
            const { blobs } = await list({ prefix: 'market-prices.json', limit: 1 });
            if (blobs.length > 0) {
                const blobUrl = `${blobs[0].url}?t=${Date.now()}`;
                const res = await fetch(blobUrl, { cache: 'no-store' });
                if (res.ok) marketData = await res.json();
            }
        } catch (e) {
            console.warn("Failed to fetch market-prices.json blob", e);
        }

        // 2. Fetch Telegram Data (Local or Blob)
        let telegramData = [];
        try {
            // Try Local First (Dev)
            if (process.env.NODE_ENV === 'development') {
                try {
                    const localUrl = 'http://localhost:3000/miners-latest.json';
                    const res = await fetch(localUrl, { cache: 'no-store' });
                    if (res.ok) telegramData = await res.json();
                } catch (e) { }
            }

            // If empty, try Blob
            if (!telegramData.length) {
                const { blobs } = await list({ prefix: 'miners-latest.json', limit: 1 });
                if (blobs.length > 0) {
                    const blobUrl = `${blobs[0].url}?t=${Date.now()}`;
                    const res = await fetch(blobUrl, { cache: 'no-store' });
                    if (res.ok) telegramData = await res.json();
                }
            }
        } catch (e) {
            console.warn("Failed to fetch miners-latest.json", e);
        }

        // 3. Merge Data
        const merged = mergeMarketData(marketData.miners || [], telegramData || []);

        return NextResponse.json({ miners: merged });
    } catch (error) {
        console.error('Error fetching market data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

function mergeMarketData(marketMiners: any[], telegramMiners: any[]) {
    // Clone to avoid mutation if needed
    const result = [...marketMiners];

    for (const tgMiner of telegramMiners) {
        // tgMiner is now Aggregated: { name, hashrateTH, price (middle), stats: {min, max, middle, count}, listings }
        if (!tgMiner.price || tgMiner.price <= 0) continue;

        // Find match
        // 1. Match by exact Hashrate (+- 1%) AND similar name
        // Find match
        // 1. Match by exact Hashrate (+- 1%) AND similar name
        const matchIndex = result.findIndex(m => {
            if (!m.specs?.hashrateTH) return false;

            // Hashrate check
            const hashrateMatch = Math.abs(m.specs.hashrateTH - tgMiner.hashrateTH) < (tgMiner.hashrateTH * 0.02); // 2% tolerance
            if (!hashrateMatch) return false;

            // Name check: normalized
            const normM = normalizeMinerName(m.name);
            const normT = normalizeMinerName(tgMiner.name);

            return normM.includes(normT) || normT.includes(normM);
        });

        if (matchIndex !== -1) {
            // Update existing
            const m = result[matchIndex];

            // 1. Merge Listings
            const originalListings = m.listings || [];
            const telegramListings = (tgMiner.listings || []).map((l: any) => ({
                vendor: l.source || "Telegram Broker",
                price: l.price,
                currency: "USD",
                stockStatus: "Spot",
                url: "#"
            }));

            // Combine
            m.listings = [...telegramListings, ...originalListings];

            // 2. Recalculate Stats (Weighted by listings)
            const allPrices = m.listings.map((l: any) => l.price).filter((p: number) => p > 0).sort((a: number, b: number) => a - b);

            if (allPrices.length > 0) {
                const count = allPrices.length;
                const mid = Math.floor(count / 2);
                const median = count % 2 === 0 ? (allPrices[mid - 1] + allPrices[mid]) / 2 : allPrices[mid];

                m.stats.middlePrice = Math.round(median);
                m.stats.minPrice = allPrices[0];
                m.stats.maxPrice = allPrices[count - 1];
                m.stats.avgPrice = Math.round(allPrices.reduce((a: number, b: number) => a + b, 0) / count);
                m.stats.vendorCount = count;
            } else {
                // Fallback if no valid prices found during merge (unlikely if loop check passed)
                m.stats.middlePrice = tgMiner.stats?.middle || tgMiner.price;
            }

            m.stats.lastUpdated = new Date().toISOString();

            // Only tag source if mostly Telegram? Or just leave it generic.
            // User asked to treat it as "Market Prices".
            // We can append source info if needed, but "Telegram Spot (Aggregated)" was for the overwrite.
            // Let's rely on listings to show source.
            m.source = 'Market Aggregated';

        } else {
            // Add new entry
            result.push({
                id: tgMiner.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                name: tgMiner.name,
                specs: {
                    hashrateTH: tgMiner.hashrateTH,
                    powerW: 0,
                    algo: 'SHA-256'
                },
                listings: (tgMiner.listings || []).map((l: any) => ({
                    vendor: l.source || "Telegram Broker",
                    price: l.price,
                    currency: "USD",
                    stockStatus: "Spot",
                    url: "#"
                })),
                stats: {
                    minPrice: tgMiner.stats?.min || tgMiner.price,
                    maxPrice: tgMiner.stats?.max || tgMiner.price,
                    avgPrice: tgMiner.stats?.avg || tgMiner.price,
                    middlePrice: tgMiner.stats?.middle || tgMiner.price,
                    vendorCount: tgMiner.stats?.count || 1,
                    lastUpdated: new Date().toISOString()
                }
            });
        }
    }

    return result;
}

function normalizeMinerName(name: string): string {
    let lower = name.toLowerCase();

    // 1. Remove Brands
    lower = lower.replace(/antminer|whatsminer|bitmain|microbt|avalon|canaan/g, '');

    // 2. Standardize Series/Terms
    lower = lower.replace(/\bhydro\b/g, 'hyd'); // Hydro -> hyd
    // lower = lower.replace(/\bhyd\b/g, 'hyd'); // already hyd
    lower = lower.replace(/\bplus\b/g, '+');    // Plus -> +
    lower = lower.replace(/\bpro\b/g, 'pro');
    lower = lower.replace(/\bxp\b/g, 'xp');

    // 3. Cleanup
    // Remove all non-alphanumeric characters (including spaces, dashes)
    // allowing us to match "s21+hyd" with "s21hyd" easily if separators differ
    return lower.replace(/[^a-z0-9+]/g, '');
}
