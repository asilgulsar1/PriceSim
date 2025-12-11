
import { list } from '@vercel/blob';
import { MarketPriceTable } from '@/components/MarketPriceTable';

export const revalidate = 60; // Revalidate every minute

async function getInitialData() {
    try {
        const { blobs } = await list({ prefix: 'market-prices.json', limit: 1 });

        if (blobs.length > 0) {
            const res = await fetch(blobs[0].url, { next: { revalidate: 60 } });
            if (res.ok) {
                return await res.json();
            }
        }
    } catch (e) {
        console.error('Failed to load initial market data', e);
    }

    return { miners: [], updatedAt: null };
}

export default async function MarketPricesPage() {
    const data = await getInitialData();

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
            />
        </div>
    );
}
