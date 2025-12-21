import { auth } from "@/auth";
import { list } from '@vercel/blob';
import { TelegramRateTable } from '@/components/TelegramRateTable';
import { redirect } from "next/navigation";
import path from 'path';
import { promises as fs } from 'fs';

export const revalidate = 0; // Always fresh

async function getTelegramData() {
    // Development: Read local file
    if (process.env.NODE_ENV === 'development') {
        try {
            const localPath = path.join(process.cwd(), 'debug-output.json');
            console.log(`Attempting to read local data from: ${localPath}`);
            const data = await fs.readFile(localPath, 'utf-8');
            const json = JSON.parse(data);
            return json;
        } catch (e: any) {
            console.error("Local read failed:", e.message);
            // Return visual error if possible, or empty
            return { error: e.message };
        }
    }

    // Production: Fetch Blob
    try {
        const { blobs } = await list({ prefix: 'miners-latest.json', limit: 1 });
        if (blobs.length > 0) {
            const res = await fetch(blobs[0].url, { cache: 'no-store' });
            if (res.ok) return await res.json();
            return { error: `Fetch Failed: ${res.status} ${res.statusText}` };
        } else {
            return { error: "No Data Blob Found (Cron hasn't run?)" };
        }
    } catch (e: any) {
        console.error("Failed to fetch telegram data", e);
        return { error: `Blob Error: ${e.message}` };
    }
    return [];
}

export default async function TelegramRatePage() {
    const session = await auth();
    const role = (session?.user as any)?.role;
    const isDev = process.env.NODE_ENV === 'development';

    // Strict Admin Check (Bypassed in Dev)
    if (!isDev && role !== 'admin') {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="text-center p-8 bg-white rounded shadow-sm border">
                    <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
                    <p className="text-muted-foreground">This page is restricted to administrators.</p>
                </div>
            </div>
        );
    }

    const rawData = await getTelegramData();
    let miners: any[] = [];
    let errorMsg = "";

    if ((rawData as any)?.error) {
        errorMsg = (rawData as any).error;
    } else if (Array.isArray(rawData)) {
        miners = rawData;
    } else if (rawData && Array.isArray(rawData.miners)) {
        miners = rawData.miners;
    }

    return (
        <div className="container mx-auto py-12 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Telegram Rate Intelligence</h1>
                <p className="text-muted-foreground">
                    Raw feed from subscribed Telegram channels with profitability simulation.
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        {isDev ? 'DEV MODE (Auth Bypassed)' : 'Admin Only'}
                    </span>
                </p>
                {isDev && (
                    <div className="p-2 bg-yellow-50 text-yellow-800 text-sm rounded border border-yellow-200">
                        Reading from generic local file: <code>debug-output.json</code>
                        {errorMsg && <div className="text-red-600 font-bold mt-1">Error: {errorMsg}</div>}
                    </div>
                )}
            </div>

            <TelegramRateTable telegramMiners={miners} />
        </div>
    );
}
