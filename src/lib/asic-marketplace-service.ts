/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as cheerio from 'cheerio';

export interface MarketMiner {
    id: string;
    name: string;
    specs: {
        hashrateTH: number;
        powerW: number;
        algo: string;
    };
    listings: MarketListing[];
    stats: {
        minPrice: number;
        maxPrice: number;
        avgPrice: number;
        middlePrice: number;
        vendorCount: number;
        lastUpdated: string;
    };
}

export interface MarketListing {
    vendor: string;
    price: number;
    currency: string;
    url?: string;
    stockStatus?: string;
}

// Define a more specific type for the raw marketplace items
export class AsicMarketplaceService {
    // ---------------------------------------------------------------------------
    // 1. Scraping Logic
    // ---------------------------------------------------------------------------
    // This class will encapsulate the scraping logic.
    // The RawMarketplaceItem interface might become a private interface or type alias within this class,
    // or its properties might be directly used in methods.
    // For now, let's assume the user wants to introduce the class and the subsequent lines are
    // a malformed attempt to define its initial structure, possibly intending to move
    // parts of RawMarketplaceItem or related logic into it.
    // I will keep the original RawMarketplaceItem definition for now, as the provided snippet
    // is syntactically incomplete for a class definition and seems to be a partial replacement.
    // A more complete instruction would be needed to refactor RawMarketplaceItem into the class.
}

interface RawMarketplaceItem {
    miner: {
        slug: string;
        name: string;
        hashrates?: { algorithm?: { name: string } }[];
        // Add other properties of miner if needed
    };
    vendor?: {
        name: string;
        website?: string;
    };
    price: number;
    currency: string;
    stockStatus?: string;
}

