const https = require('https');

const LIVE_URL = 'https://asic.academy/api/market/latest';

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    bold: "\x1b[1m"
};

// ---------------------------------------------------------
// Test Configuration
// ---------------------------------------------------------
const MINERS_TO_CHECK = [
    { name: "Antminer U3 S21 XP Hydro", expectedSource: "Telegram" },
    { name: "Antminer S19k Pro", checkPriceSanity: true },
    { name: "Antminer S21+ Hydro 395T", expectedPower: true }
];

// ---------------------------------------------------------
// Helper: Fetch JSON
// ---------------------------------------------------------
function fetchMarketData() {
    return new Promise((resolve, reject) => {
        console.log(`${colors.cyan}Fetching Live Market Data...${colors.reset}`);
        console.log(`URL: ${LIVE_URL}`);

        https.get(LIVE_URL, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject("Failed to parse JSON: " + e.message);
                }
            });
        }).on('error', (e) => reject(e.message));
    });
}

// ---------------------------------------------------------
// Integrity Checks
// ---------------------------------------------------------
async function runTests() {
    try {
        const data = await fetchMarketData();
        const miners = data.miners || [];

        console.log(`${colors.bold}\n--- Semantic Integrity Report ---${colors.reset}\n`);
        console.log(`Total Miners Fetched: ${colors.yellow}${miners.length}${colors.reset}`);

        let passed = 0;
        let failed = 0;

        const assert = (label, condition, errorMsg) => {
            if (condition) {
                console.log(`[${colors.green}PASS${colors.reset}] ${label}`);
                passed++;
            } else {
                console.log(`[${colors.red}FAIL${colors.reset}] ${label}`);
                console.log(`       ${colors.red}Error: ${errorMsg}${colors.reset}`);
                failed++;
            }
        };

        // 1. Check for Telegram Miners (The "Canaries")
        console.log(`\n${colors.bold}1. Telegram Data Presence (Canary Check)${colors.reset}`);

        // Find U3 (The missing one from the report)
        // Fuzzy match logic simplified for test script
        const u3 = miners.find(m => m.name.includes("U3") && m.name.includes("S21") && m.name.includes("Hydro"));

        assert(
            "Antminer U3 S21 XP Hydro exists",
            !!u3,
            "Could not find miner matching 'U3 S21 XP Hydro'"
        );

        if (u3) {
            // 2. Data Integrity (Power)
            console.log(`\n${colors.bold}2. Data Integrity Checks${colors.reset}`);

            assert(
                "U3 Power is Enriched (Not 0 W)",
                u3.specs.powerW > 0,
                `Power is ${u3.specs.powerW} W`
            );

            assert(
                "U3 Power Matches Spec (~11000W)",
                u3.specs.powerW > 10000,
                `Power ${u3.specs.powerW} W seems too low for a Hydro unit`
            );
        }

        // 3. Sanity Check for Prices ($3 Bug)
        const s19k = miners.find(m => m.name.includes("S19k Pro") && m.listings.some(l => l.vendor.includes("Telegram")));
        if (s19k) {
            const avgPrice = s19k.stats.avgPrice;
            assert(
                "S19k Pro Price > $100 (Sanitized)",
                avgPrice > 100,
                `Average Price is $${avgPrice} - likely a $/TH error`
            );
        } else {
            console.log(`[${colors.yellow}SKIP${colors.reset}] S19k Pro check (Miner not found in Telegram set)`);
        }

        // 4. Source Attribution
        console.log(`\n${colors.bold}3. Source Metadata${colors.reset}`);
        if (u3) {
            console.log(`   U3 Source: ${u3.source}`);
            console.log(`   U3 Vendor Count: ${u3.stats.vendorCount}`);
            if (u3.listings && u3.listings.length > 0) {
                console.log(`   First Vendor: '${u3.listings[0].vendor}'`);
            }

            assert(
                "U3 has 'Aggregated' source or Telegram listings",
                u3.source === 'Market Aggregated' || u3.listings.some(l => l.vendor.includes("Telegram") || l.vendor.includes("Vendor") || l.vendor.includes("Broker")),
                `Source is '${u3.source}'`
            );
        }

        console.log(`\n${colors.bold}--- Test Summary ---${colors.reset}`);
        console.log(`Passed: ${colors.green}${passed}${colors.reset}`);
        console.log(`Failed: ${colors.red}${failed}${colors.reset}`);

        if (failed > 0) process.exit(1);

    } catch (e) {
        console.error(`${colors.red}Test Verification Failed:${colors.reset}`, e);
        process.exit(1);
    }
}

runTests();
