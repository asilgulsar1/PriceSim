import { NextResponse } from 'next/server';
import { saveSimulationLog } from '@/lib/storage';

export async function POST(request: Request) {
    try {
        const payload = await request.json();

        if (!payload || !payload.miners) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        // Force updated timestamp if missing, or trust client?
        // Better to set server timestamp for security/accuracy
        payload.updatedAt = new Date().toISOString();

        await saveSimulationLog(payload, true); // limit update of 'latest' to avoid manual spam overriding cron? 

        // User wanted "Each generation should be stored".
        // And usually manual runs are exploratory. 
        // I set isManual = true, which in storage.ts prevents updating 'miners-latest.json'.
        // This keeps the "official" price list clean from random manual tests, 
        // but still logs variables.
        // If user wants to PUBLISH manual changes towards Price List, we might need a separate action.
        // For now, LOGGING is the request.

        return NextResponse.json({ success: true, timestamp: payload.updatedAt });
    } catch (error) {
        console.error('Failed to save log:', error);
        return NextResponse.json({ error: 'Failed to save log' }, { status: 500 });
    }
}
