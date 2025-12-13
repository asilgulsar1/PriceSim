/* eslint-disable @typescript-eslint/no-unused-vars */
import { slugify } from "@/lib/slug-utils";

export interface SimpleMarketMiner {
    name: string;
    stats: { middlePrice: number };
    specs: { hashrateTH: number };
}

// Robust matching helper using Hashrate + Series
export function findMatchingMarketMiner(simMiner: { name: string, hashrateTH: number }, marketMiners: SimpleMarketMiner[]): number {
    const simHash = simMiner.hashrateTH;
    const simSlug = slugify(simMiner.name);

    // 0. Exact Name Match (Optimization)
    const exact = marketMiners.find(m => m.name === simMiner.name);
    if (exact && exact.stats.middlePrice > 0) return exact.stats.middlePrice;

    // Filter candidates by Hashrate Proximity (within 5% or 2 TH for small items)
    const candidates = marketMiners.filter(m => {
        const mHash = m.specs.hashrateTH;
        if (!mHash) return false;

        const diff = Math.abs(simHash - mHash);
        const limit = Math.max(2, simHash * 0.05);
        return diff <= limit;
    });

    if (candidates.length === 0) {
        return findBestNameMatch(simMiner.name, marketMiners);
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
        return bestMatch.stats.middlePrice;
    }

    return 0;
}

export function hasFeature(slug: string, feature: string): boolean {
    if (feature === 'hyd' || feature === 'hydro') return slug.includes('hyd');
    if (feature === '+' || feature === 'plus') return slug.includes('plus') || slug.includes('s21+');
    return slug.includes(feature);
}

export function getTokens(slug: string, important: string[]): string[] {
    return slug.split('-').filter(t => t.length > 0);
}

export function findBestNameMatch(simName: string, marketMiners: SimpleMarketMiner[]): number {
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
            if (score > 0.8 && m.stats.middlePrice > 0) return m.stats.middlePrice;
        }
    }
    return 0;
}
