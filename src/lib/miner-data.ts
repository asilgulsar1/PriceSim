import { MinerProfile } from "@/lib/calculator";
export type { MinerProfile };

// Map of model substrings to release years.
// Processed in order - specific matches should come first if needed, but usually we just look for the series.
export const MINER_RELEASE_YEARS: Record<string, number> = {
    // Bitdeer
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
    "M53": 2022,
    "M30": 2020,
    "M33": 2020,

    // Bitmain
    "S23": 2025,
    "S21+": 2024,
    "S21 XP": 2024,
    "S21 Pro": 2024,
    "S21": 2023,
    "T21": 2023,
    "M60": 2023, // Duplicated above, but fine
    "M63": 2023, // Duplicated above, but fine
    "M66": 2023, // Duplicated above, but fine
    "S19 XP": 2022,
    "S19 k": 2023,
    "S19 j": 2021,
    "S19": 2020,
    "L7": 2021,
    "K7": 2023,
    "E9": 2022
};

export function getMinerReleaseYear(modelName: string): number {
    const defaultYear = 2020; // Fallback for unknown models

    // Sort keys by length descending to match specific models first (e.g. 'S21 XP' before 'S21')
    const keys = Object.keys(MINER_RELEASE_YEARS).sort((a, b) => b.length - a.length);

    for (const key of keys) {
        if (modelName.includes(key)) {
            return MINER_RELEASE_YEARS[key];
        }
    }

    return defaultYear;
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
    { name: 'Antminer S21 Pro 234T', hashrateTH: 234, powerWatts: 3510, price: 0 },
    { name: 'Antminer S21+', hashrateTH: 235, powerWatts: 3877, price: 0 },
];
