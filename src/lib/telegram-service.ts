
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram";

const API_ID = parseInt(process.env.API_ID || "0", 10);
const API_HASH = process.env.API_HASH || "";
const SESSION_STRING = process.env.TELEGRAM_SESSION || "";

const KEYWORDS = ["S21", "L7", "S19", "Whatsminer", "KS5", "KS3", "Antminer"];
// Reduce limit for Vercel timeout safety (Serverless func usually 10s-60s)
// We might need to be very targeted.
const LIMIT = 50;
const MAX_AGE_HOURS = 24;

// --- Parser Logic (Ported from scripts/parse-telegram-prices.js) ---
interface TelegramMiner {
    name: string;
    hashrateTH: number;
    price: number;
    source: string;
    date: Date;
}

function parseLine(line: string): TelegramMiner | null {
    // 1. Clean
    line = line.replace(/^[-\*•]\s*/, '').trim();

    // 2. Hashrate
    const hashrateRegex = /(\d+(?:\.\d+)?)\s*(T|Th|G|Gh|M|Mh)/i;
    const hashrateMatch = line.match(hashrateRegex);
    let hashrateTH = 0;

    if (hashrateMatch) {
        const val = parseFloat(hashrateMatch[1]);
        const unit = hashrateMatch[2].toUpperCase();
        if (unit.startsWith('T')) hashrateTH = val;
        else if (unit.startsWith('G')) hashrateTH = val / 1000;
        else if (unit.startsWith('M')) hashrateTH = val / 1000000;
    }

    // 3. Price
    const unitPriceRegex = /(?:[\$u]\s*)?(\d+(?:\.\d+)?)\s*(?:[u\$]|usd)?\s*\/\s*(?:t|th)/i;
    const flatPriceRegex = /(?:\$|usd)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:u|usd)(?!\/)/i;

    let price = 0;
    const unitMatch = line.match(unitPriceRegex);
    const flatMatch = line.match(flatPriceRegex);

    if (unitMatch && hashrateTH > 0) {
        price = parseFloat(unitMatch[1]) * hashrateTH;
    } else if (flatMatch) {
        price = parseFloat(flatMatch[1] || flatMatch[2]);
    }

    // 4. Name
    let namePart = line;
    if (line.includes(':')) namePart = line.split(':')[0];
    else if (line.includes('—')) namePart = line.split('—')[0];
    else if (line.includes(' - ')) namePart = line.split(' - ')[0];

    const name = namePart.replace(/\*\*/g, '').trim();

    if (price > 0 && hashrateTH > 0) {
        return { name, hashrateTH, price: Math.round(price), source: '', date: new Date() };
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

        const dialogs = await client.getDialogs({ limit: 10 }); // Reduced to 10
        console.log(`Fetched ${dialogs.length} dialogs`);

        const results: TelegramMiner[] = [];
        const cutoff = Date.now() - (MAX_AGE_HOURS * 3600 * 1000);

        for (const dialog of dialogs) {
            if (!dialog.isChannel && !dialog.isGroup) continue;
            console.log(`Scanning ${dialog.title}...`);

            const msgs = await client.getMessages(dialog.entity, { limit: 30 }); // Reduced to 30
            if (!msg.message || msg.date * 1000 < cutoff) continue;

            // Only process if it has relevant keywords
            if (!KEYWORDS.some(k => msg.message.toLowerCase().includes(k.toLowerCase()))) continue;

            // Check Region
            // If message has specific filtered region (HK)
            // We reuse script logic: simple HK check on the message
            if (!isHKContent(msg.message)) continue;

            // Parse
            const lines = msg.message.split('\n');
            for (const line of lines) {
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
            price: Math.round(middle),
            stats: {
                min: prices[0],
                max: prices[prices.length - 1],
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
