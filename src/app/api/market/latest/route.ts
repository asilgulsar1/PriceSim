
import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { normalizeMinerName } from '@/lib/market-matching';

import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs'; // Switch to Node.js for FS access
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
        let telegramData: any[] = [];
        try {
            // Try Local First (Dev)
            if (process.env.NODE_ENV === 'development') {
                try {
                    // Match logic from telegram-rate/page.tsx
                    const localPath = path.join(process.cwd(), 'debug-output.json');
                    const data = await fs.readFile(localPath, 'utf-8');
                    telegramData = JSON.parse(data);

                    // Handle wrapped format if any
                    if (!Array.isArray(telegramData) && (telegramData as any).miners) {
                        telegramData = (telegramData as any).miners;
                    }
                } catch (e) {
                    console.warn("Local FS read failed, trying fetch...", e);
                    const localUrl = 'http://localhost:3000/miners-latest.json';
                    const res = await fetch(localUrl, { cache: 'no-store' });
                    if (res.ok) {
                        const raw = await res.json();
                        telegramData = Array.isArray(raw) ? raw : (raw.miners || []);
                    }
                }
            }

            // If empty, try Blob
            if (telegramData.length === 0) {
                const { blobs } = await list({ prefix: 'miners-latest.json', limit: 1 });
                if (blobs.length > 0) {
                    const blobUrl = `${blobs[0].url}?t=${Date.now()}`;
                    const res = await fetch(blobUrl, { cache: 'no-store' });
                    if (res.ok) {
                        const raw = await res.json();
                        telegramData = Array.isArray(raw) ? raw : (raw.miners || []);
                    }
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

return result;
}

// Helper to look up power from static DB
import { INITIAL_MINERS } from '@/lib/miner-data';

function getPowerForMiner(name: string, hashrate: number): number {
    const nName = normalizeMinerName(name);
    // 1. Direct Hashrate Match in Static DB
    const match = INITIAL_MINERS.find(m => {
        const mName = normalizeMinerName(m.name);
        return (mName.includes(nName) || nName.includes(mName)) &&
            Math.abs(m.hashrateTH - hashrate) < (hashrate * 0.05);
    });
    if (match) return match.powerWatts;

    // 2. Generic Model Match (Less accurate)
    const genericMatch = INITIAL_MINERS.find(m => {
        const mName = normalizeMinerName(m.name);
        return (mName.includes(nName) || nName.includes(mName));
    });
    if (genericMatch) {
        // Scale power by hashrate ratio
        const ratio = hashrate / genericMatch.hashrateTH;
        return Math.round(genericMatch.powerWatts * ratio);
    }

    return 0;
}

function mergeMarketData(marketMiners: any[], telegramMiners: any[]) {
    // Clone to avoid mutation if needed
    const result = [...marketMiners];

    for (const tgMiner of telegramMiners) {
        let price = tgMiner.price;
        if (!price || price <= 0) continue;

        // SANITIZATION: Detect $/TH prices (< $100 usually)
        if (price < 100 && tgMiner.hashrateTH > 0) {
            price = Math.round(price * tgMiner.hashrateTH);
        }

        // ENRICHMENT: Backfill Power if missing
        let powerW = tgMiner.powerW || 0;
        if (powerW === 0 && tgMiner.hashrateTH > 0) {
            powerW = getPowerForMiner(tgMiner.name, tgMiner.hashrateTH);
        }

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
                price: l.price || price, // Use sanitized price fallback
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
                m.stats.middlePrice = tgMiner.stats?.middle || price;
            }

            // Backfill power if existing record was empty (unlikely for static miners but possible)
            if (!m.specs.powerW && powerW > 0) m.specs.powerW = powerW;

            m.stats.lastUpdated = new Date().toISOString();
            m.source = 'Market Aggregated';

        } else {
            // Add new entry
            result.push({
                id: tgMiner.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                name: tgMiner.name,
                specs: {
                    hashrateTH: tgMiner.hashrateTH,
                    powerW: powerW, // Use enriched power
                    algo: 'SHA-256'
                },
                listings: (tgMiner.listings || []).map((l: any) => ({
                    vendor: l.source || "Telegram Broker",
                    price: l.price || price,
                    currency: "USD",
                    stockStatus: "Spot",
                    url: "#"
                })),
                stats: {
                    minPrice: tgMiner.stats?.min || price,
                    maxPrice: tgMiner.stats?.max || price,
                    avgPrice: tgMiner.stats?.avg || price,
                    middlePrice: tgMiner.stats?.middle || price,
                    vendorCount: tgMiner.stats?.count || 1,
                    lastUpdated: new Date().toISOString()
                }
            });
        }
    }

    return result;
}


