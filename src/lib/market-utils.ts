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

// Universal Identity Logic (Must match parse-telegram-prices.js)
function normalizeForKey(name: string): string {
    let n = name.toLowerCase();
    // 1. Strip Brands
    n = n.replace(/antminer|whatsminer|bitmain|microbt|avalon|canaan|bitdeer|sealminer/g, '');
    // 2. Normalize Series
    n = n.replace(/\bplus\b/g, '+');
    n = n.replace(/\bhyd\b/g, 'hydro');
    n = n.replace(/\bpro\b/g, 'pro');
    // 3. Strip embedded hashrate strings like "216T" from name for the Key (to avoid s21-216t-216)
    n = n.replace(/(\d+)(t|th|g|gh|m|mh)/g, '');

    // 4. Remove non-alphanumeric (except +)
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

        // Use Matched Name if available, otherwise allow raw name but we will clean it in Key
        let cleanName = match ? match.name : miner.name;

        // 4. Universal Strict Key Generation
        // Key = Slug(CleanNameWithoutHash) + "-" + IntegerHashrate
        const seriesKey = normalizeForKey(cleanName);
        const hashInt = Math.floor(hashrate);
        const uniqueKey = `${seriesKey}-${hashInt}`;

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

        // 6. Universal Naming Standard Reconstruction
        // Format: [Brand] [Series] [Variant] [Hashrate]T
        // Example: Antminer S21+ Hydro 395T

        let displayName = cleanName;

        // A. Infer Brand if missing (for Telegram items like "S21")
        const lowerName = displayName.toLowerCase();
        if (!lowerName.includes('antminer') && !lowerName.includes('whatsminer') && !lowerName.includes('avalon') && !lowerName.includes('bitdeer') && !lowerName.includes('sealminer')) {
            // Heuristic Brand Assignment
            if (lowerName.startsWith('s') || lowerName.startsWith('t') || lowerName.startsWith('l') || lowerName.startsWith('k')) {
                displayName = `Antminer ${displayName}`;
            } else if (lowerName.startsWith('m')) {
                displayName = `Whatsminer ${displayName}`;
            } else if (lowerName.startsWith('a')) {
                displayName = `Avalon ${displayName}`;
            }
        }

        // B. Aggressive Token Cleanup (Remove redundant hashrate artifacts)
        // e.g. "Antminer S19 (95Th)" -> "Antminer S19"
        // 1. Remove parenthesized/bracketed hashrate: (95T), [95Th], (95 Th)
        displayName = displayName.replace(/[\[\(]\s*\d+(?:\.\d+)?\s*(t|th|g|m|gh|mh)?[\]\)]/gi, '');

        // 2. Remove loose hashrate-like numbers at the end of string if extracted hashrate > 0
        if (hashrate > 0) {
            // Remove exact matches of hashrate + T/TH
            const hrRegex = new RegExp(`\\b${hashrate}(?:\\.0)?\\s*(t|th)?\\b`, 'gi');
            displayName = displayName.replace(hrRegex, '');

            // Remove floor(hashrate) + T/TH (e.g. "95" vs "95T")
            const floorHrRegex = new RegExp(`\\b${hashInt}\\s*(t|th)?\\b`, 'gi');
            displayName = displayName.replace(floorHrRegex, '');
        }

        // 3. Cleanup empty parens and spaces
        displayName = displayName.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '').replace(/\s+/g, ' ').trim();

        // C. Standardize Hashrate Suffix
        // Check if name already implies exact hashrate (e.g. "Antminer S21+ 395T")
        // Since we aggressively stripped it above, we should usually append.
        // But check if strict Standard T pattern exists at end.

        const hashrateSuffix = `${hashInt}T`;
        // Check if name ENDS with the hashrate (allowing for T/TH and case)
        const endsWithHash = new RegExp(`${hashInt}\\s*(t|th|g|m)?$`, 'i');

        if (!endsWithHash.test(displayName)) {
            // If name doesn't end with "395T", append it.
            displayName = `${displayName} ${hashrateSuffix}`;
        } else {
            // Ensure T suffix is standardized (e.g. replace "395 TH" with "395T")
            displayName = displayName.replace(endsWithHash, hashrateSuffix);
        }

        if (!mergedMap.has(uniqueKey)) {
            // New Entry
            mergedMap.set(uniqueKey, {
                id: uniqueKey,
                name: displayName, // UNIVERSAL STANDARD NAME
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
            // Entry exists.
            // Ensure we trust key.
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
