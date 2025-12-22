
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '../scraped_prices.json');
const OUTPUT_FILE = path.join(__dirname, '../public/miners-latest.json');

// Universal Identity Logic (Must match market-utils.ts)
function cleanNameForIdentity(name) {
    return name.toLowerCase()
        .replace(/antminer|whatsminer|bitmain|microbt|avalon|canaan|bitdeer|sealminer/g, '') // Strip Brands
        .replace(/\bplus\b/g, '+')
        .replace(/\bhyd\b/g, 'hydro')
        .replace(/\bpro\b/g, 'pro')
        .replace(/(\d+)(t|th|g|gh|m|mh)/g, '') // Strip embedded hashrate strings like "216T" from name
        .replace(/[^a-z0-9\+\-\s]/g, '') // Remove special chars
        .replace(/\s+/g, ' ')
        .trim();
}

function parseLine(line) {
    // 1. Clean line
    line = line.replace(/^[-\*•]\s*/, '').trim();

    // 2. Extract Hashrate using Strict Regex
    // Look for number immediately followed by T/TH (e.g. 216T, 216TH, 216 TH)
    const hashrateRegex = /(\d+(?:\.\d+)?)\s*(T|Th|G|Gh|M|Mh)/i;
    const hashrateMatch = line.match(hashrateRegex);
    let hashrateTH = 0;
    let cleanLine = line;

    if (hashrateMatch) {
        const value = parseFloat(hashrateMatch[1]);
        const unit = hashrateMatch[2].toUpperCase();

        if (unit.startsWith('T')) hashrateTH = value;
        else if (unit.startsWith('G')) hashrateTH = value / 1000;
        else if (unit.startsWith('M')) hashrateTH = value / 1000000;

        // REMOVE Hashrate Token from Name Candidate
        cleanLine = cleanLine.replace(hashrateMatch[0], '');
    }

    // 3. Extract Price & Remove Price Token
    const unitPriceRegex = /(?:[\$u]\s*)?(\d+(?:\.\d+)?)\s*(?:[u\$]|usd)?\s*\/\s*(?:t|th)/i;
    const flatPriceRegex = /(?:\$|usd)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:u|usd)(?!\/)/i;

    let price = 0;

    // Check Unit Price First
    const unitMatch = line.match(unitPriceRegex);

    // Check Flat Price
    const flatMatch = line.match(flatPriceRegex);

    if (unitMatch && hashrateTH > 0) {
        const pricePerTH = parseFloat(unitMatch[1]);
        price = pricePerTH * hashrateTH;
        cleanLine = cleanLine.replace(unitMatch[0], '');
    } else if (flatMatch) {
        const val = flatMatch[1] || flatMatch[2];
        price = parseFloat(val);
        cleanLine = cleanLine.replace(flatMatch[0], '');
    } else {
        // Fallback: Look for standalone numbers < 100 that might be Unit Prices without unit
        // e.g. "Antminer S21+ 9.5 216T"
        const looseUnitRegex = /\b(\d+(?:\.\d+)?)\b/;
        const looseMatch = cleanLine.match(looseUnitRegex);
        if (looseMatch) {
            const val = parseFloat(looseMatch[1]);
            // Heuristic: If < 100 and we have a hashrate, likely price/TH
            if (val < 100 && val > 0 && hashrateTH > 0) {
                // Confirm it's not part of the name (S21) or something? 
                // Hard to distinguish "S19" from "19". 
                // But usually name numbers are attached to letters (S19, M30).
                // Standalone "9.5" is suspicious.
                price = val * hashrateTH;
                cleanLine = cleanLine.replace(looseMatch[0], '');
            }
        }
    }

    // 4. Extract Model Name from the CLEANED line
    let namePart = cleanLine;
    if (namePart.includes(':')) namePart = namePart.split(':')[0];
    else if (namePart.includes('—')) namePart = namePart.split('—')[0];
    else if (namePart.includes(' - ')) namePart = namePart.split(' - ')[0];

    // Basic cleanup
    let name = namePart
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        // Remove trailing/leading special chars often left over
        .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
        .trim();

    // Reconstruct Name Strategy:
    // If we have a hashrate, append it nicely? 
    // The aggregator does this, but for raw ingestion, kept clean is good.
    // Actually, user wants "Brand Series Hashrate" as standard.
    // If name is just "Antminer S21+", we usually want "Antminer S21+ 216T"
    if (hashrateTH > 0 && name.length > 0) {
        // Ensure name includes brand?
        // Let's just return the Clean Name prefix. The aggregator merges it.
    }

    return {
        name,
        hashrateTH,
        powerWatts: 0,
        price: Math.round(price),
        raw_price: flatMatch ? (flatMatch[0]) : (unitMatch ? unitMatch[0] : ''),
        source_line: line
    };
}

