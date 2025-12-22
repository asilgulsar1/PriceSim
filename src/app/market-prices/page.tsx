
import { list } from '@vercel/blob';
import { MarketPriceTable } from '@/components/MarketPriceTable';
import { auth } from "@/auth";

export const revalidate = 60; // Revalidate every minute

import { mergeMarketData } from '@/lib/market-utils';

async function getInitialData() {
    try {
        // Fetch both blobs in parallel
        const [marketBlob, telegramBlob] = await Promise.all([
            list({ prefix: 'market-prices.json', limit: 1 }),
            list({ prefix: 'miners-latest.json', limit: 1 })
        ]);

        let marketMiners = [];
        let telegramMiners = [];
        let updatedAt = null;

        // Process Market Prices Blob
        if (marketBlob.blobs.length > 0) {
            const res = await fetch(marketBlob.blobs[0].url, { next: { revalidate: 60 } });
            if (res.ok) {
                const json = await res.json();
                marketMiners = json.miners || [];
                updatedAt = json.updatedAt;
            }
        }

        // Process Telegram Blob
        if (telegramBlob.blobs.length > 0) {
            const res = await fetch(`${telegramBlob.blobs[0].url}?t=${Date.now()}`, { next: { revalidate: 60 } });
            if (res.ok) {
                const json = await res.json();
                telegramMiners = Array.isArray(json) ? json : (json.miners || []);
            }
        }

        // Merge Data
        const merged = mergeMarketData(marketMiners, telegramMiners);

        return { miners: merged, updatedAt };

    } catch (e) {
        console.error('Failed to load initial market data', e);
    }

    return { miners: [], updatedAt: null };
}

export default async function MarketPricesPage() {
    const data = await getInitialData();
    const session = await auth();
    const userRole = (session?.user as any)?.role || 'client';

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Market Prices</h1>
                <p className="text-muted-foreground">
                    Live pricing data from major ASIC marketplaces, aggregated to find the fair middle price.
                </p>
            </div>

            <MarketPriceTable
                initialData={data.miners || []}
                lastUpdated={data.updatedAt}
                userRole={userRole}
            />
        </div>
    );
}
