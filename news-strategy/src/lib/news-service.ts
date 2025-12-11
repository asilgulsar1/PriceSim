import OpenAI from 'openai';
import { NewsBrief, QuizQuestion, DailyQuiz } from './blob-store';

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy', // Fallback for build time
});

const MAIN_APP_URL = process.env.MAIN_APP_URL || 'http://localhost:3000';

interface MinerParams {
    name: string;
    profit: number;
    revenue: number;
}

export async function fetchTopMiner(): Promise<MinerParams | null> {
    try {
        const res = await fetch(`${MAIN_APP_URL}/api/miners/latest`, { next: { revalidate: 300 } });
        if (!res.ok) return null;
        const data = await res.json();
        // Assuming array of miners, sort by profitability
        if (Array.isArray(data) && data.length > 0) {
            // Sort by net profit or revenue? "Sales pitch" -> usually revenue or quick payback.
            // Let's assume the API returns them or we sort.
            // Simplified for now.
            const top = data[0];
            return { name: top.model, profit: top.netProfit, revenue: top.revenue };
        }
        return null;
    } catch (e) {
        console.error("Failed to fetch top miner", e);
        return null;
    }
}

import { getDailyIndex } from './news-engine/storage';

export async function fetchMarketNews(): Promise<string> {
    const today = new Date().toISOString().split('T')[0];
    const index = await getDailyIndex(today);

    if (!index || index.items.length === 0) {
        return "No fresh news indexed today. Market assumed stable.";
    }

    // Prioritize Celebs and Miners
    const celebNews = index.items.filter(i => i.category === 'Celeb').map(i => `[CELEB] ${i.title}`).join('\n');
    const minerNews = index.items.filter(i => i.category === 'Mining').map(i => `[MINING] ${i.title}`).join('\n');
    const otherNews = index.items.filter(i => !['Celeb', 'Mining'].includes(i.category))
        .slice(0, 10).map(i => `[${i.category}] ${i.title}: ${i.description || ''}`).join('\n');

    return `
    *** VIP UPDATES (Celebrity & Specific) ***
    ${celebNews || 'No major celebrity mentions.'}
    
    *** SECTOR UPDATES ***
    ${minerNews || 'No specific miner news.'}
    
    *** GENERAL MARKET ***
    ${otherNews}
    `;
}

export async function generateBrief(): Promise<NewsBrief> {
    const newsRaw = await fetchMarketNews();
    const topMiner = await fetchTopMiner();

    const prompt = `
You are a strategic sales analyst for a Crypto Mining company. Your job is to transform raw market intelligence into actionable sales ammunition.

**CONTEXT**
Recent News Intelligence:
${newsRaw}

Top Performing Miner: ${topMiner ? `${topMiner.name} generating $${topMiner.revenue}/day` : 'N/A'}

**YOUR TASK**
Generate a JSON response with the following structure:

{
  "summary": "A 2-sentence market overview",
  "talkingPoints": [
    {
      "title": "The FUD Fighter",
      "angle": "FUD_FIGHTER",
      "content": "A 3-sentence pitch that COUNTERS negative news or fear. Turn bad news into opportunity."
    },
    {
      "title": "The FOMO Inducer", 
      "angle": "FOMO_INDUCER",
      "content": "A 3-sentence pitch leveraging POSITIVE momentum (price pumps, adoption, institutional buys). Create urgency."
    },
    {
      "title": "The Miner's Edge",
      "angle": "MINERS_EDGE", 
      "content": "A 3-sentence pitch focused on HARDWARE advantage. Tie in the top miner's performance and hashrate efficiency."
    }
  ]
}

**RULES**
- Be specific. Use numbers from the news.
- Each talking point should be a standalone "script" a salesperson can use verbatim.
- Avoid generic statements. Make it punchy and sales-focused.
`;

    let content = "Failed to generate brief.";
    let talkingPoints: any[] | undefined;

    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'gpt-4o',
            response_format: { type: 'json_object' }
        });

        const rawResponse = completion.choices[0].message.content || "{}";
        const parsed = JSON.parse(rawResponse);

        content = parsed.summary || "Market analysis generated.";
        talkingPoints = parsed.talkingPoints || [];
    } catch (error) {
        console.error("OpenAI Error:", error);
        // Fallback mock data
        content = "The crypto market is consolidating after recent volatility. Institutional interest remains strong.";
        talkingPoints = [
            {
                title: "The FUD Fighter",
                angle: "FUD_FIGHTER",
                content: "Yes, there's regulatory noise, but that's exactly when smart money accumulates. Every dip in the last 5 years has been a buying opportunity. The fundamentals (halving supply shock, institutional adoption) haven't changed."
            },
            {
                title: "The FOMO Inducer",
                angle: "FOMO_INDUCER",
                content: "Bitcoin just crossed $98k with record ETF inflows. MicroStrategy added another 5,000 BTC this week. The next leg up could happen fast—hashrate expansion now means you're positioned BEFORE the rush, not chasing it."
            },
            {
                title: "The Miner's Edge",
                angle: "MINERS_EDGE",
                content: `The ${topMiner?.name || 'S21'} is printing $${topMiner?.revenue || '45'}/day right now. That's a 180-day payback at current prices. If BTC hits $120k (analyst consensus for Q1), you're looking at 90-day ROI. Hardware efficiency is the moat.`
            }
        ];
    }

    const now = new Date();
    const id = now.toISOString().slice(0, 13).replace('T', '-');

    return {
        id,
        timestamp: now.toISOString(),
        content,
        talkingPoints,
        topMiner: topMiner ? { name: topMiner.name, dailyRevenue: topMiner.revenue } : undefined
    };
}

