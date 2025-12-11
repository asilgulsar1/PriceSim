import { auth } from "@/auth";
import { getAgentStats, saveAgentStats, createInitialStats } from "@/lib/gamification-store";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, durationSeconds } = await req.json();
    const email = session.user.email;
    const now = new Date();
    // const todayStr = now.toISOString().split('T')[0];

    // load stats
    let stats = await getAgentStats(email);
    if (!stats) {
        stats = createInitialStats(email);
    }

    // Logic is now delegated to the engine for specific updates
    if (type === 'READING_COMPLETE') {
        const { calculateReadingUpdate } = await import("@/lib/gamification-engine");
        stats = calculateReadingUpdate(stats, now);

        // Efficiency update (could be moved to engine too, but simple enough here)
        if (durationSeconds && durationSeconds > 0) {
            const wpm = (500 / durationSeconds) * 60;
            if (stats.readingEfficiency === 0) {
                stats.readingEfficiency = wpm;
            } else {
                stats.readingEfficiency = (stats.readingEfficiency * 0.7) + (wpm * 0.3);
            }
        }
    }

    await saveAgentStats(stats);
    return NextResponse.json({ success: true, stats });
}
