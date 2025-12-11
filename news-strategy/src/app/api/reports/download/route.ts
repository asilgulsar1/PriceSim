import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyReportPDF } from '@/lib/pdf-generator';

export async function GET(req: NextRequest) {
    // In a real app, we'd fetch the specific report content for this ID.
    // For now, we will generate a simulated report.

    // We can extract reportId from URL or query params?
    // Let's use query param for simplicity if not using dynamic route folder.
    // actually file path is src/app/api/reports/download/route.ts so check searchParams.

    const searchParams = req.nextUrl.searchParams;
    const reportId = searchParams.get('id') || 'latest';

    const mockContent = `
WEEKLY MARKET INTELLIGENCE REPORT
ID: ${reportId}
Date: ${new Date().toLocaleDateString()}

1. BITCOIN MARKET OVERVIEW
Bitcoin continues to show resilience...

2. MINING ECONOMICS
Hashprice has stabilized around...

3. SALES STRATEGY
Focus on the 50% ROI pitch...

(This is a generated PDF placeholder for the 10-page report)
    `.trim();

    try {
        const pdfBuffer = await generateWeeklyReportPDF(mockContent, reportId);

        return new NextResponse(pdfBuffer as unknown as BodyInit, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Market_Report_${reportId}.pdf"`
            }
        });
    } catch (e) {
        console.error("PDF Gen Error", e);
        return new NextResponse("Failed to generate PDF", { status: 500 });
    }
}
