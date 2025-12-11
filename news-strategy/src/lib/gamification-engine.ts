import { AgentStats } from "./gamification-store";

export function calculateReadingUpdate(stats: AgentStats, now: Date = new Date()): AgentStats {
    // Calendar-based streak logic
    const lastActive = new Date(stats.lastActive);
    let newStreak = stats.currentStreak;

    const isSameDay = stats.lastActive && new Date(stats.lastActive).getDate() === now.getDate() &&
        new Date(stats.lastActive).getMonth() === now.getMonth() &&
        new Date(stats.lastActive).getFullYear() === now.getFullYear();

    const isYesterday = (d1: Date, d2: Date) => {
        const yesterday = new Date(d2);
        yesterday.setDate(d2.getDate() - 1);
        return d1.getDate() === yesterday.getDate() &&
            d1.getMonth() === yesterday.getMonth() &&
            d1.getFullYear() === yesterday.getFullYear();
    };

    if (isSameDay) {
        // No streak change, just update timestamps/efficiency
        return {
            ...stats,
            lastActive: now.toISOString()
        };
    }

    if (isYesterday(lastActive, now)) {
        // Perfect streak
        newStreak += 1;
    } else {
        // Gap > 1 day
        newStreak = 1;
    }

    // Points for maintaining streak
    const streakBonus = newStreak * 10;

    return {
        ...stats,
        currentStreak: newStreak,
        maxStreak: Math.max(stats.maxStreak, newStreak),
        points: stats.points + streakBonus,
        lastActive: now.toISOString()
    };
}

export function calculateQuizUpdate(stats: AgentStats, correctDetails: { total: number, correct: number }): AgentStats {
    const { total, correct } = correctDetails;
    const accuracy = (correct / total) * 100;

    // Update Moving Average Accuracy
    const weightedOld = stats.accuracyScore * stats.totalQuizzes; // e.g. 50% * 2 = 100 "points"
    const weightedNew = accuracy; // e.g. 100%
    const newTotal = stats.totalQuizzes + 1;
    const newAccuracy = (weightedOld + weightedNew) / newTotal;

    const pointsEarned = (correct * 10) + (accuracy === 100 ? 50 : 0); // 10 per Q + 50 bonus for perfect

    return {
        ...stats,
        totalQuizzes: newTotal,
        accuracyScore: newAccuracy,
        points: stats.points + pointsEarned,
        lastQuizDate: new Date().toISOString().split('T')[0]
    };
}
