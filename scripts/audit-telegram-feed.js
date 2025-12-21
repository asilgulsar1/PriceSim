
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const API_ID = parseInt(process.env.API_ID || "0", 10);
const API_HASH = process.env.API_HASH || "";
const SESSION_STRING = process.env.TELEGRAM_SESSION || "";

const KEYWORDS = ["S23", "S21", "S19", "T21", "M50", "M60", "B19", "U3"];
const NEGATIVE_KEYWORDS = [
    "L7", "K7", "D9", "E9", "Z15", "KA3", "KS3", "KS5", "AL3", "DR3", "IceRiver", "Goldshell",
    "Future", "Preorder", "Pre-order", "Batch", "Production",
    "Jan ", "Feb ", "Mar ", "Apr ", "May ", "Jun ", "Jul ", "Aug ", "Sep ", "Oct ", "Nov ", "Dec ",
    "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
];
const LIMIT = 50;
const MAX_AGE_HOURS = 72;

function parseLine(line) {
    let cleanLine = line.replace(/^[-\*•#]\s*/, '').trim();

    // Check for Slash-Separated Hashrates (e.g., 434/436/440T or /440T/442T)
    // Updated to handle optional leading slash and units inside groups
    const multiHashRegex = /[/\-]?\b((?:\d{3}(?:T|Th)?[/\-]){1,4}\d{3}(?:T|Th)?)\b/i;
    const multiMatch = cleanLine.match(multiHashRegex);
    let multiHashrates = [];
    let usedMultiMatch = false;

    if (multiMatch) {
        const rawNums = multiMatch[1].split(/[/\-]/);
        // Strip non-digits (T/Th) before parsing
        multiHashrates = rawNums.map(n => parseFloat(n.replace(/[^\d.]/g, '')))
            .filter(n => !isNaN(n) && n > 20); // Filter valid hashrates > 20T
        if (multiHashrates.length > 1) {
            usedMultiMatch = true;
        }
    }

    // Fallback to Single Hashrate if no multi-group found
    const hashrateRegex = /(\d+(?:\.\d+)?)\s*(T|Th|G|Gh|M|Mh)(?![a-z])/i;
    const hashrateMatch = cleanLine.match(hashrateRegex);
    let hashrateTH = 0;

    if (!usedMultiMatch && hashrateMatch) {
        const val = parseFloat(hashrateMatch[1]);
        const unit = hashrateMatch[2].toUpperCase();
        if (unit.startsWith('T')) hashrateTH = val;
        else if (unit.startsWith('G')) hashrateTH = val / 1000;
        else if (unit.startsWith('M')) hashrateTH = val / 1000000;
    }

    // ... Power/Price logic remains (simplified for now to apply to all in split) ...

    const powerRegex = /(\d+(?:\.\d+)?)\s*W(?![a-z])/i;
    const effRegex = /(\d+(?:\.\d+)?)\s*J\/T/i;

    let powerW = 0;
    const powerMatch = cleanLine.match(powerRegex);
    const effMatch = cleanLine.match(effRegex);

    if (powerMatch) {
        powerW = parseFloat(powerMatch[1]);
    }

    const unitPriceRegex = /(?:[\$u]\s*)?(\d+(?:\.\d+)?)\s*(?:[u\$]|usd)?\s*\/\s*(?:t|th)/i;
    const flatPriceRegex = /(?:\$|usd)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:u|usd)(?!\/)/i;

    let price = 0;
    const unitMatch = cleanLine.match(unitPriceRegex);
    const flatMatch = cleanLine.match(flatPriceRegex);

    if (flatMatch) {
        price = parseFloat(flatMatch[1] || flatMatch[2]);
    }

    const qtyRegex = /(\d+)\s*(?:pcs|units|x\s|pieces)/i;
    const qtyMatch = cleanLine.match(qtyRegex);
    let quantity = 1;

    if (qtyMatch) {
        quantity = parseInt(qtyMatch[1], 10);
    }

    if (quantity > 1 && price > 5000) {
        const impliedUnit = price / quantity;
        if (impliedUnit > 50 && impliedUnit < 15000) {
            price = impliedUnit;
        }
    }

    // --- Name Cleaning Common ---
    let nameBase = cleanLine;
    if (usedMultiMatch && multiMatch) nameBase = nameBase.replace(multiMatch[0], ''); // Remove "434/436T"
    if (!usedMultiMatch && hashrateMatch) nameBase = nameBase.replace(hashrateMatch[0], '');
    if (powerMatch) nameBase = nameBase.replace(powerMatch[0], '');
    if (effMatch) nameBase = nameBase.replace(effMatch[0], '');
    if (unitMatch) nameBase = nameBase.replace(unitMatch[0], '');
    if (flatMatch) nameBase = nameBase.replace(flatMatch[0], '');
    if (qtyMatch) nameBase = nameBase.replace(qtyMatch[0], '');

    nameBase = nameBase.replace(/@\w+/g, '')
        .replace(/http\S+/g, '')
        .replace(/[:|\-—,]/g, ' ')
        .replace(/\b(?:moq|doa|warranty|working|condition|lot|batch|stock|spot|new|used|refurb|refurbished|for sale|selling|available|now)\b/gi, ' ')
        .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi, '')
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|\u2B50|\u2B55|\u231A|\u231B|\u23F3|\u23F0|\u25AA|\u25AB)/g, '')
        .replace(/\s+/g, ' ').trim();

    nameBase = nameBase.replace(/\/h\b/i, '');

    const lowerName = nameBase.toLowerCase();

    // Context Checks
    if (!lowerName.includes('antminer') && !lowerName.includes('bitmain')) {
        if (/^(s|t|l|k|d|e)[0-9]/i.test(nameBase) || /^u3/i.test(nameBase) || /^b19/i.test(nameBase)) {
            nameBase = `Antminer ${nameBase}`;
        }
    }

    if (!lowerName.includes('whatsminer') && !lowerName.includes('microbt')) {
        if (/^m[0-9]/i.test(nameBase)) {
            nameBase = `Whatsminer ${nameBase}`;
        }
    }

    if (!lowerName.includes('avalon') && !lowerName.includes('canaan')) {
        if (/^a[0-9]/i.test(nameBase)) {
            nameBase = `Avalon ${nameBase}`;
        }
    }

    // Strict BTC Filter
    const btcPatterns = [
        /Antminer\s*[ST](19|21|23)/i,
        /Antminer\s*B19/i,
        /Antminer\s*U3/i,
        /Whatsminer\s*M[3-7][0-9]/i,
        /Avalon\s*A1[1-6]/i,
        /Teraflux|Auradine/i
    ];

    if (!btcPatterns.some(pattern => pattern.test(nameBase))) {
        return [];
    }

    const results = [];

    // 1. Multi-Hashrate Output
    if (usedMultiMatch) {
        for (const h of multiHashrates) {
            let finalPrice = price;
            // Logic: If Unit Price found, multiply. If Flat Price, assume same for all (or avg?)
            if (unitMatch) {
                finalPrice = parseFloat(unitMatch[1]) * h;
            }

            if (finalPrice > 0) {
                // Recalc power if eff known
                let finalPower = powerW;
                if (effMatch) finalPower = parseFloat(effMatch[1]) * h;

                results.push({
                    name: nameBase,
                    hashrateTH: h,
                    price: Math.round(finalPrice),
                    source: '',
                    date: new Date(),
                    powerW: Math.round(finalPower)
                });
            }
        }
    }
    // 2. Single Hashrate Output
    else if (hashrateTH > 0) {
        let finalPrice = price;
        if (unitMatch) finalPrice = parseFloat(unitMatch[1]) * hashrateTH;

        let finalPower = powerW;
        if (effMatch) finalPower = parseFloat(effMatch[1]) * hashrateTH;

        if (finalPrice > 0) {
            results.push({
                name: nameBase,
                hashrateTH,
                price: Math.round(finalPrice),
                source: '',
                date: new Date(),
                powerW: Math.round(finalPower)
            });
        }
    }

    return results;
}

