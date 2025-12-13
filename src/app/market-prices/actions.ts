/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { fetchMarketplaceData } from '@/lib/asic-marketplace-service';
import { saveMarketPrices } from '@/lib/storage';

export async function syncMarketplaceAction() {
    try {
        console.log('Action: Starting Manual Marketplace Sync...');
        const miners = await fetchMarketplaceData();

        if (miners.length === 0) {
            return { success: false, error: 'No miners found during scrape.' };
        }

        const stats = {
            updatedAt: new Date().toISOString(),
            count: miners.length,
            miners
        };

        const blob = await saveMarketPrices(stats);
        console.log('Action: Saved to blob:', blob.url);

        return { success: true, count: miners.length, timestamp: stats.updatedAt };

    } catch (error: any) {
        console.error('Sync Action Failed:', error);
        return { success: false, error: error.message };
    }
}
