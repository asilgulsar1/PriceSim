const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input"); // npm install input
const fs = require("fs");

// CONFIGURATION
// Get these from https://my.telegram.org
const API_ID = Number(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const SESSION_FILE = "session.txt"; // Stores the session string
const KEYWORDS = ["S21", "L7", "S19", "Whatsminer"]; // Keywords to search for
const LIMIT = 100; // Messages per chat to check

(async () => {
    console.log("Loading interactive telegram scraper...");

    if (!API_ID || !API_HASH) {
        console.error("Error: Please set API_ID and API_HASH environment variables.");
        console.log("Usage: API_ID=123 API_HASH=abc node telegram-scraper.js");
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
    const groups = dialogs.filter(d => d.isGroup || d.isChannel);

    console.log(`Found ${groups.length} groups/channels.`);
    console.log("Scraping for keywords:", KEYWORDS.join(", "));

    const results = [];

    for (const chat of groups) {
        // console.log(`Checking ${chat.title}...`);
        try {
            const messages = await client.getMessages(chat.id, { limit: LIMIT });

            for (const message of messages) {
                if (!message.text) continue;

                // Check if any keyword matches
                const matched = KEYWORDS.some(k => message.text.includes(k));

                if (matched) {
                    results.push({
                        source: chat.title,
                        date: new Date(message.date * 1000).toISOString(),
                        text: message.text,
                        user: message.senderId ? message.senderId.toString() : 'unknown'
                    });
                }
            }
        } catch (e) {
            console.error(`Failed to read chat ${chat.title}:`, e.message);
        }
    }

    console.log(`Found ${results.length} matched messages.`);

    // Save to JSON
    fs.writeFileSync("scraped_prices.json", JSON.stringify(results, null, 2));
    console.log("Saved to scraped_prices.json");

    await client.disconnect();
})();
