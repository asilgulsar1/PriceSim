
import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const runtime = 'edge';
export const dynamic = 'force-dynamic'; // Ensure no caching

export async function GET() {
    try {
        // Find the latest blob for market prices
        // saveMarketPrices saves as `market-prices.json` (addRandomSuffix: false)
        const { blobs } = await list({ prefix: 'market-prices.json', limit: 1 });

        if (blobs.length === 0) {
            return NextResponse.json({ miners: [] });
        }

        // Cache busting for Blob CDN (public access can be cached)
        const blobUrl = `${blobs[0].url}?t=${Date.now()}`;

        console.log('Fetching latest market prices from:', blobUrl);
        const res = await fetch(blobUrl, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await res.json();

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching market data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
