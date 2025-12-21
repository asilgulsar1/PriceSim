
import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    try {
        // In Development, prefer the local parsed file if available
        if (process.env.NODE_ENV === 'development') {
            try {
                // Assuming standard port 3000 for dev
                const localUrl = 'http://localhost:3000/miners-latest.json';
                const res = await fetch(localUrl, { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    return NextResponse.json(data);
                }
            } catch (e) {
                console.warn("Failed to fetch local miners-latest.json", e);
            }
        }

        // Production / Fallback: Find the latest blob
        const { blobs } = await list({ prefix: 'miners-latest.json', limit: 1 });

        if (blobs.length === 0) {
            return NextResponse.json({ error: 'No data found' }, { status: 404 });
        }

        // Fetch the blob content with cache busting
        const response = await fetch(blobs[0].url, { cache: 'no-store' });
        const data = await response.json();

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching miner data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
