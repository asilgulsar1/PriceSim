import { put, list } from '@vercel/blob';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export interface AgentStats {
    email: string;
    currentStreak: number;       // Consecutive days reading brief
    maxStreak: number;
    totalQuizzes: number;
    accuracyScore: number;       // % Correct (moving average)
    readingEfficiency: number;   // Words per minute (derived from time-on-page)
    lastActive: string;          // ISO Date
    lastQuizDate?: string;       // YYYY-MM-DD
    points: number;              // (Streak * 10) + (Accuracy * 100)
}

export interface QuizResult {
    quizId: string;
    email: string;
    score: number; // 0 to 100
    timestamp: string;
}

// ----------------------------------------------------------------------
// Constants & Paths
// ----------------------------------------------------------------------

const GAMIFICATION_DIR = 'gamification/';
const STATS_DIR = `${GAMIFICATION_DIR}stats/`;

// ----------------------------------------------------------------------
// Store Operations
// ----------------------------------------------------------------------

/**
 * Save or update an agent's stats
 */
export async function saveAgentStats(stats: AgentStats) {
    await put(`${STATS_DIR}${stats.email}.json`, JSON.stringify(stats), {
        access: 'public',
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true,
    });
}

/**
 * Retrieve an agent's stats
 */
export async function getAgentStats(email: string): Promise<AgentStats | null> {
    try {
        const path = `${STATS_DIR}${email}.json`;
        // Optimization: Try fetching directly if we assume it exists, or list to check existence/auth.
        // Direct fetch is faster if we don't care about 404 handling logic being complex.
        // Using list to match other store patterns for safety.
        const { blobs } = await list({ prefix: path, limit: 1, token: process.env.BLOB_READ_WRITE_TOKEN });
        const blob = blobs.find(b => b.pathname === path);

        if (!blob) return null;

        const res = await fetch(blob.url);
        if (!res.ok) return null;

        return (await res.json()) as AgentStats;
    } catch (e) {
        console.error("Error fetching agent stats", e);
        return null;
    }
}

/**
 * Initialize default stats for a new agent
 */
export function createInitialStats(email: string): AgentStats {
    return {
        email,
        currentStreak: 0,
        maxStreak: 0,
        totalQuizzes: 0,
        accuracyScore: 0.0,
        readingEfficiency: 0,
        lastActive: new Date().toISOString(),
        points: 0
    };
}

/**
 * Fetch the leaderboard (Top N agents)
 * Warning: This lists ALL stats files. For a large team (>100), this should be cached or paginated.
 */
export async function getLeaderboard(limit: number = 10): Promise<AgentStats[]> {
    try {
        const { blobs } = await list({ prefix: STATS_DIR, token: process.env.BLOB_READ_WRITE_TOKEN });

        // Parallel fetch all stats (Sales teams are usually small, < 50)
        const statsPromises = blobs.map(async (blob) => {
            const res = await fetch(blob.url);
            if (!res.ok) return null;
            return (await res.json()) as AgentStats;
        });

        const allStats = (await Promise.all(statsPromises)).filter(s => s !== null) as AgentStats[];

        // Sort by Points (Desc) then Accuracy (Desc)
        return allStats
            .sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                return b.accuracyScore - a.accuracyScore;
            })
            .slice(0, limit);

    } catch (e) {
        console.error("Error fetching leaderboard", e);
        return [];
    }
}
