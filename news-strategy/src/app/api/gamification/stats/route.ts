import { auth } from "@/auth";
import { getAgentStats, createInitialStats } from "@/lib/gamification-store";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email') || session.user.email;

    // Security: Only allow fetching own stats unless admin (skipping complex RBAC for MVP)
    if (email !== session.user.email) {
        // simple block
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let stats = await getAgentStats(email);
    if (!stats) stats = createInitialStats(email);

    return NextResponse.json(stats);
}
