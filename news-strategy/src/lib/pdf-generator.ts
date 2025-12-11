import jsPDF from 'jspdf';

export async function generateWeeklyReportPDF(content: string, weekId: string): Promise<Buffer> {
    // In a server environment (Node), jspdf might need some polyfills or we use a different lib.
    // However, jsPDF works reasonably well if we just construct text.
    // For robust server-side PDF, 'pdfkit' or 'puppeteer' is better.
    // Given we have @sparticuz/chromium in the main app, we could use that, but let's try simple jsPDF first for speed.

    // Actually, simple text dump is fine for MVP.
    // Note: jsPDF in Node might be tricky without window. 
    // Let's use a simpler approach: create a text-rich PDF.

    // Better yet, just return the Markdown string as a "Report" for now? 
    // Requirement said "10 page weekly 10am report... circulate to clients".
    // 10 pages is a lot of text.

    const doc = new jsPDF();

    // Split content by lines
    const lines = doc.splitTextToSize(content, 180);

    let y = 20;
    doc.setFontSize(16);
    doc.text(`Weekly Market Report - ${weekId}`, 10, y);
    y += 10;

    doc.setFontSize(11);
    for (const line of lines) {
        if (y > 280) {
            doc.addPage();
            y = 20;
        }
        doc.text(line, 10, y);
        y += 7;
    }

    // Output as ArrayBuffer
    const arrayBuffer = doc.output('arraybuffer');
    return Buffer.from(arrayBuffer);
}
