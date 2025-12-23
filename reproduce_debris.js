
const { mergeMarketData } = require('./src/lib/market-utils');

// Mock Data matching the screenshot
const telegramMiners = [
    {
        name: "Whatsminer M61s+ 240T T 238T", // Dirty Name 1
        hashrateTH: 238,
        price: 2618,
        source: "Telegram"
    },
    {
        name: "Whatsminer M61S+ 238 T 240T", // Dirty Name 2 (Swapped)
        hashrateTH: 240,
        price: 2640,
        source: "Telegram"
    },
    {
        name: "Whatsminer M61 T 212T", // Dirty Name 3 (Standalone T)
        hashrateTH: 212,
        price: 2120,
        source: "Telegram"
    },
    {
        name: "Whatsminer M61 T 210T", // Dirty Name 4
        hashrateTH: 210,
        price: 2100,
        source: "Telegram"
    }
];

const marketMiners = []; // Empty for this test

console.log("--- BEFORE CLEANING ---");
telegramMiners.forEach(m => console.log(`[${m.hashrateTH}T] ${m.name}`));

// We can't easily run the TS file directly without setup, 
// so this script is mainly to DOCUMENT the validation inputs clearly for the user 
// and for me to apply the logic mentally or via a temporary TS test if needed.
// Ideally I would run the actual TS code. 
