import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/gamification-store";

export async function GET() {
    // Publicly accessible within the org (could add auth check ideally)
    const leaderboard = await getLeaderboard(10); // Top 10

    // Map to safe public data (hide exact email if needed, but for internal sales dashboard email/name is fine)
    const safeData = leaderboard.map(l => ({
        email: l.email,
        points: l.points,
        streak: l.currentStreak,
        accuracy: l.accuracyScore
    }));

    return NextResponse.json(safeData);
}
