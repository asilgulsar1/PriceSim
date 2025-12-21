/* eslint-disable @typescript-eslint/no-unused-vars */
import { slugify } from "@/lib/slug-utils";

export interface SimpleMarketMiner {
    name: string;
    stats: { middlePrice: number };
    specs: { hashrateTH: number };
    source?: string;
}

// Robust matching helper using Hashrate + Series
export function findMatchingMarketMiner(simMiner: { name: string, hashrateTH: number }, marketMiners: SimpleMarketMiner[]): { price: number, source?: string } {
    const simHash = simMiner.hashrateTH;
    const simSlug = slugify(simMiner.name);

    // 0. Exact Name Match (Optimization)
    const exact = marketMiners.find(m => m.name === simMiner.name);
    if (exact && exact.stats.middlePrice > 0) return { price: exact.stats.middlePrice, source: exact.source };


    // Filter candidates by Hashrate Proximity (within 5% or 2 TH for small items)
    const candidates = marketMiners.filter(m => {
        const mHash = m.specs.hashrateTH;
        if (!mHash) return false;

        const diff = Math.abs(simHash - mHash);
        const limit = Math.max(2, simHash * 0.05);
        return diff <= limit;
    });

    if (candidates.length === 0) {
        const best = findBestNameMatch(simMiner.name, marketMiners);
        return { price: best.price, source: best.source };
    }

    // Among candidates (Hashrate matched), find best Name match
    const identifiers = ["s21", "s23", "s19", "l7", "k7", "e9", "hydro", "xp", "pro", "mix", "k", "j", "plus", "+"];
    // const simTokens = getTokens(simSlug, identifiers); // Unused in original code, simplifying

    let bestMatch: SimpleMarketMiner | null = null;
    let maxScore = -1;

    for (const cand of candidates) {
        const markSlug = slugify(cand.name);
        if (cand.stats.middlePrice <= 0) continue;

        let score = 0;

        // Critical: Series Match
        const seriesKeys = ["s23", "s21", "s19", "l7", "k7", "e9", "m50", "m60"];
        const simSeries = seriesKeys.find(k => simSlug.includes(k));
        const markSeries = seriesKeys.find(k => markSlug.includes(k));

        if (simSeries !== markSeries) {
            score -= 100;
        } else {
            score += 50;
        }

        // Feature Match (Hydro, XP, Pro)
        const features = ["hydro", "hyd", "xp", "pro", "plus", "+"];
        for (const f of features) {
            const simHas = hasFeature(simSlug, f);
            const markHas = hasFeature(markSlug, f);
            if (simHas === markHas) score += 10;
            else score -= 10;
        }

        if (score > maxScore) {
            maxScore = score;
            bestMatch = cand;
        }
    }

    if (bestMatch && maxScore > 0) {
        return { price: bestMatch.stats.middlePrice, source: bestMatch.source };
    }

    return { price: 0 };
}

export function hasFeature(slug: string, feature: string): boolean {
    if (feature === 'hyd' || feature === 'hydro') return slug.includes('hyd');
    if (feature === '+' || feature === 'plus') return slug.includes('plus') || slug.includes('s21+');
    return slug.includes(feature);
}

export function getTokens(slug: string, important: string[]): string[] {
    return slug.split('-').filter(t => t.length > 0);
}

export function findBestNameMatch(simName: string, marketMiners: SimpleMarketMiner[]): { price: number, source?: string } {
    const simSlug = slugify(simName);
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const simNorm = normalize(simName);

    for (const m of marketMiners) {
        const markNorm = normalize(m.name);
        if (markNorm.includes(simNorm) || simNorm.includes(markNorm)) {
            const simTokens = simName.toLowerCase().split(/[\s-]+/);
            const markTokens = m.name.toLowerCase().split(/[\s-]+/);
            const matches = simTokens.filter(t => markTokens.includes(t));
            const score = matches.length / Math.max(simTokens.length, markTokens.length);
            if (score > 0.8 && m.stats.middlePrice > 0) return { price: m.stats.middlePrice, source: m.source };
        }
    }
    return { price: 0 };
}

export function normalizeMinerName(name: string): string {
    if (!name) return "";
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

/**
 * Finds the best matching static miner profile for a given "dirty" Telegram name.
 * Handles abbreviations like "EXPH" -> "XP Hydro" and "U3" prefixes.
 */
export function findBestStaticMatch(dirtyName: string, staticMiners: { name: string, hashrateTH: number }[]): { name: string, powerWatts: number } | undefined {
    const normalize = (s: string) => {
        let n = s.toLowerCase();
        // Abbreviations
        n = n.replace(/exph/g, 'xp hydro');
        n = n.replace(/u3/g, ''); // Container ref
        n = n.replace(/pro/g, ' pro ');
        n = n.replace(/xp/g, ' xp ');
        n = n.replace(/hyd/g, ' hydro ');
        return n.replace(/[^a-z0-9]/g, '');
    };

    const targetNorm = normalize(dirtyName);

    // 1. Try Exact Inclusion first (High Confidence)
    // e.g. "S21 XP" in "Antminer S21 XP Hydro"
    // Sorted by length descending to match longest specific model first
    const sorted = [...staticMiners].sort((a, b) => b.name.length - a.name.length);

    for (const m of sorted) {
        const mNorm = normalize(m.name);
        if (targetNorm.includes(mNorm) || mNorm.includes(targetNorm)) {
            // Check Hashrate if available in dirty name? 
            // The scraping parser has already separated Hashrate. 
            // Here we assume dirtyName is just the model string.
            // But if dirty string contains "200T" and static has "200T", that helps?
            // Usually dirtyName comes cleans from parser (no hashrate).
            return m as any;
        }
    }

    // 2. Token Match for tougher cases
    // s21e xp hydro vs s21xp
    // ... logic if needed, but inclusion usually works if abbreviations are expanded.

    return undefined;
}
