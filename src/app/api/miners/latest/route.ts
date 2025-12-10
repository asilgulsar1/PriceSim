
import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const runtime = 'edge';

export async function GET() {
    try {
        // Find the latest blob
        const { blobs } = await list({ prefix: 'miners-latest.json', limit: 1 });

        if (blobs.length === 0) {
            return NextResponse.json({ error: 'No data found' }, { status: 404 });
        }

        // Fetch the blob content
        const response = await fetch(blobs[0].url);
        const data = await response.json();

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching miner data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
