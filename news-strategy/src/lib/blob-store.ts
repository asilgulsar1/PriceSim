import { put, list, head } from '@vercel/blob';

export interface NewsBrief {
    id: string; // YYYY-MM-DD-HH
    timestamp: string;
    content: string; // The markdown brief
    talkingPoints?: {
        title: string;
        angle: 'FUD_FIGHTER' | 'FOMO_INDUCER' | 'MINERS_EDGE';
        content: string;
    }[];
    topMiner?: {
        name: string;
        dailyRevenue: number;
    };
}

export interface QuizQuestion {
    id: string;
    scenario: string;
    question: string;
    options: string[];
    correctAnswerIndex: number;
    explanation: string;
}

export interface DailyQuiz {
    date: string; // YYYY-MM-DD
    questions: QuizQuestion[];
}

const QUIZ_DIR = 'quizzes/';

export async function saveDailyQuiz(quiz: DailyQuiz) {
    await put(`${QUIZ_DIR}${quiz.date}.json`, JSON.stringify(quiz), {
        access: 'public',
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true,
    });
}

export async function getDailyQuiz(date: string): Promise<DailyQuiz | null> {
    try {
        const path = `${QUIZ_DIR}${date}.json`;
        const { blobs } = await list({ prefix: path, limit: 1, token: process.env.BLOB_READ_WRITE_TOKEN });
        const blob = blobs.find(b => b.pathname === path);
        if (!blob) return null;

        const res = await fetch(blob.url);
        if (!res.ok) return null;
        return (await res.json()) as DailyQuiz;
    } catch (e) {
        console.error("Error fetching daily quiz", e);
        return null;
    }
}

export type WorkflowStage = 'IDLE' | 'MARKET_UPDATE' | 'SCALING_PITCH' | 'PRICE_PITCH' | 'MGMT_ESCALATION' | 'COOLDOWN';

export interface SalesProgress {
    email: string;
    lastMcqPassedAt: string | null;
    completedReports: string[]; // List of Report IDs
    workflowStage: WorkflowStage;
    lastInteraction: string; // ISO Date of last state change
}

const NEWS_DIR = 'news/';
const REPORTS_DIR = 'reports/';
const SALES_DIR = 'sales/';

export async function saveDailyBrief(brief: NewsBrief) {
    // Save as "latest.json" for quick access
    await put(`${NEWS_DIR}latest.json`, JSON.stringify(brief), {
        access: 'public',
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true,
    });

    // Also archive it by ID
    await put(`${NEWS_DIR}archive/${brief.id}.json`, JSON.stringify(brief), {
        access: 'public',
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true,
    });
}

export async function getLatestBrief(): Promise<NewsBrief | null> {
    try {
        const { blobs } = await list({ prefix: `${NEWS_DIR}latest.json`, limit: 1, token: process.env.BLOB_READ_WRITE_TOKEN });
        if (blobs.length === 0) return null;
        const res = await fetch(blobs[0].url);
        if (!res.ok) return null;
        return (await res.json()) as NewsBrief;
    } catch (e) {
        console.error("Error fetching latest brief", e);
        return null;
    }
}

export async function getBriefById(id: string): Promise<NewsBrief | null> {
    try {
        const path = `${NEWS_DIR}archive/${id}.json`;
        const { blobs } = await list({ prefix: path, limit: 1, token: process.env.BLOB_READ_WRITE_TOKEN });
        const blob = blobs.find(b => b.pathname === path);
        if (!blob) return null;
        const res = await fetch(blob.url);
        if (!res.ok) return null;
        return (await res.json()) as NewsBrief;
    } catch (e) {
        return null;
    }
}

export async function listArchivedBriefs(): Promise<{ id: string, date: string }[]> {
    try {
        const { blobs } = await list({ prefix: `${NEWS_DIR}archive/`, limit: 50, token: process.env.BLOB_READ_WRITE_TOKEN });
        return blobs.map(b => {
            const id = b.pathname.replace(`${NEWS_DIR}archive/`, '').replace('.json', '');
            return { id, date: b.uploadedAt.toISOString() };
        }).sort((a, b) => b.id.localeCompare(a.id)); // Newest first
    } catch (e) {
        return [];
    }
}

export async function saveSalesProgress(data: SalesProgress) {
    await put(`${SALES_DIR}${data.email}.json`, JSON.stringify(data), {
        access: 'public',
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true,
    });
}

export async function getSalesProgress(email: string): Promise<SalesProgress | null> {
    try {
        const path = `${SALES_DIR}${email}.json`;
        const { blobs } = await list({ prefix: path, limit: 1, token: process.env.BLOB_READ_WRITE_TOKEN });
        const blob = blobs.find(b => b.pathname === path);
        if (!blob) return null;

        const res = await fetch(blob.url);
        if (!res.ok) return null;
        return (await res.json()) as SalesProgress;
    } catch (e) {
        return null;
    }
}

const WORKFLOW_DIR = 'workflows/';

export interface ClientWorkflowState {
    dealId: number;
    workflowStage: WorkflowStage;
    lastInteraction: string;
}

export async function saveClientWorkflow(state: ClientWorkflowState) {
    await put(`${WORKFLOW_DIR}${state.dealId}.json`, JSON.stringify(state), {
        access: 'public',
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true,
    });
}

export async function getClientWorkflow(dealId: number): Promise<ClientWorkflowState | null> {
    try {
        const path = `${WORKFLOW_DIR}${dealId}.json`;
        const { blobs } = await list({ prefix: path, limit: 1, token: process.env.BLOB_READ_WRITE_TOKEN });
        const blob = blobs.find(b => b.pathname === path);
        if (!blob) return null;

        const res = await fetch(blob.url);
        if (!res.ok) return null;
        return (await res.json()) as ClientWorkflowState;
    } catch (e) {
        return null;
    }
}
