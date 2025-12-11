import { NextResponse } from "next/server";
import { renderToStream } from '@react-pdf/renderer';
import { DailyReportTemplate } from "@/lib/pdf/DailyReportTemplate";
import { getLatestBrief } from "@/lib/blob-store";
import React from 'react';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        let brief;
        if (id) {
            const { getBriefById } = await import("@/lib/blob-store");
            brief = await getBriefById(id);
        } else {
            const { getLatestBrief } = await import("@/lib/blob-store");
            brief = await getLatestBrief();
        }

        if (!brief) {
            return NextResponse.json({ error: "Brief not found." }, { status: 404 });
        }

        const stream = await renderToStream(React.createElement(DailyReportTemplate, { brief }) as any);

        return new NextResponse(stream as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Daily_Intel_${brief.id}.pdf"`
            }
        });
    } catch (e: any) {
        console.error("PDF Generation failed", e);
        return NextResponse.json({ error: "Failed to generate PDF", details: e.toString(), stack: e.stack }, { status: 500 });
    }
}