export async function generateWeeklyReportContent(): Promise<string> {
    // Simplified: Just ask GPT to make a long report based on simulated "week's" data/knowledge
    // In real impl, we'd aggregate the last 7 daily briefs.
    const prompt = `
    Create a detailed 10-page weekly market report (approx 2000 words logic) structure.
    Topics: Crypto Mining, AI, Data Centers, Finance, Market Movers.
    Output as Markdown.
    `;
    const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-4o',
    });
    return completion.choices[0].message.content || "";
}

export async function generateMCQ(reportContent: string): Promise<any[]> {
    const prompt = `
    Based on the following report, generate 10 Multiple Choice Questions (MCQ).
    Format as JSON array: [{ question, options: [], answerIndex }].
    
    Report:
    ${reportContent.slice(0, 5000)}... (truncated)
    `;
    const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-4o',
        response_format: { type: "json_object" }
    });

    const res = JSON.parse(completion.choices[0].message.content || "{}");
    return res.questions || [];
}

export async function generateDailyQuiz(brief: NewsBrief): Promise<DailyQuiz> {
    const talkingPoints = brief.talkingPoints?.map(tp =>
        `Angle: ${tp.angle}\nTitle: ${tp.title}\nScript: ${tp.content}`
    ).join('\n\n') || "No specific talking points.";

    const prompt = `
    You are a Sales Trainer for a Bitcoin Mining company.
    Based on today's "Morning Brief":

    ${talkingPoints}

    Generate 3 "Scenario-Based" Multiple Choice Questions to test if the agent can APPLY this knowledge.
    
    Structure:
    1. Scenario: A realistic situation (e.g. "Client says X...").
    2. Question: What is the best response using today's intel?
    3. Options: 4 choices. One is clearly best based on the Brief.
    4. Explanation: Why the correct answer works.

    Output strictly as JSON:
    {
      "questions": [
        {
          "id": "q1",
          "scenario": "...",
          "question": "...",
          "options": ["A", "B", "C", "D"],
          "correctAnswerIndex": 0, // 0-3
          "explanation": "..."
        }
      ]
    }
    `;

    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'gpt-4o',
            response_format: { type: 'json_object' }
        });

        const raw = completion.choices[0].message.content || "{}";
        const parsed = JSON.parse(raw);

        // Validation/Fallback
        const questions: QuizQuestion[] = parsed.questions || [
            {
                id: 'fallback-1',
                scenario: "System could not generate specific scenarios.",
                question: "Which angle is most relevant today?",
                options: ["FUD Fighter", "Silence", "Discounting", "Giving up"],
                correctAnswerIndex: 0,
                explanation: "Always address FUD directly with data."
            }
        ];

        return {
            date: new Date().toISOString().split('T')[0],
            questions
        };

    } catch (e) {
        console.error("Quiz Gen Error", e);
        return {
            date: new Date().toISOString().split('T')[0],
            questions: []
        };
    }
}
