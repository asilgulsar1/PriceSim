
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../debug-output.json');

function analyze() {
    if (!fs.existsSync(DATA_PATH)) {
        console.error("No debug-output.json found. Run audit first.");
        return;
    }

    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    const miners = Array.isArray(raw) ? raw : raw.miners || [];

    console.log(`Analyzing ${miners.length} listings...`);

    // 1. Group by Model
    const groups = {};
    miners.forEach(m => {
        if (!groups[m.name]) {
            groups[m.name] = {
                name: m.name,
                prices: [],
                hashrate: m.hashrateTH,
                listings: []
            };
        }
        groups[m.name].prices.push(m.price);
        groups[m.name].listings.push(m);
    });

    const insights = [];

    // 2. Metrics
    Object.values(groups).forEach(g => {
        const prices = g.prices.sort((a, b) => a - b);
        const min = prices[0];
        const max = prices[prices.length - 1];
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const spread = max - min;
        const spreadPct = (spread / min) * 100;
        const pricePerTH = min / g.hashrate;

        g.stats = { min, max, avg, spread, spreadPct, pricePerTH, count: prices.length };
    });

    // 3. Generate Sales Insights

    // A. Efficiency Kings ($/TH)
    const bestValue = Object.values(groups)
        .filter(g => g.stats.count > 1 && g.stats.min > 100) // Ignore parts/junk
        .sort((a, b) => a.stats.pricePerTH - b.stats.pricePerTH)
        .slice(0, 5);

    // B. High Volatility (Arbitrage?) - High spread %
    const volatile = Object.values(groups)
        .filter(g => g.stats.count >= 3 && g.stats.min > 500)
        .sort((a, b) => b.stats.spreadPct - a.stats.spreadPct)
        .slice(0, 5);

    // C. Market Supply (Volume)
    const volume = Object.values(groups)
        .sort((a, b) => b.stats.count - a.stats.count)
        .slice(0, 5);

    console.log("\n--- 💰 Best Value ($/TH) ---");
    bestValue.forEach(g => {
        console.log(`- ${g.name}: $${g.stats.pricePerTH.toFixed(1)}/TH (Low: $${g.stats.min})`);
    });

    console.log("\n--- 📉 High Spread (Negotiation Room) ---");
    volatile.forEach(g => {
        console.log(`- ${g.name}: ${g.stats.spreadPct.toFixed(0)}% Spread (Low: $${g.stats.min} - High: $${g.stats.max})`);
    });

    console.log("\n--- 📦 Highest Supply Volume ---");
    volume.forEach(g => {
        console.log(`- ${g.name}: ${g.stats.count} listings`);
    });

    // D. S19 vs S21 Check
    const s19xp = groups['Antminer S19 XP'];
    const s21 = groups['Antminer S21'];

    if (s19xp && s21) {
        console.log("\n--- ⚔️ S19 XP vs S21 ---");
        console.log(`S19 XP: $${s19xp.stats.pricePerTH.toFixed(1)}/TH`);
        console.log(`S21   : $${s21.stats.pricePerTH.toFixed(1)}/TH`);
        if (s21.stats.pricePerTH < s19xp.stats.pricePerTH) {
            console.log("🚨 INSIGHT: S21 is cheaper per Terahash than S19 XP! Upsell S21.");
        }
    }
}

analyze();
