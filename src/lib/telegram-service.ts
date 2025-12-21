
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram";

const API_ID = parseInt(process.env.API_ID || "0", 10);
const API_HASH = process.env.API_HASH || "";
const SESSION_STRING = process.env.TELEGRAM_SESSION || "";

const KEYWORDS = ["S23", "S21", "S19", "T21", "M50", "M60", "B19", "U3"]; // Added S23, B19, U3
const NEGATIVE_KEYWORDS = [
    // Altcoins
    "L7", "K7", "D9", "E9", "Z15", "KA3", "KS3", "KS5", "AL3", "DR3", "IceRiver", "Goldshell",
    // Futures / Pre-orders
    "Future", "Preorder", "Pre-order", "Batch", "Production",
    "Jan ", "Feb ", "Mar ", "Apr ", "May ", "Jun ", "Jul ", "Aug ", "Sep ", "Oct ", "Nov ", "Dec ",
    "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
];

// Reduce limit for Vercel timeout safety (Serverless func usually 10s-60s)
// We might need to be very targeted.
const LIMIT = 50;
const MAX_AGE_HOURS = 72; // Increased to 72h (weekend coverage)

// --- Parser Logic (Ported from scripts/parse-telegram-prices.js) ---
interface TelegramMiner {
    name: string;
    hashrateTH: number;
    price: number;
    source: string;
    date: Date;
    powerW?: number;
}

