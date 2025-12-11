import { put, list, head } from '@vercel/blob';
import { DailyNewsIndex, NewsItem } from './types';

const BLOB_TOKEN_READ_WRITE = process.env.BLOB_READ_WRITE_TOKEN;

// Helper to get path for a date
function getIndexPath(date: string) {
    return `news-archive/${date}.json`;
}

export async function saveDailyIndex(index: DailyNewsIndex): Promise<void> {
    if (!BLOB_TOKEN_READ_WRITE) {
        console.warn("No Blob Token, skipping storage.");
        return;
    }
    const path = getIndexPath(index.date);
    await put(path, JSON.stringify(index), {
        access: 'public',
        addRandomSuffix: false,
        token: BLOB_TOKEN_READ_WRITE,
        allowOverwrite: true // Allow updating the daily file
    });
}

export async function getDailyIndex(date: string): Promise<DailyNewsIndex | null> {
    if (!BLOB_TOKEN_READ_WRITE) return null;
    const path = getIndexPath(date);

    try {
        // Find blob url
        const { blobs } = await list({ prefix: 'news-archive/', token: BLOB_TOKEN_READ_WRITE });
        const blob = blobs.find(b => b.pathname === path);

        if (!blob) return null;

        const res = await fetch(blob.url);
        if (!res.ok) return null;

        return await res.json() as DailyNewsIndex;
    } catch (e) {
        console.error("Failed to load daily index", e);
        return null;
    }
}
