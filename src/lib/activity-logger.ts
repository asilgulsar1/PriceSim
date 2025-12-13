/* eslint-disable @typescript-eslint/no-explicit-any */
// import { createClient } from "@/utils/supabase/server"; // removed unused
import { put, list } from '@vercel/blob';

const ACTIVITY_LOG_DIR = 'activity-logs/';

export interface ActivityLog {
    id: string;
    timestamp: string;
    userEmail: string;
    action: 'AI_GENERATION' | 'PDF_EXPORT' | 'LOGIN';
    details: any;
}

export async function logActivity(userEmail: string, action: ActivityLog['action'], details: any) {
    try {
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        const logEntry: ActivityLog = { id, timestamp, userEmail, action, details };

        // Store as individual JSON file for simplicity (append-only log)
        const filename = `${ACTIVITY_LOG_DIR}${timestamp.split('T')[0]}/${userEmail}_${id}.json`;

        await put(filename, JSON.stringify(logEntry), {
            access: 'public',
            addRandomSuffix: false,
            token: process.env.BLOB_READ_WRITE_TOKEN
        });
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
}

export async function getActivityLogs(limit = 50): Promise<ActivityLog[]> {
    // Basic implementation: list all blobs in dir, fetch most recent.
    // In a real app with high volume, this would need a real DB.
    // For this scale, Blob list is acceptable.
    try {
        const { blobs } = await list({ prefix: ACTIVITY_LOG_DIR, limit });
        // Sort by upload time desc
        const sorted = blobs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

        const logs = await Promise.all(sorted.map(async b => {
            try {
                const res = await fetch(b.url);
                return await res.json() as ActivityLog;
            } catch { return null; }
        }));

        return logs.filter(l => l !== null) as ActivityLog[];
    } catch (error) {
        console.error("Failed to fetch logs", error);
        return [];
    }
}
