import { normalizeMinerName, findBestStaticMatch } from './market-matching';
import { INITIAL_MINERS } from './miner-data';
import { slugify } from '@/lib/slug-utils';

// ------------------------------------------------------------------
// Efficiency Map (J/TH) for Power Backfill
// ------------------------------------------------------------------
const SERIES_EFFICIENCY: Record<string, number> = {
    's21 xp hydro': 13.0,
    's21 hydro': 16.0,
    's21 xp': 13.5,
    's21 pro': 15.0,
    's21+': 16.5,
    's21': 17.5,
    't21': 19.0,
    's19 xp hydro': 20.8,
    's19 xp': 21.5,
    's19 k': 23.0,
    's19 j pro': 29.5,
    's19 pro': 29.5,
    's19': 34.5,
    // Whatsminer
    'm66s': 18.5,
    'm63s': 18.5,
    'm60s': 18.5,
    'm60': 20.0,
    'm50s': 26.0,
    'm50': 28.0,
    'm30s': 32.0,
    // Avalon
    'a15': 19.0,
    'a14': 20.5,
    'a13': 25.0
};

function estimatePowerFromSeries(name: string, hashrate: number): number {
    const slug = slugify(name);
    // Sort keys by length descending to match "s21 xp hydro" before "s21"
    const keys = Object.keys(SERIES_EFFICIENCY).sort((a, b) => b.length - a.length);
    for (const k of keys) {
        // "s21-xp" vs "s21 xp" - slugify handles punctuation/spaces mostly
        if (slug.includes(slugify(k))) {
            return Math.round(hashrate * SERIES_EFFICIENCY[k]);
        }
    }
    // Default Fallback (Assume ~22 J/TH for modern generic miners)
    return Math.round(hashrate * 22.0);
}

function normalizeForKey(name: string): string {
    let n = name.toLowerCase();
    // 1. Strip Brands
    n = n.replace(/antminer|whatsminer|bitmain|microbt|avalon|canaan|bitdeer|sealminer/g, '');
    // 2. Normalize Series
    n = n.replace(/\bplus\b/g, '+');
    n = n.replace(/\bhyd\b/g, 'hydro');
    n = n.replace(/\bpro\b/g, 'pro'); // distinct word
    // 3. Remove non-alphanumeric (except +)
    // slugify will handle the rest, but we want "s21+" to remain
    return slugify(n);
}

// ------------------------------------------------------------------
// Logic: Merge Telegram Data into Market Data
// ------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */

export function mergeMarketData(marketMiners: any[], telegramMiners: any[]) {
    // Master Map: Key = Strictly Normalized [Series-Hashrate]
    const mergedMap = new Map<string, any>();

    // Helper to process any miner (Web or Telegram)
    const processMiner = (miner: any, isTelegram: boolean) => {
        // 1. Sanitize Price (Fix $/TH < 100)
        let price = miner.price || (miner.stats ? miner.stats.middlePrice : 0);

        // 2. Hashrate Extraction (Granular Normalization)
        let hashrate = miner.specs?.hashrateTH || miner.hashrateTH || 0;

        // If Hashrate is missing, try to extract from Name (e.g. "S21+ 338T")
        if (!hashrate || hashrate === 0) {
            const hashMatch = miner.name.match(/(\d{2,4})\s*(T|TH|th|Th)/);
            if (hashMatch) {
                hashrate = parseInt(hashMatch[1]);
            }
        }

        if (price < 100 && price > 0 && hashrate > 0) {
            price = Math.round(price * hashrate);
        }

        if (price <= 0) return; // Skip invalid prices

        // 3. Normalize Identity
        // Try to match against Static DB first to Clean the Name
        const match = findBestStaticMatch(miner.name, INITIAL_MINERS);

        let cleanName = match ? match.name : miner.name;

        // 4. Strict Key Generation
        // Remove Brand, Normalize Series, Append Hashrate
        // "Antminer S21+ 338T" -> "s21-plus-338"
        // "S21 Plus 338 T"     -> "s21-plus-338"
        // This ensures distinct sources merge into one row.
        const seriesKey = normalizeForKey(cleanName);
        const uniqueKey = `${seriesKey}-${hashrate}`;

        let powerW = miner.specs?.powerW || miner.powerW || 0;

        // 5. Power Enrichment (Critical for Simulation)
        if (match && (!powerW || powerW === 0)) {
            // Perfect Match -> Use Static DB
            powerW = match.powerWatts;
        }

        // Ensure Power is NEVER 0 if Hashrate exists
        if ((!powerW || powerW === 0) && hashrate > 0) {
            // Use Series-based Efficiency
            powerW = estimatePowerFromSeries(cleanName, hashrate);
        }

        if (!mergedMap.has(uniqueKey)) {
            // New Entry
            mergedMap.set(uniqueKey, {
                id: uniqueKey,
                name: cleanName, // We display the "Cleanest" name we found
                specs: {
                    hashrateTH: hashrate,
                    powerW: powerW, // Enriched Power
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
        } else {
            // Optional: Update name if current is cleaner? 
            // Keeping first found (likely via findBestStaticMatch) is usually safe.
        }

        // Add Listing
        const entry = mergedMap.get(uniqueKey);

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
                vendor: miner.source || (isTelegram ? "Telegram Broker" : "Available"),
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
