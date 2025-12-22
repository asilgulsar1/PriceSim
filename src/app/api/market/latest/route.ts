
import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { normalizeMinerName } from '@/lib/market-matching';
import { mergeMarketData } from '@/lib/market-utils';

import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs'; // Switch to Node.js for FS access
export const dynamic = 'force-dynamic'; // Ensure no caching

export async function GET(request: Request) {
    try {
        // 1. Fetch ASIC Miner Value Data (Blob)
        let marketData = { miners: [] };
        try {
            const { blobs } = await list({ prefix: 'market-prices.json', limit: 1 });
            if (blobs.length > 0) {
                const blobUrl = `${blobs[0].url}?t=${Date.now()}`;
                const res = await fetch(blobUrl, { cache: 'no-store' });
                if (res.ok) marketData = await res.json();
            }
        } catch (e) {
            console.warn("Failed to fetch market-prices.json blob", e);
        }

        // 2. Fetch Telegram Data (Local or Blob)
        let telegramData: any[] = [];
        try {
            // Try Local First (Dev)
            if (process.env.NODE_ENV === 'development') {
                try {
                    // Match logic from telegram-rate/page.tsx
                    const localPath = path.join(process.cwd(), 'debug-output.json');
                    const data = await fs.readFile(localPath, 'utf-8');
                    telegramData = JSON.parse(data);

                    // Handle wrapped format if any
                    if (!Array.isArray(telegramData) && (telegramData as any).miners) {
                        telegramData = (telegramData as any).miners;
                    }
                } catch (e) {
                    console.warn("Local FS read failed, trying fetch...", e);
                    const localUrl = 'http://localhost:3000/miners-latest.json';
                    const res = await fetch(localUrl, { cache: 'no-store' });
                    if (res.ok) {
                        const raw = await res.json();
                        telegramData = Array.isArray(raw) ? raw : (raw.miners || []);
                    }
                }
            }

            // If empty, try Blob
            if (telegramData.length === 0) {
                const { blobs } = await list({ prefix: 'miners-latest.json', limit: 1 });
                if (blobs.length > 0) {
                    const blobUrl = `${blobs[0].url}?t=${Date.now()}`;
                    const res = await fetch(blobUrl, { cache: 'no-store' });
                    if (res.ok) {
                        const raw = await res.json();
                        telegramData = Array.isArray(raw) ? raw : (raw.miners || []);
                    }
                }
            }
        } catch (e) {
            console.warn("Failed to fetch miners-latest.json", e);
        }

        // 3. Merge Data
        const merged = mergeMarketData(marketData.miners || [], telegramData || []);

        return NextResponse.json({ miners: merged });
    } catch (error) {
        console.error('Error fetching market data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


