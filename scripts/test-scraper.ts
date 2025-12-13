import { fetchMarketplaceData } from '../src/lib/asic-marketplace-service';

async function run() {
    console.log('Testing Scraper...');
    try {
        const miners = await fetchMarketplaceData();
        console.log(`Successfully scraped ${miners.length} miners.`);
        if (miners.length > 0) {
            console.log('Sample Miner:', JSON.stringify(miners[0], null, 2));
        } else {
            console.error('Scraper returned 0 items.');
        }
    } catch (e) {
        console.error('Scraper Failed:', e);
    }
}

run();