export async function fetchMarketplaceData(): Promise<MarketMiner[]> {
    try {
        console.log('Fetching marketplace data via static extraction...');

        // Parallel fetch of both pages
        const [marketRes, mainRes] = await Promise.all([
            fetch('https://www.asicminervalue.com/marketplace/asic-miners', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                }
            }),
            fetch('https://www.asicminervalue.com', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                }
            })
        ]);

        // Process Marketplace Data
        let foundPrices: RawMarketplaceItem[] = [];
        if (marketRes.ok) {
            const html = await marketRes.text();
            const $ = cheerio.load(html);
            $('script').each((_idx, el) => {
                const content = $(el).html() || '';
                if (content.includes('self.__next_f.push')) {
                    const extracted = extractPricesFromScript(content);
                    if (extracted) {
                        foundPrices = extracted;
                        return false; // Stop iteration
                    }
                }
            });
        }

        // Process Main Page Data for High Hashrate / Upcoming models
        const referenceMiners = new Map<string, { id: string; name: string; specs: { hashrateTH: number; powerW: number; algo: string; }; price: number; }>();
        if (mainRes.ok) {
            const html = await mainRes.text();
            const $ = cheerio.load(html);

            // The main page uses a specific table structure. 
            // We look for rows that contain SHA-256
            $('tr').each((_idx: number, row: cheerio.Element) => {
                const text = $(row).text();
                if (!text.includes('SHA-256')) return;

                // FIX 1: Clean Name Extraction
                // The name is often duplicated in hidden span for mobile.
                // We select the logical first element inside the model column (usually first td)
                const modelCell = $(row).find('td').first();

                // Try to find the visible text only, or just the first structural text node
                // Usually structure: <a><span>...</span><span>...</span></a>
                // Let's take the text of the *first* child node of the anchor that is text?

                const rawName = modelCell.find('a').first().text().trim();
                // If name repeats itself (common in responsive tables using ::before/::after or hidden spans)
                // e.g. "Name (Hash)Name (Hash)"
                // We can roughly detect this if the string length is essentially 2x and the halves match.
                // OR, we can assume the part before "Bitmain" or a breakdown.

                // Robust Fix for AMV duplications:
                // AMV usually puts: [Maker] [Model Name] [Model Name again for mobile?]
                // Let's assume the text INSIDE the div/span inside 'a' is what we want.
                // Inspecting previous debug output: "BitmainBitmain Antminer..."

                // Let's look for known markers like "(" and use regex to verify structure.
                // Or better, let's look at the hashrate column for specs.

                // Hashrate is in 2nd column (index 1)
                const cols = $(row).find('td');
                const hashrateText = $(cols[1]).text().trim(); // "1.16 Ph/s"
                const powerText = $(cols[2]).text().trim();    // "11020 W"

                const hashrate = extractHashrateFromName(hashrateText);
                const powerMatch = powerText.match(/(\d+)/);
                const power = powerMatch ? parseInt(powerMatch[0]) : 0;

                // Clean Name Logic:
                // 1. Remove "Bitmain" prefix if doubled?
                // 2. Split by ")" and take the first part + ")"?
                // 3. Regex to find the pattern "Antminer .... (XTh)" and stop there.
                const nameMatch = rawName.match(/(Antminer\s.+?\))/i);
                let name = nameMatch ? nameMatch[1] : rawName;

                // Fallback clean for the massive string
                if (name.length > 60 && name.includes('Antminer')) {
                    // Try to cut at the first "Antminer" and stop before the second?
                    // Or just use the slug to prettify?
                    const slug = modelCell.find('a').attr('href')?.split('/').pop();
                    if (slug) {
                        // reconstruct name from slug? "antminer-s23-hyd-3u" -> "Antminer S23 Hyd 3U"
                        const cleanSlug = slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
                        // Ensure it has hashrate in it if possible? NO, let the UI handle specs.
                        // But we need to match deduplication which EXPECTS (Hash) in name often.
                        // Let's append the hashrate we parsed!
                        name = `${cleanSlug} (${hashrateText.replace('/s', '')})`; // "Antminer S23 Hyd 3u (1.16 Ph)"
                    }
                }

                if (!name || name.length < 5) return;

                // Price extraction
                const priceMatch = text.match(/\$([\d,]+)/);
                const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;

                // Dedupe ID
                const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

                referenceMiners.set(id, {
                    id,
                    name,
                    specs: { hashrateTH: hashrate, powerW: power, algo: 'SHA-256' },
                    price
                });
            });
        }

        const minerMap = new Map<string, MarketMiner>();

        // 1. Add Marketplace Data
        let currentMinerDetails: any = null;
        for (const item of foundPrices) {
            if (typeof item.miner === 'object' && item.miner !== null) {
                currentMinerDetails = item.miner;
            }
            if (!currentMinerDetails) continue;

            // FILTER: Only allow SHA-256 (Bitcoin) miners
            // Check mining algorithm from specs
            const algo = currentMinerDetails.hashrates?.[0]?.algorithm?.name || '';
            if (!algo.toUpperCase().includes('SHA-256') && !algo.toUpperCase().includes('SHA256')) {
                continue;
            }

            const slug = currentMinerDetails.slug;
            if (!minerMap.has(slug)) {
                minerMap.set(slug, {
                    id: slug,
                    name: currentMinerDetails.name,
                    specs: parseMinerSpecs(currentMinerDetails),
                    listings: [],
                    stats: {
                        minPrice: 0, maxPrice: 0, avgPrice: 0, middlePrice: 0, vendorCount: 0,
                        lastUpdated: new Date().toISOString()
                    }
                });
            }
            const minerEntry = minerMap.get(slug)!;
            minerEntry.listings.push({
                vendor: item.vendor?.name || 'Unknown',
                price: item.price,
                currency: item.currency,
                url: item.vendor?.website,
                stockStatus: item.stockStatus
            });
        }

        // 2. Add Reference Data (if not already present or if we want to show it)
        // We merge: if it exists, great. If not, we add it with 0 vendors.
        // We need soft matching on names since slugs might differ slightly.

        referenceMiners.forEach((ref, id) => {
            // Check if we already have this miner
            let exists = false;

            // Normalize ref ID for comparison (stripped of hash info potentially)
            const refBase = ref.id.replace(/-\d+(th|ph|gh).*/, '');

            for (const existing of minerMap.values()) {
                // 1. ID Match
                if (existing.id === id) { exists = true; break; }

                // 2. Hashrate + Name Match
                // If hashrate is very close (within 1 TH) AND name starts similarly
                if (Math.abs(existing.specs.hashrateTH - ref.specs.hashrateTH) < 1) {
                    // Check fuzzy name match
                    const existingSimple = existing.name.toLowerCase().replace(/bitmain|antminer|\s/g, '');
                    const refSimple = ref.name.toLowerCase().replace(/bitmain|antminer|\s/g, '');

                    if (existingSimple.includes(refSimple) || refSimple.includes(existingSimple)) {
                        exists = true;
                        break;
                    }
                }
            }

            if (!exists && ref.specs.hashrateTH > 0) {
                minerMap.set(id, {
                    id: id,
                    name: ref.name,
                    specs: ref.specs,
                    listings: [],
                    stats: {
                        minPrice: ref.price,
                        maxPrice: ref.price,
                        avgPrice: ref.price,
                        middlePrice: ref.price,
                        vendorCount: 0,
                        lastUpdated: new Date().toISOString()
                    }
                });
            }
        });

        // 3. Final Stats Calculation
        const result: MarketMiner[] = Array.from(minerMap.values()).map(miner => {
            // Recalculate stats only for those with listings
            if (miner.listings.length > 0) {
                const prices = miner.listings.map(l => convertToUSD(l.price, l.currency)).filter(p => p > 0);
                if (prices.length > 0) {
                    miner.stats.minPrice = Math.min(...prices);
                    miner.stats.maxPrice = Math.max(...prices);
                    miner.stats.avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
                    miner.stats.middlePrice = calculateMiddlePrice(prices);
                    miner.stats.vendorCount = miner.listings.length;
                }
            }
            return miner;
        });

        // Sort by Hashrate DESC
        return result.sort((a, b) => b.specs.hashrateTH - a.specs.hashrateTH);

    } catch (error) {
        console.error('Scraping failed:', error);
        return [];
    }
}

