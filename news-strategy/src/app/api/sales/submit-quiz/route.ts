import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { saveSalesProgress, getSalesProgress, SalesProgress } from '@/lib/blob-store';

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { reportId, passed } = await req.json();

        // In real app, we validate answers here against DB. 
        // For MVP, we trust client 'passed' flag (gated by local check) 
        // OR we re-evaluate if we had the questions stored.

        if (passed) {
            const current: SalesProgress = await getSalesProgress(session.user.email) || {
                email: session.user.email,
                lastMcqPassedAt: null,
                completedReports: [],
                workflowStage: 'IDLE',
                lastInteraction: new Date().toISOString()
            };

            if (!current.completedReports.includes(reportId)) {
                current.completedReports.push(reportId);
            }
            current.lastMcqPassedAt = new Date().toISOString();

            await saveSalesProgress(current);
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Quiz submit failed", e);
        return new NextResponse("Error", { status: 500 });
    }
}
