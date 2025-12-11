import { auth } from "@/auth";
import { getAgentStats, saveAgentStats, createInitialStats } from "@/lib/gamification-store";
import { getDailyQuiz } from "@/lib/blob-store";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { date, answers } = await req.json(); // answers: { [questionId]: number }
    const email = session.user.email;

    // 1. Fetch Quiz for grading
    const quiz = await getDailyQuiz(date);
    if (!quiz) {
        return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // 3. Update Stats
    let stats = await getAgentStats(email);
    if (!stats) stats = createInitialStats(email);

    // 4. Check Answers & Grade
    let score = 0;
    const results = quiz.questions.map(q => {
        const isCorrect = answers[q.id] === q.correctAnswerIndex;
        if (isCorrect) score++;
        return {
            questionId: q.id,
            correct: isCorrect,
            correctAnswerIndex: q.correctAnswerIndex, // Reveal answer
            explanation: q.explanation // Reveal explanation
        };
    });

    // 5. Update Stats (Using Engine)
    const { calculateQuizUpdate } = await import("@/lib/gamification-engine");
    stats = calculateQuizUpdate(stats, { total: quiz.questions.length, correct: score });// e.g. 100% = 10 pts, 50% = 5 pts.

    // Bonus for 100%
    if (score === quiz.questions.length) stats.points += 5; // Changed condition to check for correct count

    stats.lastActive = new Date().toISOString();
    await saveAgentStats(stats);

    return NextResponse.json({
        score,
        results,
        newStats: stats
    });
}
