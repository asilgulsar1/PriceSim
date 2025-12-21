
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

function parseLine(line: string): TelegramMiner | null {
    // 1. Clean basic bullets
    let cleanLine = line.replace(/^[-\*•]\s*/, '').trim();

    // 2. Hashrate
    const hashrateRegex = /(\d+(?:\.\d+)?)\s*(T|Th|G|Gh|M|Mh)(?![a-z])/i;
    const hashrateMatch = cleanLine.match(hashrateRegex);
    let hashrateTH = 0;

    if (hashrateMatch) {
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
    } else if (effMatch && hashrateTH > 0) {
        // J/T * TH = Seconds * Watts? No.
        // 1 J = 1 Watt-Second.
        // Efficiency J/TH is Joules per Terahash.
        // Power (W) = H (TH/s) * Eff (J/TH).
        // Example: 29.5 J/T * 100 TH = 2950 W.
        powerW = parseFloat(effMatch[1]) * hashrateTH;
    }

    // 4. Price
    const unitPriceRegex = /(?:[\$u]\s*)?(\d+(?:\.\d+)?)\s*(?:[u\$]|usd)?\s*\/\s*(?:t|th)/i;
    const flatPriceRegex = /(?:\$|usd)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:u|usd)(?!\/)/i;

    let price = 0;
    const unitMatch = cleanLine.match(unitPriceRegex);
    const flatMatch = cleanLine.match(flatPriceRegex);

    if (unitMatch && hashrateTH > 0) {
        price = parseFloat(unitMatch[1]) * hashrateTH;
    } else if (flatMatch) {
        price = parseFloat(flatMatch[1] || flatMatch[2]);
    }

    // 4b. Quantity / Lot Logic
    // Detect "100pcs", "100x", "100 units"
    const qtyRegex = /(\d+)\s*(?:pcs|units|x\s|pieces)/i;
    const qtyMatch = cleanLine.match(qtyRegex);
    let quantity = 1;

    if (qtyMatch) {
        quantity = parseInt(qtyMatch[1], 10);
    }

    // Heuristic: If Price is very high (> $10,000) and Quantity > 1, it's likely a Lot Price.
    // e.g. "100pcs S19j Pro $21500" -> $215/unit.
    // However, S21 Hyros are ~$6k-8k. 10 units = $60k.
    // If Price > $8000 and Quantity > 1...
    // But check hash/model. S21 Hydro (2024) might be $5k.
    // L7 is $4k.
    // Let's safe-guard: If Price / Quantity is within reasonable range ($100 - $15,000), use it.
    if (quantity > 1 && price > 5000) {
        const impliedUnit = price / quantity;
        if (impliedUnit > 50 && impliedUnit < 15000) {
            price = impliedUnit;
        }
    }

    // 5. Name Cleaning
    // Remove the parts we matched to leave just the model name
    let name = cleanLine;
    if (hashrateMatch) name = name.replace(hashrateMatch[0], '');
    if (powerMatch) name = name.replace(powerMatch[0], '');
    if (effMatch) name = name.replace(effMatch[0], '');
    if (unitMatch) name = name.replace(unitMatch[0], '');
    if (flatMatch) name = name.replace(flatMatch[0], '');
    if (qtyMatch) name = name.replace(qtyMatch[0], ''); // Remove "100pcs"

    // Aggressive Cleanup (Stop words)
    name = name.replace(/@\w+/g, '') // Mentions
        .replace(/http\S+/g, '') // Links
        .replace(/[:|\-—,]/g, ' ') // Punctuation key chars
        .replace(/\b(?:moq|doa|warranty|working|condition|lot|batch|stock|spot|new|used|refurb|refurbished|for sale|selling|available|now)\b/gi, ' ')
        .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi, '') // Month frags
        // Emoji Removal (Range-based for safety)
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .replace(/\s+/g, ' ').trim();

    // Final Shortening
    // "S21+ HYD /H" -> "S21+ HYD"
    name = name.replace(/\/h\b/i, '');

    // Standardization / Branding
    const lowerName = name.toLowerCase();

    // Antminer (S/T/L/K/D/E series generally, but be careful with U3 or others)
    // S21, T21, L7, K7..
    // Only apply if not already present
    if (!lowerName.includes('antminer') && !lowerName.includes('bitmain')) {
        if (/^(s|t|l|k|d|e)[0-9]/i.test(name) || /^u3/i.test(name) || /^b19/i.test(name)) {
            name = `Antminer ${name}`;
        }
    }

    // Whatsminer (M series)
    if (!lowerName.includes('whatsminer') && !lowerName.includes('microbt')) {
        if (/^m[0-9]/i.test(name)) {
            name = `Whatsminer ${name}`;
        }
    }

    // Avalon (A series)
    if (!lowerName.includes('avalon') && !lowerName.includes('canaan')) {
        if (/^a[0-9]/i.test(name)) {
            name = `Avalon ${name}`;
        }
    }

    if (price > 0 && hashrateTH > 0) {
        return { name, hashrateTH, price: Math.round(price), source: '', date: new Date(), powerW: Math.round(powerW) };
    }
    return null;
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

                // Parse
                const lines = msg.message.split('\n');
                for (const line of lines) {
                    const lowerLine = line.toLowerCase();

                    // Line-Level Negative Filter (Futures/Alts)
                    if (NEGATIVE_KEYWORDS.some(nk => lowerLine.includes(nk.toLowerCase()))) {
                        continue;
                    }

                    const miner = parseLine(line);
                    if (miner) {
                        miner.source = dialog.title || "Telegram";
                        miner.date = new Date(msg.date * 1000);
                        results.push(miner);
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
                groups[key] = { candidate: l.name, hashrate: l.hashrateTH, listings: [] };
            }
            groups[key].listings.push(l);
            if (l.name.length > groups[key].candidate.length) groups[key].candidate = l.name;
        }

        return Object.values(groups).map(g => {
            const prices = g.listings.map((x: any) => x.price).sort((a: number, b: number) => a - b);
            const midIdx = Math.floor(prices.length / 2);
            const middle = prices.length % 2 === 0 ? (prices[midIdx - 1] + prices[midIdx]) / 2 : prices[midIdx];

            return {
                name: g.candidate,
                hashrateTH: g.hashrate,
                price: Math.round(prices[0]), // Use Lowest Price as primary
                stats: {
                    min: prices[0],
                    max: prices[prices.length - 1],
                    count: prices.length,
                    middle: Math.round(middle)
                },
                listings: g.listings.map((l: any) => ({
                    source: l.source,
                    price: l.price,
                    date: l.date
                }))
            };
        });
    }

    async disconnect() {
        if (this.client) await this.client.disconnect();
    }
}
