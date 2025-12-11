import { NextRequest, NextResponse } from 'next/server';
import { generateBrief } from '@/lib/news-service';
import { saveDailyBrief } from '@/lib/blob-store';
import { runNewsIngest } from '@/lib/news-engine/aggregator';
import { runSalesCycle } from '@/lib/pipedrive-service';

export const maxDuration = 60; // Allow enough time for LLM

export async function GET(req: NextRequest) {
    // secure cron
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // In local dev we might skip this or use a query param
        // return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        console.log("Starting Market News Cron...");

        // 1. Run the News Engine (Fetch & Index)
        await runNewsIngest();

        // 2. Run Sales Automator (Check Pipedrive Stages)
        await runSalesCycle();

        // 3. Generate Brief using the *Indexed* data (logic inside generateBrief needs update)
        const brief = await generateBrief();
        await saveDailyBrief(brief);

        // Check for Weekly Report Trigger (e.g. Monday 10am)
        // For simplicity, we can do it if day === 1 && hour approx 10
        // ... Logic here ...

        return NextResponse.json({ success: true, briefId: brief.id });
    } catch (e) {
        console.error("Cron failed", e);
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