function parseLine(line: string): TelegramMiner[] | null {
    // 1. Clean basic bullets
    let cleanLine = line.replace(/^[-\*•]\s*/, '').trim();

    // Check for Slash-Separated Hashrates (e.g., 434/436/440T or /440T/442T)
    // Updated to handle optional leading slash and units inside groups
    const multiHashRegex = /[/\-]?\b((?:\d{3}(?:T|Th)?[/\-]){1,4}\d{3}(?:T|Th)?)\b/i;
    const multiMatch = cleanLine.match(multiHashRegex);
    let multiHashrates: number[] = [];
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

    // 2. Hashrate (Fallback)
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

    // 3. Efficiency / Power
    // Format: "3000W" or "20J/T"
    const powerRegex = /(\d+(?:\.\d+)?)\s*W(?![a-z])/i;
    const effRegex = /(\d+(?:\.\d+)?)\s*J\/T/i;

    let powerW = 0;
    const powerMatch = cleanLine.match(powerRegex);
    const effMatch = cleanLine.match(effRegex);

    if (powerMatch) {
        powerW = parseFloat(powerMatch[1]);
    }

    // 4. Price
    const unitPriceRegex = /(?:[\$u]\s*)?(\d+(?:\.\d+)?)\s*(?:[u\$]|usd)?\s*\/\s*(?:t|th)/i;
    const flatPriceRegex = /(?:\$|usd)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:u|usd)(?!\/)/i;

    let price = 0;
    const unitMatch = cleanLine.match(unitPriceRegex);
    const flatMatch = cleanLine.match(flatPriceRegex);

    if (flatMatch) {
        price = parseFloat(flatMatch[1] || flatMatch[2]);
    }

    // 4b. Quantity / Lot Logic
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

    // 5. Name Cleaning
    let nameBase = cleanLine;
    if (usedMultiMatch && multiMatch) nameBase = nameBase.replace(multiMatch[0], ''); // Remove "434/436T"
    if (!usedMultiMatch && hashrateMatch) nameBase = nameBase.replace(hashrateMatch[0], '');
    if (powerMatch) nameBase = nameBase.replace(powerMatch[0], '');
    if (effMatch) nameBase = nameBase.replace(effMatch[0], '');
    if (unitMatch) nameBase = nameBase.replace(unitMatch[0], '');
    if (flatMatch) nameBase = nameBase.replace(flatMatch[0], '');
    if (qtyMatch) nameBase = nameBase.replace(qtyMatch[0], ''); // Remove "100pcs"

    // Aggressive Cleanup (Stop words)
    nameBase = nameBase.replace(/@\w+/g, '') // Mentions
        .replace(/http\S+/g, '') // Links
        .replace(/[:|\-—,]/g, ' ') // Punctuation key chars
        .replace(/\b(?:moq|doa|warranty|working|condition|lot|batch|stock|spot|new|used|refurb|refurbished|for sale|selling|available|now)\b/gi, ' ')
        .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi, '') // Month frags
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|\u2B50|\u2B55|\u231A|\u231B|\u23F3|\u23F0|\u25AA|\u25AB)/g, '')
        .replace(/\s+/g, ' ').trim();

    // Final Shortening
    nameBase = nameBase.replace(/\/h\b/i, '');

    // Standardization / Branding
    const lowerName = nameBase.toLowerCase();

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

    // STRICT FILTER
    const btcPatterns = [
        /Antminer\s*[ST](19|21|23)/i, // S19, T21, S23...
        /Antminer\s*B19/i,
        /Antminer\s*U3/i,
        /Whatsminer\s*M[3-7][0-9]/i, // Matches M30-M79
        /Avalon\s*A1[1-6]/i, // A11-A16
        /Teraflux|Auradine/i
    ];

    if (!btcPatterns.some(pattern => pattern.test(nameBase))) {
        return null; // Return null (not empty array) to signal "no match"
    }

    const results: TelegramMiner[] = [];

    // 1. Multi-Hashrate Output
    if (usedMultiMatch) {
        for (const h of multiHashrates) {
            let finalPrice = price;
            // Logic: If Unit Price found, multiply. If Flat Price, assume same for all
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

    return results.length > 0 ? results : null;
}

// --- HK Filter Logic ---
const hkIdentifiers = [/🇭🇰/, /Hong Kong/i, /HK\s*Stock/i, /HK\s*Spot/i];
function isHKContent(text: string): boolean {
    return hkIdentifiers.some(r => r.test(text));
}

// --- Main Service Class ---
export class TelegramService {
    private client: TelegramClient | null = null;

    async connect() {
        if (!SESSION_STRING) throw new Error("TELEGRAM_SESSION not found");

        console.log("Connecting to Telegram...");
        this.client = new TelegramClient(new StringSession(SESSION_STRING), API_ID, API_HASH, {
            connectionRetries: 1,
        });
        await this.client.connect();
    }

    async scrapePrices(): Promise<any[]> {
        if (!this.client) await this.connect();
        const client = this.client!;

        const dialogs = await client.getDialogs({ limit: 100 }); // Increased to 100 to find more vendors
        console.log(`Fetched ${dialogs.length} dialogs`);

        const results: TelegramMiner[] = [];
        const cutoff = Date.now() - (MAX_AGE_HOURS * 3600 * 1000);

        for (const dialog of dialogs) {
            if (!dialog.isChannel && !dialog.isGroup) continue;
            console.log(`Scanning ${dialog.title}...`);

            const msgs = await client.getMessages(dialog.entity, { limit: 50 });
            for (const msg of msgs) {
                if (!msg.message || msg.date * 1000 < cutoff) continue;

                const lowerMsg = msg.message.toLowerCase();

                // 1. Positive Keywords (BTC Only)
                // We keep this at Message level to avoid scanning irrelevant chats, 
                // BUT we must be careful. If a list has "Antminer S21", it passes.
                // If it has "New Stock", it fails?
                // Re-adding generic tokens "Antminer", "Whatsminer" to safe-guard.
                // For now, let's trust the series keys.
                if (!KEYWORDS.some(k => lowerMsg.includes(k.toLowerCase()))) {
                    continue;
                }

                // 2. Message-Level Negative Check?
                // NO. If we block "Jan" here, we lose mixed lists.
                // specific "Post-wide" bans (like "WTB" - Want To Buy) could be here.
                if (lowerMsg.includes("wtb") || lowerMsg.includes("want to buy")) continue;

                // Check Region
                // If message has specific filtered region (HK)
                // We reuse script logic: simple HK check on the message
                // if (!isHKContent(msg.message)) continue; // DISABLED filter to force data flow

                // Context State
                let currentRegion = "";

                // Parse
                const lines = msg.message.split('\n');
                for (const line of lines) {
                    const lowerLine = line.toLowerCase();

                    // Region Detection (Header Lines)
                    // "HK Stock", "USA Spot", "Dubai Warehouse"
                    if (/(hk|hong kong|hkg).*stock/i.test(line)) { currentRegion = "HK"; continue; }
                    if (/(us|usa|united states|america).*stock/i.test(line)) { currentRegion = "USA"; continue; }
                    if (/(dubai|uae|abudhabi).*stock/i.test(line)) { currentRegion = "Dubai"; continue; }
                    if (/(russia|moscow).*stock/i.test(line)) { currentRegion = "Russia"; continue; }
                    if (/(paraguay|py).*stock/i.test(line)) { currentRegion = "PY"; continue; }

                    // Line-Level Negative Filter (Futures/Alts)
                    // Added "ex factory", "preorder" to be safer
                    if (NEGATIVE_KEYWORDS.some(nk => lowerLine.includes(nk.toLowerCase()))) {
                        continue;
                    }

                    // Strict Spot Checks (Regex for flexibility)
                    // Block "Ex factory", "Future Batch", "Est Date" AND "YYYY.MM" date codes (e.g., 2026.01)
                    if (/ex\s*factory/i.test(line) || /future\s*batch/i.test(line) || /est\.?\s*date/i.test(line) || /\b202[5-9][\.\-]?\d{2}\b/.test(line)) continue;

                    const miners = parseLine(line); // Returns array or null
                    if (miners && miners.length > 0) {
                        for (const miner of miners) {
                            // Double check: If name still contains future keywords or date codes, drop it
                            if (/ex\s*factory/i.test(miner.name) || /est\.?\s*date/i.test(miner.name) || /\b202[5-9][\.\-]?\d{2}\b/.test(miner.name)) continue;

                            // Append Region to Source if detected
                            const regionTag = currentRegion ? ` (${currentRegion})` : '';
                            miner.source = (dialog.title || "Telegram") + regionTag;

                            // Enhanced Cleanup
                            miner.name = miner.name.replace(/^#/, '')
                                .replace(/\/s\b/gi, '') // Remove "/s" suffix
                                .replace(/\b(est\.?|date)\b/gi, '') // Remove "Est." "Date" artifacts
                                .replace(/ex\s*factory/gi, '')
                                .replace(/mix/gi, '') // Remove "MIX" noise
                                .replace(/([A-Z]\d+)hyd/gi, '$1 Hydro') // Fix "S23hyd" -> "S23 Hydro"
                                .replace(/U3S21/gi, 'U3 S21') // Fix concatenated model U3 + S21
                                .replace(/EXPH\b/gi, 'XP Hydro')
                                .replace(/\b(GTD|RB|HK\/SZ|RF|Refurb|Used|New|Brand New)\b/gi, '') // Remove trade terms
                                .replace(/\b(nits|nit|units|pcs|pieces|qty|moq|mqo)\b/gi, '')
                                .replace(/\b(in transit|arriving|coming)\b/gi, '')
                                .replace(/\b(DE|US|HK|CN|MY|RU|PY)\b/g, '')
                                .replace(/s19\s*xp\s*xp/gi, 'S19 XP') // Fix double XP from previous replace
                                .replace(/xphyd/gi, 'XP Hydro') // "XPhyd" -> "XP Hydro" 
                                .replace(/exp\s*hyd/gi, 'XP Hydro')
                                .replace(/exp\b/gi, ' XP') // Generic "exp" -> "XP"
                                .replace(/xp\+/gi, ' XP')
                                .replace(/s19\s*k/gi, 'S19k')
                                .replace(/s19\s*j/gi, 'S19j')
                                .replace(/s19\s*xp/gi, 'S19 XP')
                                .replace(/s19exp/gi, 'S19 XP')
                                .replace(/hyd\b/gi, 'Hydro')
                                .replace(/jpro/gi, 'j Pro') // Fix "jpro"
                                .replace(/\/T\b/gi, '')
                                .replace(/\/8T\b/gi, '')
                                .replace(/\/\d+(\.\d+)?\//g, '')
                                .replace(/[\(\[\{（].*?[\)\]\}）]/g, '') // Remove short bracketed info
                                .replace(/[\(\[\{（].*[\)\]\}）]$/g, '') // Remove trailing bracketed info
                                .replace(/[⬇️↓⬆↑\/]/g, '')
                                .replace(/\b\d+(\s*-\s*\d+)?\s*(days|weeks|months)\b/gi, '')
                                .replace(/\b\d{2,3}\b$/g, '')
                                .replace(/\s+/g, ' ')
                                .replace(/\bXP\s+XP\b/gi, 'XP') // Dedup XP
                                .replace(/\bS21\s+Pro\s+H\b/gi, 'S21 Pro')
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
                                .replace(/\s+Hydro/gi, ' Hydro');

                            miner.date = new Date(msg.date * 1000);
                            results.push(miner);
                        }
                    }
                }
            }
        }

        return this.aggregate(results);
    }

    aggregate(listings: TelegramMiner[]) {
        const groups: Record<string, any> = {};

        for (const l of listings) {
            // Key: s21xp-270
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

            // Name improvement: Keep the longest descriptive name found for this normalized key
            if (l.name.length > groups[key].name.length) {
                groups[key].name = l.name;
            }

            // Add to listings (Deduplicate: Same Source + Same Price)
            // Note: l.source now includes Region (e.g. "JingleMining (HK)")
            const existingIdx = groups[key].listings.findIndex((item: any) => item.source === l.source && item.price === l.price);

            if (existingIdx !== -1) {
                // Update date if newer
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
            const prices = g.listings.map((x: any) => x.price).sort((a: number, b: number) => a - b);

            // Calculate stats if needed, but we mostly care about Min Price now.
            const midIdx = Math.floor(prices.length / 2);
            const middle = prices.length > 0 ? (prices.length % 2 === 0 ? (prices[midIdx - 1] + prices[midIdx]) / 2 : prices[midIdx]) : 0;

            return {
                name: g.name,
                hashrateTH: g.hashrateTH,
                price: prices.length > 0 ? Math.round(prices[0]) : 0, // Lowest Price
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
