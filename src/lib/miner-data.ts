import { MinerProfile } from "@/lib/calculator";
export type { MinerProfile };

// Map of model substrings to release years.
// Processed in order - specific matches should come first if needed, but usually we just look for the series.
// Map of model substrings to release years.
// Processed in order - specific matches should come first.
// NOTE: Do NOT include generic brand names here (e.g. "ANTMINER") as they might be longer than model names (e.g. "S19") and shadow them.
export const MINER_RELEASE_YEARS: Record<string, number> = {
    // Bitdeer
    "SEALMAKER": 2024, // Typo in original? Usually SEALMINER. Keeping original key just in case, or verifying? 
    // Original had "SEALMINER": 2024. Let's keep specific series keys if they exist.
    "SEALMINER": 2024,

    // Avalon
    "A15": 2024,
    "A14": 2023,
    "A13": 2022,

    // Whatsminer
    "M66S": 2023,
    "M66": 2023,
    "M63S": 2023,
    "M63": 2023,
    "M60S": 2023,
    "M60": 2023,
    "M50": 2022,

    // Bitmain
    "S23": 2025,
    "S21+": 2024,
    "S21 XP": 2024,
    "S21 Pro": 2024,
    "S21": 2023,
    "T21": 2023,
    "S19 XP": 2022,
    "S19 k": 2023,
    "S19 j": 2021,
    "S19": 2020,
    "L7": 2021,
    "K7": 2023,
    "E9": 2022
};

export function getMinerReleaseYear(modelName: string): number {
    const defaultYear = 2020; // Fallback for completely unknown garbage
    const upperName = modelName.toUpperCase();

    // 1. Specific Model Match
    // Sort keys by length descending to match specific models first (e.g. 'S21 XP' before 'S21')
    const keys = Object.keys(MINER_RELEASE_YEARS).sort((a, b) => b.length - a.length);

    for (const key of keys) {
        if (upperName.includes(key.toUpperCase())) {
            return MINER_RELEASE_YEARS[key];
        }
    }

    // 2. Safety Net: Brand Match
    // If we didn't match a specific model, but it's a known brand, assume it's NEW.
    // This allows "Antminer S25" (unknown model) to appear by default.
    const currentYear = new Date().getFullYear();
    if (upperName.includes("ANTMINER") ||
        upperName.includes("WHATSMINER") ||
        upperName.includes("AVALON") ||
        upperName.includes("BITDEER") ||
        upperName.includes("SEALMINER")) {
        return currentYear;
    }

    return defaultYear;
}


interface MarketMinerRaw {
    name: string;
    specs?: {
        hashrateTH?: number;
        powerW?: number;
    };
    [key: string]: unknown;
}

