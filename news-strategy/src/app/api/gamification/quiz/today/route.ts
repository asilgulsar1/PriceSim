import { auth } from "@/auth";
import { getDailyQuiz } from "@/lib/blob-store";
import { getAgentStats } from "@/lib/gamification-store";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];
    const email = session.user.email;

    // 1. Check if already taken
    const stats = await getAgentStats(email);
    if (stats?.lastQuizDate === today) {
        return NextResponse.json({ completed: true });
    }

    // 2. Fetch Quiz
    const quiz = await getDailyQuiz(today);
    if (!quiz) {
        return NextResponse.json({ error: "No quiz generated for today yet." }, { status: 404 });
    }

    // 3. Strip Answers for Client
    const safeQuestions = quiz.questions.map(q => ({
        id: q.id,
        scenario: q.scenario,
        question: q.question,
        options: q.options,
        // Omit correctAnswerIndex and explanation
    }));

    return NextResponse.json({
        completed: false,
        date: quiz.date,
        questions: safeQuestions
    });
}
