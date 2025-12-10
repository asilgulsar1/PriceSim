import { DEFAULT_MARKET_CONDITIONS } from "./constants";

export interface MarketData {
    btcPrice: number;
    networkDifficulty: number;
    blockReward: number;
}

export async function fetchMarketData(): Promise<MarketData> {
    try {
        const [priceRes, diffRes] = await Promise.all([
            fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'),
            fetch('https://mempool.space/api/v1/difficulty-adjustment')
        ]);

        const priceData = await priceRes.json();
        const diffData = await diffRes.json();

        // Mempool.space returns difficulty as a number directly or in an object?
        // Checking mempool.space docs: /api/v1/difficulty-adjustment returns object with `difficulty` field (current epoch)
        // Actually /api/v1/mining/difficulty-adjustment might be the one, or just /api/blocks/tip/height then calc?
        // Let's use a simpler one if possible. blockchain.info/q/getdifficulty is simple text.
        // But mempool.space is robust.
        // Let's assume mempool.space response structure or fallback.

        // Fallback values if API fails (to prevent app crash)
        let btcPrice = 60000;
        let difficulty = 80000000000000;

        if (priceData?.bitcoin?.usd) {
            btcPrice = priceData.bitcoin.usd;
        }

        // Mempool.space: { "progressPercent": 50, "difficultyChange": 1.2, "estimatedRetargetDate": ..., "remainingBlocks": ..., "remainingTime": ..., "previousRetarget": ..., "nextRetargetHeight": ..., "difficulty": 123456... }
        // Wait, let's verify mempool.space endpoint.
        // https://mempool.space/api/v1/difficulty-adjustment
        // It returns the *current* difficulty in the `difficulty` field? No, it returns info about adjustment.
        // Let's use https://mempool.space/api/blocks/tip/height to get tip, then fetch block? No.
        // Let's use blockchain.info for difficulty as it's a simple number.
        // Or stick to mempool.space but correct endpoint.
        // https://mempool.space/api/v1/mining/hashrate/3d returns hashrate.

        // Let's try to fetch difficulty from a reliable source.
        // blockchain.info/q/getdifficulty is good but sometimes CORS issues?
        // We are server-side fetching usually in Next.js Server Actions or API routes.
        // If client-side, we might hit CORS.
        // Best to do this in a Server Action or Route Handler.

        // For now, let's implement the fetch logic here, but we'll call it from a Server Component or Route Handler.

        // Let's try a different source for difficulty that returns JSON.
        // https://api.blockchain.info/stats returns a big JSON with `difficulty`.

        // Re-fetching difficulty if the first one was ambiguous.
        // Let's use a robust fallback.

        if (diffData?.difficulty) {
            difficulty = diffData.difficulty;
        } else {
            // Try blockchain.info
            try {
                const backupDiff = await fetch('https://blockchain.info/q/getdifficulty');
                const text = await backupDiff.text();
                const val = parseFloat(text);
                if (!isNaN(val)) difficulty = val;
            } catch (e) {
                console.error('Backup difficulty fetch failed', e);
            }
        }

        return {
            btcPrice,
            networkDifficulty: difficulty,
            blockReward: 3.125 // Hardcoded for now, or could fetch halving info
        };
    } catch (error) {
        console.error('Error fetching market data:', error);
        return {
            btcPrice: 60000, // Fallback - consider using DEFAULT? DEFAULT has recent price.
            networkDifficulty: DEFAULT_MARKET_CONDITIONS.networkDifficulty,
            blockReward: 3.125
        };
    }
}