function calculateStats(listings) {
    if (!listings.length) return null;
    const prices = listings.map(l => l.price).sort((a, b) => a - b);
    const min = prices[0];
    const max = prices[prices.length - 1];
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

    // Middle/Median calculation
    let middle = 0;
    const midIdx = Math.floor(prices.length / 2);
    if (prices.length % 2 === 0) {
        middle = Math.round((prices[midIdx - 1] + prices[midIdx]) / 2);
    } else {
        middle = prices[midIdx];
    }

    return { min, max, avg, middle, count: listings.length };
}

function normalizeKey(name, hashrateTH) {
    if (!hashrateTH || hashrateTH === 0) return `unknown-${Date.now()}`; // Fallback

    const clean = cleanNameForIdentity(name);
    // Slugify manually
    const slug = clean.replace(/\s+/g, '-');
    const hr = Math.floor(hashrateTH); // Strictly integer hashrate for grouping

    return `${slug}-${hr}`;
}

function main() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`Input file not found: ${INPUT_FILE}`);
        console.log("Run 'node scripts/telegram-scraper.js' first.");
        return;
    }

    const rawData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    const allListings = [];

    console.log(`Processing ${rawData.length} messages...`);

    for (const msg of rawData) {
        const content = msg.filtered_text || "";
        if (!content) continue;

        const lines = content.split('\n');
        for (const line of lines) {
            // Skip checks (more permissive filter)
            // Look for price indicators: '$', 'u', 'usd', or just a loose format check inside parseLine
            const hasIndicator = line.match(/[\$u]|usd/i) && line.match(/\d/);
            if (!hasIndicator) continue;

            const miner = parseLine(line);

            if (miner.price > 0 && miner.hashrateTH > 0) {
                miner.updatedAt = msg.date;
                miner.source = msg.source;
                allListings.push(miner);
            }
        }
    }

    // Aggregation
    const groups = {};

    for (const listing of allListings) {
        const key = normalizeKey(listing.name, listing.hashrateTH);
        if (!groups[key]) {
            groups[key] = {
                key,
                nameCandidate: listing.name, // Will use the longest name as candidate
                hashrateTH: listing.hashrateTH,
                listings: []
            };
        }
        groups[key].listings.push(listing);

        // Update name candidate if this one is "better" (longer, more descriptive?)
        // Or maybe just most frequent?
        if (listing.name.length > groups[key].nameCandidate.length) {
            groups[key].nameCandidate = listing.name;
        }
    }

    const aggregated = Object.values(groups).map(g => {
        const stats = calculateStats(g.listings);
        return {
            name: g.nameCandidate,
            hashrateTH: g.hashrateTH,
            price: stats.middle, // Default to Middle/Median for "Price"
            stats: stats,
            listings: g.listings
        };
    });

    // Write to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(aggregated, null, 2));
    console.log(`Saved ${aggregated.length} unique miner models (from ${allListings.length} listings) to ${OUTPUT_FILE}`);
}

main();
