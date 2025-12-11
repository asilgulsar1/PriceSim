
// Debug script to verify fixes for:
// 1. Repeating names / Dirty names
// 2. Missing hashrate (S23 Hyd 3U)
// 3. Whatsminer 0 Hashrate (118T support)

import { fetchMarketplaceData } from '../src/lib/asic-marketplace-service';

// Mock browser env for Cheerio if needed or ensuring fetch exists
if (!global.fetch) {
    global.fetch = require('node-fetch');
}

async function verifyFixes() {
    console.log('Running marketplace verification...');
    try {
        const miners = await fetchMarketplaceData();
        console.log(`Fetched ${miners.length} miners.`);

        const targets = miners.filter(m =>
            m.name.includes('KS0') ||
            m.name.includes('Z9') ||
            m.name.includes('Gamma') ||
            m.name.includes('S21') // Control
        );

        console.log('\n--- VERIFICATION RESULTS ---');
        targets.slice(0, 10).forEach(m => {
            console.log(`[${m.id}] Name: "${m.name}" | Hash: ${m.specs.hashrateTH} TH/s | Price: $${m.stats.middlePrice}`);
        });

        // Specific Check: S23 Hyd 3U
        const s23 = miners.find(m => m.name.toLowerCase().includes('s23 hyd 3u'));
        if (s23) {
            const isClean = s23.name.length < 50;
            const hasHash = s23.specs.hashrateTH > 1000; // Expected ~1160
            console.log(`\nSpecific Check: S23 Hyd 3U -> ${s23.name}`);
            console.log(`- Clean Name? ${isClean ? 'PASS' : 'FAIL'} `);
            console.log(`- Hashrate Detected? ${hasHash ? `PASS (${s23.specs.hashrateTH})` : 'FAIL'}`);
        } else {
            console.log('\nSpecific Check: S23 Hyd 3U -> NOT FOUND');
        }

        // Specific Check: Whatsminer 118T
        const wm = miners.find(m => m.name.includes('118T'));
        if (wm) {
            console.log(`\nSpecific Check: Whatsminer 118T -> ${wm.name}`);
            console.log(`- Hashrate Detected? ${wm.specs.hashrateTH === 118 ? 'PASS' : `FAIL (${wm.specs.hashrateTH})`}`);
        }

    } catch (e) {
        console.error(e);
    }
}

verifyFixes();
