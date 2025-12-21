import { auth } from "@/auth";
import { list } from '@vercel/blob';
import { TelegramRateTable } from '@/components/TelegramRateTable';
import { redirect } from "next/navigation";

export const revalidate = 0; // Always fresh

async function getTelegramData() {
    try {
        // Development Fallback
        if (process.env.NODE_ENV === 'development') {
            try {
                const local = 'http://localhost:3000/miners-latest.json';
                const res = await fetch(local, { cache: 'no-store' });
                if (res.ok) return await res.json();
            } catch (e) { }
        }

        const { blobs } = await list({ prefix: 'miners-latest.json', limit: 1 });
        if (blobs.length > 0) {
            const res = await fetch(blobs[0].url, { cache: 'no-store' });
            if (res.ok) return await res.json();
        }
    } catch (e) {
        console.error("Failed to fetch telegram data", e);
    }
    return [];
}

export default async function TelegramRatePage() {
    const session = await auth();
    // Strict Admin Check
    const role = (session?.user as any)?.role;

    if (role !== 'admin') {
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

    // Handle both Array (legacy/dev) and Object (new cron) formats
    if (Array.isArray(rawData)) {
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
                        Admin Only
                    </span>
                </p>
            </div>

            <TelegramRateTable telegramMiners={miners} />
        </div>
    );
}