export function processAndSelectMiners(marketMiners: MarketMinerRaw[]): MinerProfile[] {
    // 1. Convert to Profile & Filter Year
    let candidates: MinerProfile[] = [];

    // Safety check
    if (!marketMiners || !Array.isArray(marketMiners)) return [];

    for (const m of marketMiners) {
        // Basic Validations
        if (!m.specs?.hashrateTH || !m.specs?.powerW) continue;

        const year = getMinerReleaseYear(m.name);
        if (year < 2023) continue;

        candidates.push({
            name: m.name,
            hashrateTH: m.specs.hashrateTH,
            powerWatts: m.specs.powerW,
            price: 0
        });
    }

    // 2. Deduplicate by Specs (Hash/Power)
    // Key: "Hash-Power"
    const uniqueMap = new Map<string, MinerProfile>();
    candidates.forEach(c => {
        const key = `${c.hashrateTH}-${c.powerWatts}`;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, c);
        } else {
            // Keep the "Cleaner" name (shorter is usually cleaner, e.g. "S21 XP" vs "Antminer S21 XP ...")
            const existing = uniqueMap.get(key)!;
            // Heuristic: Prefer names WITHOUT "Mix" or "Tech" if dup
            // Also prefer shorter names
            if (c.name.length < existing.name.length) {
                uniqueMap.set(key, c);
            }
        }
    });
    candidates = Array.from(uniqueMap.values());

    // 3. Group by Brand
    const byBrand: Record<string, MinerProfile[]> = {
        'Bitmain': [],
        'Whatsminer': [],
        'Bitdeer': [],
        'Avalon': [],
        'Other': []
    };

    candidates.forEach(c => {
        const up = c.name.toUpperCase();
        if (up.includes('ANTMINER') || up.includes('S19') || up.includes('S21') || up.includes('T21') || up.includes('S23')) byBrand['Bitmain'].push(c);
        else if (up.includes('WHATSMINER') || up.includes('M3') || up.includes('M5') || up.includes('M6')) byBrand['Whatsminer'].push(c);
        else if (up.includes('SEAL') || up.includes('BITDEER')) byBrand['Bitdeer'].push(c);
        else if (up.includes('AVALON') || up.includes('A1')) byBrand['Avalon'].push(c);
        else byBrand['Other'].push(c);
    });

    // 4. Sort each group (Hashrate Descending = Best Specs first)
    const sortFn = (a: MinerProfile, b: MinerProfile) => b.hashrateTH - a.hashrateTH;
    Object.values(byBrand).forEach(list => list.sort(sortFn));

    // 5. Selection (Target ~30 Total)
    // Distribution Targets:
    // Bitmain: 12
    // Whatsminer: 8
    // Bitdeer: 5
    // Avalon: 5
    const final: MinerProfile[] = [];

    const pushTop = (brand: string, count: number) => {
        const list = byBrand[brand];
        const taken = list.slice(0, count);
        final.push(...taken);
        // Remove taken from pool
        byBrand[brand] = list.slice(count);
    };

    pushTop('Bitmain', 12);
    pushTop('Whatsminer', 8);
    pushTop('Bitdeer', 5);
    pushTop('Avalon', 5);

    // If we haven't reached 30 yet, fill with next best from any brand
    // (Prioritizing Bitmain/Whatsminer leftovers)
    const remainingCount = 30 - final.length;
    if (remainingCount > 0) {
        const leftovers = [
            ...byBrand['Bitmain'],
            ...byBrand['Whatsminer'],
            ...byBrand['Bitdeer'],
            ...byBrand['Avalon'],
            ...byBrand['Other']
        ].sort(sortFn);
        final.push(...leftovers.slice(0, remainingCount));
    }

    // Final Sort by Hashrate globally for neatness
    return final.sort((a, b) => b.hashrateTH - a.hashrateTH);
}

export const INITIAL_MINERS: MinerProfile[] = [
    // Hydro - S23 Series
    { name: 'Antminer S23 Hydro Mix 1160T', hashrateTH: 1160, powerWatts: 11020, price: 0 }, // 1.16 P
    { name: 'Antminer S23 Hydro Mix 580T', hashrateTH: 580, powerWatts: 5510, price: 0 },

    // Hydro - S21 Series
    { name: 'Antminer S21e XP Hydro 3U', hashrateTH: 860, powerWatts: 11180, price: 0 },
    { name: 'Antminer S21 XP Hydro', hashrateTH: 473, powerWatts: 5676, price: 0 },
    { name: 'Antminer S21+ Hydro 395T', hashrateTH: 395, powerWatts: 5925, price: 0 },
    { name: 'Antminer S21+ Hydro 358T', hashrateTH: 358, powerWatts: 5370, price: 0 },
    { name: 'Antminer S21+ Hydro 338T', hashrateTH: 338, powerWatts: 5070, price: 0 },

    // Air - S23 Series
    { name: 'Antminer S23 Mix', hashrateTH: 318, powerWatts: 3498, price: 0 },

    // Air - S21 Series
    { name: 'Antminer S21 XP', hashrateTH: 270, powerWatts: 3645, price: 0 },
    { name: 'Antminer S21 Pro 245T', hashrateTH: 245, powerWatts: 3510, price: 0 },
    { name: 'Antminer S21 Pro 235T', hashrateTH: 235, powerWatts: 3525, price: 0 }, // 15 J/T
    { name: 'Antminer S21 Pro 234T', hashrateTH: 234, powerWatts: 3510, price: 0 },
    { name: 'Antminer S21 Pro 225T', hashrateTH: 225, powerWatts: 3375, price: 0 }, // 15 J/T
    { name: 'Antminer S21+', hashrateTH: 235, powerWatts: 3877, price: 0 },
    { name: 'Antminer S21e XP Hydro', hashrateTH: 860, powerWatts: 11180, price: 0 }, // U3S21EXPH Ref

    // S19 / Other
    { name: 'Antminer S19k Pro 120T', hashrateTH: 120, powerWatts: 2760, price: 0 },
    { name: 'Antminer S19k Pro 115T', hashrateTH: 115, powerWatts: 2645, price: 0 },
    { name: 'Antminer L7 9500M', hashrateTH: 9.5, powerWatts: 3425, price: 0 },
    { name: 'Antminer L7 9050M', hashrateTH: 9.05, powerWatts: 3260, price: 0 },
];
