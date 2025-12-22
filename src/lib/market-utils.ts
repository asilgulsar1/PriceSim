import { normalizeMinerName } from './market-matching';
import { INITIAL_MINERS } from './miner-data';

// ------------------------------------------------------------------
// Helper: Power Enrichment
// ------------------------------------------------------------------
export function getPowerForMiner(name: string, hashrate: number): number {
    const nName = normalizeMinerName(name);

    // 1. Direct Hashrate Match in Static DB
    const match = INITIAL_MINERS.find(m => {
        const mName = normalizeMinerName(m.name);
        return (mName.includes(nName) || nName.includes(mName)) &&
            Math.abs(m.hashrateTH - hashrate) < (hashrate * 0.05); // 5% tolerance
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

    return 0; // Failed to match
}

// ------------------------------------------------------------------
// Logic: Merge Telegram Data into Market Data
// ------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
export function mergeMarketData(marketMiners: any[], telegramMiners: any[]) {
    // Clone to avoid mutation
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
        // 1. Match by exact Hashrate (+- 2%) AND similar name
        const matchIndex = result.findIndex(m => {
            if (!m.specs?.hashrateTH) return false;

            // Hashrate check
            const hashrateMatch = Math.abs(m.specs.hashrateTH - tgMiner.hashrateTH) < (tgMiner.hashrateTH * 0.02);
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
                url: "#",
                isTelegram: true
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
                // Fallback if no valid prices found
                m.stats.middlePrice = tgMiner.stats?.middle || price;
            }

            // Backfill power if existing record was empty
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
                    url: "#",
                    isTelegram: true
                })),
                stats: {
                    minPrice: tgMiner.stats?.min || price,
                    maxPrice: tgMiner.stats?.max || price,
                    avgPrice: tgMiner.stats?.avg || price,
                    middlePrice: tgMiner.stats?.middle || price,
                    vendorCount: tgMiner.stats?.count || 1,
                    lastUpdated: new Date().toISOString()
                },
                source: 'Market Aggregated'
            });
        }
    }

    return result;
}
