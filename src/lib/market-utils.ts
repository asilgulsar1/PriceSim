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
import { findBestStaticMatch, normalizeMinerName } from './market-matching';
import { slugify } from '@/lib/slug-utils';

export function mergeMarketData(marketMiners: any[], telegramMiners: any[]) {
    // Master Map: Key = Slug(CleanName + Hashrate)
    const mergedMap = new Map<string, any>();

    // Helper to process any miner (Web or Telegram)
    const processMiner = (miner: any, isTelegram: boolean) => {
        // 1. Sanitize Price (Fix $/TH < 100)
        let price = miner.price || (miner.stats ? miner.stats.middlePrice : 0);
        const hashrate = miner.specs?.hashrateTH || miner.hashrateTH || 0;

        if (price < 100 && price > 0 && hashrate > 0) {
            price = Math.round(price * hashrate);
        }

        if (price <= 0) return; // Skip invalid prices

        // 2. Normalize Identity
        // Try to match against Static DB first
        const match = findBestStaticMatch(miner.name, INITIAL_MINERS);

        // Strict Filter: If user wants only BTC/known miners, we could filter here.
        // For now, we allow "Unmatched" if they look like miners, but prioritize clean names.

        let cleanName = match ? match.name : miner.name;
        let powerW = miner.specs?.powerW || miner.powerW || 0;

        // Enrich Power if matched
        if (match && (!powerW || powerW === 0)) {
            powerW = match.powerWatts;
        } else if (!powerW && hashrate > 0) {
            // Fallback enrichment
            powerW = getPowerForMiner(cleanName, hashrate);
        }

        // Create Unique Key (Deduplication Core)
        // Group precisely by Name + Hashrate to separate variants (S19k Pro 115T vs 120T)
        const key = slugify(`${cleanName}-${hashrate}`);

        if (!mergedMap.has(key)) {
            // New Entry
            mergedMap.set(key, {
                id: key,
                name: cleanName,
                specs: {
                    hashrateTH: hashrate,
                    powerW: powerW,
                    algo: 'SHA-256'
                },
                listings: [],
                stats: {
                    minPrice: price,
                    maxPrice: price,
                    avgPrice: price,
                    middlePrice: price,
                    vendorCount: 0,
                    lastUpdated: new Date().toISOString()
                },
                source: isTelegram ? 'Telegram' : 'Web'
            });
        }

        // Add Listing
        const entry = mergedMap.get(key);

        // Flatten source listings if they exist
        const rawListings = miner.listings || [];

        if (rawListings.length > 0) {
            // Import existing listings
            rawListings.forEach((l: any) => {
                let lPrice = l.price;
                if (lPrice < 100 && hashrate > 0) lPrice = lPrice * hashrate;

                entry.listings.push({
                    vendor: l.vendor || l.source || (isTelegram ? "Telegram Broker" : "MarketPlace"),
                    price: lPrice,
                    currency: "USD",
                    stockStatus: "Spot",
                    url: l.url || "#",
                    isTelegram: l.isTelegram || isTelegram
                });
            });
        } else {
            // Create a listing from the main record itself
            entry.listings.push({
                vendor: miner.source || (isTelegram ? "Telegram Broker" : "Available"), // TODO: Pass vendor name better
                price: price,
                currency: "USD",
                stockStatus: "Spot",
                url: "#",
                isTelegram: isTelegram
            });
        }
    };

    // Process Both Sets
    marketMiners.forEach(m => processMiner(m, false));
    telegramMiners.forEach(m => processMiner(m, true));

    // Finalize Stats for each merged entry
    const finalResults = Array.from(mergedMap.values()).map(m => {
        const prices = m.listings.map((l: any) => l.price).filter((p: number) => p > 0).sort((a: number, b: number) => a - b);
        const count = prices.length;

        if (count > 0) {
            const mid = Math.floor(count / 2);
            const median = count % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];

            m.stats.minPrice = prices[0];
            m.stats.maxPrice = prices[count - 1];
            m.stats.avgPrice = Math.round(prices.reduce((a: number, b: number) => a + b, 0) / count);
            m.stats.middlePrice = Math.round(median);
            m.stats.vendorCount = count;
        }

        return m;
    });

    return finalResults.sort((a, b) => b.specs.hashrateTH - a.specs.hashrateTH); // Sort by hashrate default
}