function extractPricesFromScript(content: string): any[] | null {
    try {
        const start = content.indexOf('f.push([1,"') + 11;
        const end = content.lastIndexOf('"])');

        if (start < 20 || end === -1) return null;

        let jsonString = content.substring(start, end);
        jsonString = jsonString.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');

        const lines = jsonString.split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            const firstColon = line.indexOf(':');
            if (firstColon === -1) continue;

            let payload = line.substring(firstColon + 1).trim();
            if (payload.endsWith(',')) payload = payload.slice(0, -1);

            if (payload.includes('"prices"')) {
                try {
                    const data = JSON.parse(payload);
                    const prices = findKeyRecursively(data, 'prices');
                    if (Array.isArray(prices)) return prices;
                } catch (e: any) {
                    console.error('Error parsing script content', e.message);
                }
            }
        }
    } catch (e) {
        console.warn('Error parsing script content', e);
    }
    return null;
}

function findKeyRecursively(obj: any, key: string): any {
    if (!obj) return null;
    if (obj[key]) return obj[key];

    if (Array.isArray(obj)) {
        for (const item of obj) {
            const found = findKeyRecursively(item, key);
            if (found) return found;
        }
    } else if (typeof obj === 'object') {
        for (const k in obj) {
            const found = findKeyRecursively(obj[k], key);
            if (found) return found;
        }
    }
    return null;
}

