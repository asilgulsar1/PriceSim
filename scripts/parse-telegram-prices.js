
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

    if (hashrateMatch) {
        const value = parseFloat(hashrateMatch[1]);
        const unit = hashrateMatch[2].toUpperCase();

        if (unit.startsWith('T')) hashrateTH = value;
        else if (unit.startsWith('G')) hashrateTH = value / 1000;
        else if (unit.startsWith('M')) hashrateTH = value / 1000000;
    }

    // 3. Extract Price
    const unitPriceRegex = /(?:[\$u]\s*)?(\d+(?:\.\d+)?)\s*(?:[u\$]|usd)?\s*\/\s*(?:t|th)/i;
    const flatPriceRegex = /(?:\$|usd)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:u|usd)(?!\/)/i;

    let price = 0;
    let type = 'unknown';

    const unitMatch = line.match(unitPriceRegex);
    const flatMatch = line.match(flatPriceRegex);

    if (unitMatch && hashrateTH > 0) {
        const pricePerTH = parseFloat(unitMatch[1]);
        price = pricePerTH * hashrateTH;
        type = 'calculated_from_unit';
    } else if (flatMatch) {
        const val = flatMatch[1] || flatMatch[2];
        price = parseFloat(val);
        type = 'flat';
    }

    // 4. Extract Model Name
    let namePart = line;
    if (line.includes(':')) namePart = line.split(':')[0];
    else if (line.includes('—')) namePart = line.split('—')[0];
    else if (line.includes(' - ')) namePart = line.split(' - ')[0];

    // Basic cleanup
    let name = namePart.replace(/\*\*/g, '').trim();

    return {
        name,
        hashrateTH,
        powerWatts: 0,
        price: Math.round(price),
        raw_price: flatMatch ? (flatMatch[0]) : (unitMatch ? unitMatch[0] : ''),
        source_line: line
    };
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
