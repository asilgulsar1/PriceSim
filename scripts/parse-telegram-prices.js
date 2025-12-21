
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '../scraped_prices.json');
const OUTPUT_FILE = path.join(__dirname, '../public/miners-latest.json');

function parseLine(line) {
    // 1. Clean line
    line = line.replace(/^[-\*•]\s*/, '').trim();

    // 2. Extract Hashrate using Regex
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
    // Valid formats: "10.7U/TH", "$16.5/T", "$3850"

    // Unit Price: Look for number followed by /T or /TH, with optional prefix/suffix currency
    // Matches: "10.7U/TH", "$16.5/T", "16.5 $/T", "16.5/T" (if we assume T context implies currency?) 
    // Let's require currency symbol OR unit context for safety.
    const unitPriceRegex = /(?:[\$u]\s*)?(\d+(?:\.\d+)?)\s*(?:[u\$]|usd)?\s*\/\s*(?:t|th)/i;

    // Flat Price: Look for currency prefix "$" OR suffix "u"/"usd"
    // Matches: "$3850", "4499u", "4499 USD"
    const flatPriceRegex = /(?:\$|usd)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:u|usd)(?!\/)/i;

    let price = 0;
    let type = 'unknown';

    const unitMatch = line.match(unitPriceRegex);
    const flatMatch = line.match(flatPriceRegex);

    if (unitMatch && hashrateTH > 0) {
        // unitMatch[1] is the number. 
        const pricePerTH = parseFloat(unitMatch[1]);
        price = pricePerTH * hashrateTH;
        type = 'calculated_from_unit';
    } else if (flatMatch) {
        // Group 1 ($prefix) or Group 2 (suffix)
        const val = flatMatch[1] || flatMatch[2];
        price = parseFloat(val);
        type = 'flat';
    }

    // 4. Extract Model Name
    // Separators can be ':', '—', '-', or just space before hashrate?
    // Strategy: Take everything before the hashrate? 
    // Or split by common separators.
    let namePart = line;
    if (line.includes(':')) namePart = line.split(':')[0];
    else if (line.includes('—')) namePart = line.split('—')[0];
    else if (line.includes(' - ')) namePart = line.split(' - ')[0]; // space-dash-space to avoid hyphenated names

    // Cleanup name
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
    // simplified name for grouping
    // Remove "Antminer", "Whatsminer"
    let clean = name.toLowerCase()
        .replace(/antminer/g, '')
        .replace(/whatsminer/g, '')
        .replace(/spot/g, '')
        .replace(/hk/g, '')
        .replace(/stock/g, '')
        .replace(/\(.*\)/g, '') // remove parens
        .trim();

    // Remove spaces and special chars
    clean = clean.replace(/[^a-z0-9]/g, '');

    // Add hashrate bucket (to avoid grouping 200T and 100T together)
    // Round hashrate to nearest whole number for grouping?
    const hr = Math.round(hashrateTH);
    return `${clean}-${hr}`;
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
