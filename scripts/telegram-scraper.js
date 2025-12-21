/* eslint-disable */
require('dotenv').config({ path: '.env.local' });
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input"); // npm install input
const fs = require("fs");

// CONFIGURATION
// Get these from https://my.telegram.org
const API_ID = Number(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const SESSION_FILE = "session.txt"; // Stores the session string
const KEYWORDS = ["S21", "L7", "S19", "Whatsminer", "KS5", "KS3", "Antminer"]; // Keywords to search for
const LIMIT = 500; // Check last 500 messages per chat
const MAX_AGE_HOURS = 72; // Look back 3 days (weekend coverage)

(async () => {
    console.log("Loading interactive telegram scraper...");

    if (!API_ID || !API_HASH) {
        console.error("Error: Please set API_ID and API_HASH environment variables.");
        console.log("Usage: API_ID=123456 API_HASH=abcdef123456 node scripts/telegram-scraper.js");
        process.exit(1);
    }

    let stringSession = new StringSession("");
    if (fs.existsSync(SESSION_FILE)) {
        stringSession = new StringSession(fs.readFileSync(SESSION_FILE, "utf-8"));
        console.log("Loaded existing session.");
    }

    const client = new TelegramClient(stringSession, API_ID, API_HASH, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => await input.text("Please enter your number: "),
        password: async () => await input.text("Please enter your password: "),
        phoneCode: async () => await input.text("Please enter the code you received: "),
        onError: (err) => console.log(err),
    });

    console.log("You should now be connected.");
    fs.writeFileSync(SESSION_FILE, client.session.save()); // Save session

    const dialogs = await client.getDialogs();
    // Filter for groups and channels
    const groups = dialogs.filter(d => d.isGroup || d.isChannel);

    console.log(`Found ${groups.length} groups/channels.`);
    console.log("Scraping for keywords:", KEYWORDS.join(", "));
    console.log(`Filtering messages from the last ${MAX_AGE_HOURS} hours.`);
    console.log("Targeting Region: Hong Kong (HK) 🇭🇰");

    const results = [];
    const cutoffDate = Math.floor(Date.now() / 1000) - (MAX_AGE_HOURS * 3600);

    // Identifiers for HK section start
    const hkIdentifiers = [/🇭🇰/, /Hong Kong/i, /HK\s*Stock/i, /HK\s*Spot/i];
    // Identifiers for other sections (to stop capturing)
    const otherIdentifiers = [/🇷🇺/, /🇺🇸/, /🇦🇪/, /🇵🇾/, /Russia/i, /USA/i, /UAE/i, /Paraguay/i, /Malaysia/i, /Thailand/i];

    function extractHKContent(text) {
        const lines = text.split('\n');
        let isHKSection = false;
        let hasSections = false;
        const hkLines = [];

        // First pass: check if there are ANY section headers
        for (const line of lines) {
            if (hkIdentifiers.some(r => r.test(line)) || otherIdentifiers.some(r => r.test(line))) {
                hasSections = true;
                break;
            }
        }

        // If no sections are detected at all, return the whole text if it matches keywords (assume generic/mix or single region implied)
        // BUT user specifically asked for HK. So maybe we should be strict?
        // Let's return text if NO other region is mentioned, but if OTHER region is mentioned and NO HK, return null.
        if (!hasSections) {
            // Check if it mentions other regions but NOT HK
            const mentionsOther = otherIdentifiers.some(r => r.test(text));
            const mentionsHK = hkIdentifiers.some(r => r.test(text));

            if (mentionsOther && !mentionsHK) return null; // Clearly another region
            return text; // Default keep
        }

        for (const line of lines) {
            // Check if a new section starts
            const isSectionHeader = hkIdentifiers.some(r => r.test(line)) || otherIdentifiers.some(r => r.test(line));

            if (isSectionHeader) {
                // Determine if it is HK
                isHKSection = hkIdentifiers.some(r => r.test(line));
                if (isHKSection) {
                    hkLines.push(line.trim()); // Keep header for context
                }
                continue;
            }

            if (isHKSection && line.trim().length > 0) {
                hkLines.push(line.trim());
            }
        }

        return hkLines.length > 0 ? hkLines.join('\n') : null;
    }

    for (const chat of groups) {
        try {
            // Get messages
            const messages = await client.getMessages(chat.id, { limit: LIMIT });

            for (const message of messages) {
                if (!message.text) continue;

                // Check date
                if (message.date < cutoffDate) continue;

                // 1. Check Keywords first (cheap filter)
                const matchedKeyword = KEYWORDS.some(k => message.text.toLowerCase().includes(k.toLowerCase()));
                if (!matchedKeyword) continue;

                // 2. Extract HK Content
                const hkContent = extractHKContent(message.text);

                if (hkContent) {
                    results.push({
                        source: chat.title || chat.name || "Unknown",
                        date: new Date(message.date * 1000).toISOString(),
                        original_length: message.text.length,
                        filtered_text: hkContent,
                        url: message.id && chat.username ? `https://t.me/${chat.username}/${message.id}` : null
                    });
                }
            }
        } catch (e) {
            console.error(`Failed to read chat ${chat.title || chat.id}:`, e.message);
        }
    }

    console.log(`Found ${results.length} matched messages from the last ${MAX_AGE_HOURS} hours.`);

    // Save to JSON
    const outputFile = "scraped_prices.json";
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`Saved results to ${outputFile}`);

    await client.disconnect();
})();
