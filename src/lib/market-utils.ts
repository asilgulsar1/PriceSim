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

        // 2. Hashrate Extraction & Guardrails
        let hashrate = miner.specs?.hashrateTH || miner.hashrateTH || 0;
        const lowerName = miner.name.toLowerCase();

        // Guardrails for known series to prevent Price/Unit tokens (e.g. "4T")
        const SERIES_MIN_HASHRATE: Record<string, number> = {
            's21': 100, 's19': 80, 't21': 150, 'm30': 70,
            'm50': 100, 'm60': 150, 'a13': 90, 'a14': 100, 'a15': 150
        };

        // Check if existing hashrate is suspicious
        if (hashrate > 0) {
            for (const [series, min] of Object.entries(SERIES_MIN_HASHRATE)) {
                if (lowerName.includes(series)) {
                    if (hashrate < min) {
                        hashrate = 0; // Reset bad hashrate
                        break;
                    }
                }
            }
        }

        // Try to re-extract if missing
        if (!hashrate || hashrate === 0) {
            const hashMatch = miner.name.match(/(\d{2,4})\s*(T|TH|th|Th)/);
            if (hashMatch) {
                const val = parseInt(hashMatch[1]);
                let regexValid = true;
                // Check Regex result against guardrails
                for (const [series, min] of Object.entries(SERIES_MIN_HASHRATE)) {
                    if (lowerName.includes(series) && val < min) {
                        regexValid = false;
                        break;
                    }
                }
                if (regexValid) hashrate = val;
            }
        }

        // 3. Normalize Identity & Fallback (Consolidated Step)
        // Find best static match for BOTH Name Cleaning AND Hashrate Fallback
        const match = findBestStaticMatch(miner.name, INITIAL_MINERS);

        // Fallback Hashrate from Static Match if still 0
        if ((!hashrate || hashrate === 0) && match) {
            hashrate = match.specs?.hashrateTH || (match as any).hashrateTH || 0;
        }

        if (price < 100 && price > 0 && hashrate > 0) {
            price = Math.round(price * hashrate);
        }

        if (price <= 0) return; // Skip invalid prices

        // Use Matched Name if available, otherwise allow raw name but we will clean it in Key
        let cleanName = match ? match.name : miner.name;

        // 4. Universal Strict Key Generation
        const seriesKey = normalizeForKey(cleanName);
        const hashInt = Math.floor(hashrate);
        const uniqueKey = `${seriesKey}-${hashInt}`;

        let powerW = miner.specs?.powerW || miner.powerW || 0;

        // 5. Power Enrichment
        if (match && (!powerW || powerW === 0)) {
            powerW = match.powerWatts;
        }

        // Ensure Power is NEVER 0 if Hashrate exists
        if ((!powerW || powerW === 0) && hashrate > 0) {
            // Use Series-based Efficiency
            powerW = estimatePowerFromSeries(cleanName, hashrate);
        }

        // 6. Universal Naming Standard Reconstruction
        let displayName = cleanName;

        // A. Infer Brand if missing
        if (!lowerName.includes('antminer') && !lowerName.includes('whatsminer') && !lowerName.includes('avalon') && !lowerName.includes('bitdeer') && !lowerName.includes('sealminer')) {
            if (lowerName.startsWith('s') || lowerName.startsWith('t') || lowerName.startsWith('l') || lowerName.startsWith('k')) {
                displayName = `Antminer ${displayName}`;
            } else if (lowerName.startsWith('m')) {
                displayName = `Whatsminer ${displayName}`;
            } else if (lowerName.startsWith('a')) {
                displayName = `Avalon ${displayName}`;
            }
        }

        // B. Aggressive Token Cleanup (Remove redundant hashrate artifacts)
        // 1. Remove parenthesized/bracketed hashrate: (95T), [95Th]
        displayName = displayName.replace(/[\[\(]\s*\d+(?:\.\d+)?\s*(t|th|g|m|gh|mh)?[\]\)]/gi, '');

        // 2. Remove loose hashrate-like numbers matching the extracted hashrate
        if (hashrate > 0) {
            const hrRegex = new RegExp(`\\b${hashrate}(?:\\.0)?\\s*(t|th)?\\b`, 'gi');
            displayName = displayName.replace(hrRegex, '');
            const floorHrRegex = new RegExp(`\\b${hashInt}\\s*(t|th)?\\b`, 'gi');
            displayName = displayName.replace(floorHrRegex, '');
        }

        // 3. Cleanup empty parens and spaces
        displayName = displayName.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '').replace(/\s+/g, ' ').trim();

        // C. Standardize Hashrate Suffix
        const hashrateSuffix = `${hashInt}T`;
        const endsWithHash = new RegExp(`${hashInt}\\s*(t|th|g|m)?$`, 'i');

        if (!endsWithHash.test(displayName)) {
            displayName = `${displayName} ${hashrateSuffix}`;
        } else {
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
            // Entry exists. Trust key.
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