export function parseMinerSpecs(minerObj: any): { hashrateTH: number, powerW: number, algo: string } {
    let hashrateTH = 0;
    let powerW = 0;
    const algo = 'SHA-256';

    if (minerObj.hashrates && Array.isArray(minerObj.hashrates) && minerObj.hashrates.length > 0) {
        const mainHash = minerObj.hashrates[0];
        if (mainHash.consumption) powerW = mainHash.consumption;

        const nameHash = extractHashrateFromName(minerObj.name);
        if (nameHash > 0) {
            hashrateTH = nameHash;
        } else {
            // Fallback: Check raw hashrate property
            const raw = mainHash.hashrate;
            if (raw) {
                if (raw > 1e12) {
                    hashrateTH = raw / 1e12; // Hashes/s
                } else if (raw > 1e5) {
                    // Likely MH/s (e.g. 114,000,000 for 114 TH/s)
                    hashrateTH = raw / 1e6;
                } else if (raw > 10 && raw < 10000) {
                    // Likely already in TH/s or similar logic for this API
                    hashrateTH = raw;
                } else if (typeof raw === 'string') {
                    // Try parsing string "118T" in the field itself
                    hashrateTH = extractHashrateFromName(raw);
                }
            }
        }
    }
    return { hashrateTH, powerW, algo };
}

// Updated extraction to handle "Ph"
export function extractHashrateFromName(name: string): number {
    const match = name.match(/(\d+(?:\.\d+)?)\s?(Th|Gh|Ph|T|G|P)(?!\w)/i);
    if (match) {
        let val = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        if (unit.startsWith('g')) val = val / 1000;
        if (unit.startsWith('p')) val = val * 1000;
        return val;
    }
    return 0;
}

export function convertToUSD(price: number, currency: string): number {
    if (currency === 'USD' || currency === '$') return price;
    if (currency === 'EUR' || currency === '€') return price * 1.08;
    if (currency === 'GBP' || currency === '£') return price * 1.27;
    if (currency === 'CNY' || currency === '¥') return price * 0.14;
    return price;
}

export function calculateMiddlePrice(prices: number[]): number {
    if (prices.length === 0) return 0;

    // 1. Sort prices
    const sorted = [...prices].sort((a, b) => a - b);

    // If very few prices, just Average (Median is too specific for 2-3 items)
    if (sorted.length < 3) return Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);

    // 2. Cluster prices that are close to each other (within 10% tolerance)
    // This finds the "Modal Range" where most vendors 'agree'
    const clusters: number[][] = [];
    let currentCluster: number[] = [sorted[0]];

    // 10% variance allows for $3000 vs $3200 to be "same" group
    const TOLERANCE = 0.10;

    for (let i = 1; i < sorted.length; i++) {
        const price = sorted[i];
        const prev = currentCluster[currentCluster.length - 1];

        // Check percentage difference from the previous item in the cluster
        const diff = (price - prev) / prev;

        if (diff <= TOLERANCE) {
            currentCluster.push(price);
        } else {
            clusters.push(currentCluster);
            currentCluster = [price];
        }
    }
    clusters.push(currentCluster);

    // 3. Find the "Best" Cluster
    // - Primary estimation: Largest number of vendors (Agreement)
    // - Tie-breaker: The cluster closest to the overall median? Or just lowest price?
    //   Let's use the cluster with the highest density (closest neighbors) implicitly by sorting.

    let bestCluster = clusters[0];

    for (const cluster of clusters) {
        // If this cluster has MORE vendors, it wins
        if (cluster.length > bestCluster.length) {
            bestCluster = cluster;
        }
        // If EQUAL vendors, we prefer the one with tighter spread? 
        // Or maybe the one closer to the simple median?
        // For now, mostly "More Vendors" is the key user requirement.
        // If equal, usually the lower price is more competitive/real in a sell-side market,
        // but scalper markets might be higher. Let's stick to first-found (lower) for ties 
        // as strictly sorted array.
    }

    // 4. Return the Average of the Consensus Cluster
    const clusterSum = bestCluster.reduce((a, b) => a + b, 0);
    return Math.round(clusterSum / bestCluster.length);
}
