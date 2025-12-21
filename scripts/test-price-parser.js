
const sampleLines = [
    "- S21xp 270T: 23.6u/t (SPOT)",
    "- S21+225T: 15.3u/t (SPOT)",
    "- S21+235T: 15.4u/t (SPOT)",
    "- S21+216T mix: 15.3u/t (Mar.)", // Future batch?
    "- KS5 pro 21T: 2000u (SPOT)",     // Flat price
    "- L9 15G: 9800u (SPOT)",          // GH/s ? L9 is usually typically scrypt, so GH/s. 15G = 15000M
    "- L9 16G (GTD): 11300u (SPOT)",
    "- S19k pro 120T: 9.3u/t (SPOT)"
];

function parseLine(line) {
    // 1. Clean line
    line = line.replace(/^[-\*•]\s*/, '').trim();

    // 2. Extract Hashrate using Regex
    // Look for numbers followed by T, Th, G, Gh...
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
    // Pattern A: "23.6u/t" or "23.6 u/T" -> Price per TH
    // Pattern B: "2000u" or "2000 u" -> Total Price
    // prices often use 'u' for USDT

    // Check for unit price first (more specific)
    const unitPriceRegex = /(\d+(?:\.\d+)?)\s*u\s*\/\s*t/i;
    const flatPriceRegex = /(\d+(?:\.\d+)?)\s*u(?!\/)/i; // u but NOT u/

    let price = 0;
    let type = 'unknown';

    const unitMatch = line.match(unitPriceRegex);
    const flatMatch = line.match(flatPriceRegex);

    if (unitMatch && hashrateTH > 0) {
        const pricePerTH = parseFloat(unitMatch[1]);
        price = pricePerTH * hashrateTH;
        type = 'calculated_from_unit';
    } else if (flatMatch) {
        price = parseFloat(flatMatch[1]);
        type = 'flat';
    }

    // 4. Extract Model Name (everything before the hashrate usually)
    // Simple heuristic: Take everything before the first number? Or just the whole string as fallback?
    // Better: Remove the price part and hashrate part, keep the rest?
    // Let's just keep the raw line content as name for now, or try to clean it.
    // Example: "S21xp 270T"
    let name = line.split(':')[0].trim(); // Split by colon usually separates Model vs Price info

    // Remove hashrate from name if present to be clean? "S21xp 270T" -> "S21xp"
    // specific logic for this format

    return {
        original: line,
        name,
        hashrateTH,
        price,
        formattedPrice: Math.round(price),
        type
    };
}

console.log("Parsing Results:");
sampleLines.forEach(l => console.log(parseLine(l)));
