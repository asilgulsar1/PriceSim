
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { TelegramService } from '@/lib/telegram-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Increase timeout to 60s (pro plan or configurable)

export async function GET(request: Request) {
    // Basic Auth Check for Cron
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        console.log("Starting Cron Scrape...");
        const service = new TelegramService();
        const results = await service.scrapePrices();
        await service.disconnect();

        // Format for App Consumption
        const output = {
            updatedAt: new Date().toISOString(),
            source: 'Telegram Cron',
            miners: results.map(r => ({
                name: r.name,
                specs: { hashrateTH: r.hashrateTH },
                stats: {
                    minPrice: r.stats.min,
                    maxPrice: r.stats.max,
                    middlePrice: r.stats.middle,
                    avgPrice: r.stats.middle, // redundancy
                    vendorCount: r.stats.count
                },
                source: "Telegram Spot"
            }))
        };

        // Upload to Blob
        const blob = await put('miners-latest.json', JSON.stringify(output), {
            access: 'public',
            addRandomSuffix: false, // Overwrite
            contentType: 'application/json'
        });

        console.log("Cron Scrape Complete. Uploaded to:", blob.url);

        return NextResponse.json({ success: true, url: blob.url, count: results.length });
    } catch (error: any) {
        console.error("Cron Job Failed:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