class TelegramService {
    constructor() {
        this.client = null;
    }

    async connect() {
        if (!SESSION_STRING) throw new Error("TELEGRAM_SESSION not found");

        console.log("Connecting to Telegram (JS)...");
        this.client = new TelegramClient(new StringSession(SESSION_STRING), API_ID, API_HASH, {
            connectionRetries: 1,
        });
        await this.client.connect();
    }

    async scrapePrices() {
        if (!this.client) await this.connect();
        const client = this.client;

        const dialogs = await client.getDialogs({ limit: 100 });
        console.log(`Fetched ${dialogs.length} dialogs`);

        const results = [];
        const cutoff = Date.now() - (MAX_AGE_HOURS * 3600 * 1000);

        for (const dialog of dialogs) {
            if (!dialog.isChannel && !dialog.isGroup) continue;
            console.log(`Scanning ${dialog.title}...`);

            const msgs = await client.getMessages(dialog.entity, { limit: 50 });
            for (const msg of msgs) {
                if (!msg.message || msg.date * 1000 < cutoff) continue;

                const lowerMsg = msg.message.toLowerCase();

                if (!KEYWORDS.some(k => lowerMsg.includes(k.toLowerCase()))) {
                    continue;
                }

                if (lowerMsg.includes("wtb") || lowerMsg.includes("want to buy")) continue;

                // DEBUG: Inspect CoolDragon Messages
                if (dialog.title && dialog.title.toLowerCase().includes('cooldragon')) {
                    const lines = msg.message.split('\n');
                    for (const line of lines) {
                        if (line.toLowerCase().includes('s21')) { // Trace S21 lines
                            console.log(`[TRACE] Analyzing Line: "${line}"`);
                            const res = parseLine(line);
                            console.log(`   -> Parsed Result:`, JSON.stringify(res));
                            if (res.length === 0) {
                                let clean = line.replace(/^[-\*•#]\s*/, '').trim();
                                console.log(`   -> Cleaned: "${clean}"`);
                                let testName = clean;
                                if (!testName.toLowerCase().includes('antminer') && !testName.toLowerCase().includes('bitmain')) {
                                    // Replicating prefix logic
                                    if (/^(s|t|l|k|d|e)[0-9]/i.test(testName)) testName = `Antminer ${testName}`;
                                }
                                console.log(`   -> Test Namebase: "${testName}"`);
                                const matchesBTC = btcPatterns.some(p => p.test(testName));
                                console.log(`   -> Passes BTC Filter? ${matchesBTC}`);
                            }
                        }
                    }
                }

                let currentRegion = "";

                const lines = msg.message.split('\n');
                for (const line of lines) {
                    const lowerLine = line.toLowerCase();

                    if (/(hk|hong kong|hkg).*stock/i.test(line)) { currentRegion = "HK"; continue; }
                    if (/(us|usa|united states|america).*stock/i.test(line)) { currentRegion = "USA"; continue; }
                    if (/(dubai|uae|abudhabi).*stock/i.test(line)) { currentRegion = "Dubai"; continue; }
                    if (/(russia|moscow).*stock/i.test(line)) { currentRegion = "Russia"; continue; }
                    if (/(paraguay|py).*stock/i.test(line)) { currentRegion = "PY"; continue; }

                    if (NEGATIVE_KEYWORDS.some(nk => lowerLine.includes(nk.toLowerCase()))) {
                        continue;
                    }

                    // Strict Spot Checks (Regex for flexibility)
                    // Block "Ex factory", "Future Batch", "Est Date" AND "YYYY.MM" date codes (e.g., 2026.01)
                    if (/ex\s*factory/i.test(line) || /future\s*batch/i.test(line) || /est\.?\s*date/i.test(line) || /\b202[5-9][\.\-]?\d{2}\b/.test(line)) continue;

                    const miners = parseLine(line); // Returns array
                    if (miners && miners.length > 0) {
                        for (const miner of miners) {
                            // Double check: If name still contains future keywords or date codes, drop it
                            if (/ex\s*factory/i.test(miner.name) || /est\.?\s*date/i.test(miner.name) || /\b202[5-9][\.\-]?\d{2}\b/.test(miner.name)) continue;

                            const regionTag = currentRegion ? ` (${currentRegion})` : '';
                            miner.source = (dialog.title || "Telegram") + regionTag;

                            // Enhanced Cleanup
                            miner.name = miner.name.replace(/^#/, '')
                                .replace(/\/s\b/gi, '') // Remove "/s" suffix
                                .replace(/\b(est\.?|date)\b/gi, '') // Remove "Est." "Date" artifacts
                                .replace(/ex\s*factory/gi, '')
                                .replace(/mix/gi, '') // Remove "MIX" noise
                                .replace(/([A-Z]\d+)hyd/gi, '$1 Hydro')
                                .replace(/U3S21/gi, 'U3 S21')
                                .replace(/EXPH\b/gi, 'XP Hydro') // Fix "EXPH" -> "XP Hydro"
                                .replace(/\b(GTD|RB|HK\/SZ|RF|Refurb|Used|New|Brand New)\b/gi, '')
                                .replace(/\b(nits|nit|units|pcs|pieces|qty|moq|mqo)\b/gi, '') // Added pieces
                                .replace(/\b(in transit|arriving|coming)\b/gi, '')
                                .replace(/\b(DE|US|HK|CN|MY|RU|PY|SZ)\b/g, '') // Added SZ
                                .replace(/\b(ed|imm)\b/gi, '') // Remove "ed"? "Imm" = Immersion? Wait. S21 Imm exists. Keep Imm?
                                // "M66 ed" -> Likely typo for immersion or education? Or "edition"?
                                // Let's strip "ed" if isolated. Keep "Imm" as it usually implies Immersion cooling variant.
                                .replace(/\b\d+(\.\d+)?J\b/gi, '') // Remove Joule ratings (e.g. 19.5J)
                                .replace(/(\d{2,3})s\b/g, '$1S') // Fix "M63s" -> "M63S" (lowercase s to Upper S after numbers)
                                .replace(/(\d{2,3})s\+/g, '$1S+') // "M60s+" -> "M60S+"
                                .replace(/(\d+)T\b/gi, '') // Remove attached Hashrate (e.g. 240T in M61S+240T)
                                .replace(/imm\b/gi, 'Imm') // Normalize "Imm"
                                .replace(/S21imm/gi, 'S21 Imm') // Fix S21imm
                                .replace(/jpro/gi, 'j Pro')
                                .replace(/xphyd/gi, 'XP Hydro')
                                .replace(/exp\s*hyd/gi, 'XP Hydro')
                                .replace(/exp\b/gi, ' XP')
                                .replace(/xp\+/gi, ' XP')
                                .replace(/s19\s*k/gi, 'S19k')
                                .replace(/s19\s*j/gi, 'S19j')
                                .replace(/s19\s*xp/gi, 'S19 XP')
                                .replace(/s19exp/gi, 'S19 XP')
                                .replace(/hyd\b/gi, 'Hydro')
                                .replace(/\/T\b/gi, '')
                                .replace(/\/8T\b/gi, '')
                                .replace(/\/\d+(\.\d+)?\//g, '')
                                .replace(/[\(\[\{（].*?[\)\]\}）]/g, '')
                                .replace(/[\(\[\{（].*[\)\]\}）]$/g, '')
                                .replace(/[⬇️↓⬆↑\/]/g, '') // Added Up Arrow
                                .replace(/\b\d+(\s*-\s*\d+)?\s*(days|weeks|months)\b/gi, '') // Enhanced duration regex (7-10 days)
                                .replace(/\b\d{2,3}\b$/g, '')
                                .replace(/\s+/g, ' ')
                                .replace(/\bXP\s+XP\b/gi, 'XP') // Dedup XP
                                .replace(/\bS21\s+Pro\s+H\b/gi, 'S21 Pro') // Specific noise "Pro H"
                                .trim();

                            // Post-Clean Fixes for Casing (Prettify)
                            miner.name = miner.name
                                .replace(/\bS21\s+Pro\s+H\b/gi, 'S21 Pro')
                                .replace(/\bS21\s*\+\b/gi, 'S21+')
                                .replace(/\bS21\s*\+\s*Hydro\b/gi, 'S21+ Hydro')
                                .replace(/Antminer\s+S21\s+\+/gi, 'Antminer S21+')
                                .replace(/\bS21XP\b/gi, 'S21 XP')
                                .replace(/U3\s+S21\s*XP\s*Hydro/gi, 'U3 S21 XP Hydro')
                                .replace(/\b\d+pcs\b/gi, '')
                                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                                .replace(/\s+\d+$/g, '')
                                .trim()
                                .replace(/\bpro\b/gi, 'Pro')
                                .replace(/\bhydro\b/gi, 'Hydro')
                                .replace(/\bxp\b/gi, 'XP')
                                .replace(/\bplus\b/gi, '+')
                                .replace(/\s+\+/g, '+')
                                .replace(/\s+Hydro/gi, ' Hydro'); // Enforce single space before Hydro

                            miner.date = new Date(msg.date * 1000);
                            results.push(miner);
                        }
                    }
                }
            }
        }

        return this.aggregate(results);
    }

    aggregate(listings) {
        const groups = {};

        for (const l of listings) {
            const clean = l.name.toLowerCase().replace(/antminer|whatsminer|spot|hk|stock|\(.*\)|[^a-z0-9]/g, '');
            const key = `${clean}-${Math.round(l.hashrateTH)}`;

            if (!groups[key]) {
                groups[key] = {
                    name: l.name,
                    hashrateTH: l.hashrateTH,
                    listings: [],
                    count: 0
                };
            }

            if (l.name.length > groups[key].name.length) {
                groups[key].name = l.name;
            }

            const existingIdx = groups[key].listings.findIndex((item) => item.source === l.source && item.price === l.price);

            if (existingIdx !== -1) {
                if (l.date > groups[key].listings[existingIdx].date) {
                    groups[key].listings[existingIdx].date = l.date;
                }
            } else {
                groups[key].listings.push({
                    source: l.source,
                    price: l.price,
                    date: l.date
                });
            }

            groups[key].count++;
        }

        return Object.values(groups).map(g => {
            const prices = g.listings.map((x) => x.price).sort((a, b) => a - b);
            const midIdx = Math.floor(prices.length / 2);
            const middle = prices.length > 0 ? (prices.length % 2 === 0 ? (prices[midIdx - 1] + prices[midIdx]) / 2 : prices[midIdx]) : 0;

            return {
                name: g.name,
                hashrateTH: g.hashrateTH,
                price: prices.length > 0 ? Math.round(prices[0]) : 0,
                stats: {
                    min: prices[0] || 0,
                    max: prices[prices.length - 1] || 0,
                    count: prices.length,
                    middle: Math.round(middle)
                },
                listings: g.listings
            };
        });
    }

    async disconnect() {
        if (this.client) await this.client.disconnect();
    }
}

async function main() {
    if (!process.env.TELEGRAM_SESSION) {
        console.error("TELEGRAM_SESSION not found in .env.local");
        process.exit(1);
    }

    const service = new TelegramService();
    try {
        const results = await service.scrapePrices();
        console.log(`Scrape Complete. Found ${results.length} models.`);

        const outFile = path.resolve(process.cwd(), 'debug-output.json');
        fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
        console.log(`Results saved to ${outFile}`);
    } catch (err) {
        console.error("Scrape Failed:", err);
    } finally {
        await service.disconnect();
        process.exit(0);
    }
}

main();
