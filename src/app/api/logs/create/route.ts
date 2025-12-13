import { NextResponse } from 'next/server';
import { saveSimulationLog } from '@/lib/storage';
import { auth } from "@/auth";
import { z } from "zod";

// Schema for input validation
const LogSchema = z.object({
    miners: z.array(z.any()), // Refine 'any' if possible, but basic structure check is good start
    market: z.record(z.string(), z.any()).optional(),
    updatedAt: z.string().optional()
});

export async function POST(request: Request) {
    try {
        // 1. Authentication Check
        const session = await auth();
        // Allow valid sessions (admins or any logged in user? Let's say any user for now or restrict to admin?)
        // Implementation plan said "require admin or authenticated user".
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Input Validation
        const json = await request.json();
        const result = LogSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json({ error: 'Invalid payload', details: result.error.format() }, { status: 400 });
        }

        const payload = result.data;

        // Force updated timestamp if missing
        payload.updatedAt = new Date().toISOString();

        await saveSimulationLog(payload, true);

        return NextResponse.json({ success: true, timestamp: payload.updatedAt });
    } catch (error) {
        console.error('Failed to save log:', error);
        return NextResponse.json({ error: 'Failed to save log' }, { status: 500 });
    }
}
