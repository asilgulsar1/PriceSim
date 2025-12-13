/* eslint-disable */
// Debug script to verify fixes for:
// Debug script to verify fixes for:
// 1. Repeating names / Dirty names
// 2. Missing hashrate (S23 Hyd 3U)
// 3. Whatsminer 0 Hashrate (118T support)

import { AsicMarketplaceService } from '../src/lib/asic-marketplace-service';

// Mock browser env for Cheerio if needed or ensuring fetch exists
if (!global.fetch) {
    // @ts-ignore
    global.fetch = fetch;
}

async function debug() {
    console.log("Fetching data...");
    try {
        // @ts-ignore
        const data = await AsicMarketplaceService.fetchMarketplaceData();
        console.log(`Fetched ${data.length} miners.`);

        const targets = data.filter((m: any) =>
            m.name.includes('KS0') ||
            m.name.includes('Z9') ||
            m.name.includes('Gamma') ||
            m.name.includes('S21') // Control
        );

        console.log('\n--- VERIFICATION RESULTS ---');
        targets.slice(0, 10).forEach((m: any) => {
            console.log(`[${m.id}]Name: "${m.name}" | Hash: ${m.specs.hashrateTH} TH / s | Price: $${m.stats.middlePrice} `);
        });

        // Specific Check: S23 Hyd 3U
        // @ts-ignore
        const s23 = miners.find((m: any) => m.name.toLowerCase().includes('s23 hyd 3u'));
        if (s23) {
            const isClean = s23.name.length < 50;
            const hasHash = s23.specs.hashrateTH > 1000; // Expected ~1160
            console.log(`\nSpecific Check: S23 Hyd 3U -> ${s23.name} `);
            console.log(`- Clean Name ? ${isClean ? 'PASS' : 'FAIL'} `);
            console.log(`- Hashrate Detected ? ${hasHash ? `PASS (${s23.specs.hashrateTH})` : 'FAIL'} `);
        } else {
            console.log('\nSpecific Check: S23 Hyd 3U -> NOT FOUND');
        }

        // Specific Check: Whatsminer 118T
        // @ts-ignore
        const wm = miners.find((m: any) => m.name.includes('118T'));
        if (wm) {
            console.log(`\nSpecific Check: Whatsminer 118T -> ${wm.name} `);
            console.log(`- Hashrate Detected ? ${wm.specs.hashrateTH === 118 ? 'PASS' : `FAIL (${wm.specs.hashrateTH})`} `);
        }

    } catch (e) {
        console.error(e);
    }
}

debug();
