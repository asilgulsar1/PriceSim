
/* eslint-disable */
import { NextResponse } from 'next/server';
import { fetchMarketplaceData } from '@/lib/asic-marketplace-service';
import { saveMarketPrices } from '@/lib/storage';

// 5 minute timeout for Pro, but Vercel free is 10s-60s. 
// Puppeteer might timeout. Plan mentioned "Runtime: nodejs".
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        // Basic protection check (CRON_SECRET)
        const isLoc = process.env.NODE_ENV === 'development';
        if (!isLoc && process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('Starting Marketplace Sync...');
        const miners = await fetchMarketplaceData();

        if (miners.length === 0) {
            return NextResponse.json({ success: false, message: 'No miners found or scraping failed' }, { status: 500 });
        }

        console.log(`Saving ${miners.length} miners to storage...`);
        const blob = await saveMarketPrices({
            updatedAt: new Date().toISOString(),
            count: miners.length,
            miners
        });

        return NextResponse.json({
            success: true,
            count: miners.length,
            url: blob.url,
            data: miners // Return data for immediate inspection
        });

    } catch (error: any) {
        console.error('Sync failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
