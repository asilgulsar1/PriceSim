import { put, list } from '@vercel/blob';

export interface SimulationLog {
    url: string;
    pathname: string;
    uploadedAt: Date;
    size: number;
}

export async function saveSimulationLog(data: any, isManual: boolean = false) {
    const timestamp = new Date().toISOString();
    const prefix = isManual ? 'manual' : 'cron';
    const filename = `logs/${prefix}-simulation-${timestamp}.json`;

    // 1. Save the persistent Log
    const logBlob = await put(filename, JSON.stringify(data), {
        access: 'public',
        addRandomSuffix: false
    });

    // 2. Update the 'latest' reference (for easy access by Price List)
    // We only update 'latest' if it's a Cron job usually, 
    // BUT the user might want manual changes to reflect in the Price List?
    // "Generation through Chron job should also be stored".
    // Usually manual sim is for "Checking scenarios".
    // I will primarily update 'latest' from CRON, unless explicitly requested to "Publish".
    // For now, let's keep 'latest' as the source of truth for "Default Price List".

    // If it's CRON, we definitely update latest.
    if (!isManual) {
        await put('miners-latest.json', JSON.stringify(data), {
            access: 'public',
            addRandomSuffix: false
        });
    }

    return logBlob;
}

export async function listSimulationLogs(): Promise<SimulationLog[]> {
    const { blobs } = await list({ prefix: 'logs/' });
    return blobs.map(b => ({
        url: b.url,
        pathname: b.pathname,
        uploadedAt: b.uploadedAt,
        size: b.size
    })).sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
}

export async function saveMarketPrices(data: any) {
    // Overwrite the single source of truth for market prices
    const blob = await put('market-prices.json', JSON.stringify(data), {
        access: 'public',
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        // @ts-ignore - The error message explicitly suggested this property
        allowOverwrite: true
    });
    return blob;
}
