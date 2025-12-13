'use server';

import { put } from '@vercel/blob';

interface QuoteRequest {
    minerName: string;
    companyName?: string;
    vatId?: string;
    email?: string; // Captured from session if available, or implied
    timestamp: string;
}

export async function submitQuoteRequest(data: QuoteRequest) {
    try {
        const filename = `quotes/${Date.now()}-${data.minerName.replace(/[^a-zA-Z0-9]/g, '-')}.json`;

        await put(filename, JSON.stringify(data, null, 2), {
            access: 'public',
            addRandomSuffix: false,
            token: process.env.BLOB_READ_WRITE_TOKEN
        });

        return { success: true };
    } catch (error) {
        console.error("Failed to save quote request", error);
        return { success: false, error: 'Failed to save request' };
    }
}
