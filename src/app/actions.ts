'use server';

import { DEFAULT_MARKET_CONDITIONS } from '@/lib/constants';
import { auth, signIn, signOut } from "@/auth";
import { revalidatePath } from "next/cache";
import { getUser, addUser, User } from "@/lib/user-store";
import { logActivity } from "@/lib/activity-logger";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_simulation',
});

export async function generateAiContent(
    promptType: "professional" | "persuasive" | "technical",
    currentText: string
): Promise<{ success: boolean; content?: string; error?: string; usage?: { used: number; limit: number } }> {
    try {
        const session = await auth();
        if (!session?.user?.email) return { success: false, error: "Not Authenticated" };

        const email = session.user.email;
        const user = await getUser(email);
        if (!user) return { success: false, error: "User not found" };

        // 1. Check Rate Limit
        const today = new Date().toISOString().split('T')[0];
        const usage = user.aiUsage || { dailyLimit: 5, usedToday: 0, lastResetDate: today };

        if (usage.lastResetDate !== today) {
            usage.usedToday = 0;
            usage.lastResetDate = today;
        }

        if (usage.usedToday >= usage.dailyLimit) {
            return {
                success: false,
                error: "Daily AI limit reached (5/5). Please try again tomorrow.",
                usage: { used: usage.usedToday, limit: usage.dailyLimit }
            };
        }

        // 2. Call OpenAI
        let generatedText = "";
        try {
            const systemPrompt =
                promptType === "professional" ? "You are a document UX expert. Redraft the text to be scannable, clear, and visually optimized for a professional PDF report. Use short paragraphs and clear hierarchy." :
                    promptType === "persuasive" ? "You are a sales UX strategist. Redraft the text to visually guide the reader to the benefits. Use compelling, punchy sentences and structure content to drive action." :
                        "You are a technical documentation specialist. Redraft the text for clarity and precision. Structure the data and specifications to be easily readable in a technical report format.";

            const messages: any[] = [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Improve this text for a Crypto Mining Proposal (Focus on readable PDF UX):\n\n"${currentText}"` }
            ];

            try {
                // Attempt requested model
                const completion = await openai.chat.completions.create({
                    messages,
                    model: "gpt-5.2",
                });
                generatedText = completion.choices[0].message.content || currentText;
            } catch (modelError: any) {
                // Fallback if model not available
                console.warn(`GPT-5.2 failed (${modelError.message}), falling back to GPT-4o`);
                const completion = await openai.chat.completions.create({
                    messages,
                    model: "gpt-4o",
                });
                generatedText = completion.choices[0].message.content || currentText;
            }

        } catch (e: any) {
            console.error("OpenAI Error:", e);
            if (process.env.NODE_ENV === 'development' || !process.env.OPENAI_API_KEY) {
                generatedText = `[AI SIMULATION (${promptType})]: ${currentText} (Enhanced for PDF UX)`;
            } else {
                return { success: false, error: `AI Provider Error: ${e.message || 'Unknown'}` };
            }
        }

        // 3. Update Usage & Log
        usage.usedToday += 1;
        user.aiUsage = usage;
        await addUser(user); // Persist usage increment

        await logActivity(email, "AI_GENERATION", { promptType, outputLength: generatedText.length });

        revalidatePath("/profile");
        return {
            success: true,
            content: generatedText,
            usage: { used: usage.usedToday, limit: usage.dailyLimit }
        };
    } catch (err: any) {
        console.error("Unexpected AI Error:", err);
        return { success: false, error: `Unexpected Error: ${err.message || "Unknown"}` };
    }
}

export async function getMarketDataAction() {
    try {
        const [priceRes, diffRes] = await Promise.all([
            fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', { next: { revalidate: 300 } }), // Cache 5 min
            fetch('https://blockchain.info/q/getdifficulty', { next: { revalidate: 3600 } }) // Cache 1 hour
        ]);

        let btcPrice = DEFAULT_MARKET_CONDITIONS.btcPrice;
        let difficulty = DEFAULT_MARKET_CONDITIONS.networkDifficulty;

        if (priceRes.ok) {
            const priceData = await priceRes.json();
            if (priceData?.bitcoin?.usd) {
                btcPrice = priceData.bitcoin.usd;
            }
        }

        if (diffRes.ok) {
            const text = await diffRes.text();
            const val = parseFloat(text);
            if (!isNaN(val)) difficulty = val;
        }

        return {
            btcPrice,
            networkDifficulty: difficulty,
            blockReward: 3.125
        };
    } catch (error) {
        console.error('Server Action: Failed to fetch market data', error);
        // Return default gracefully
        return {
            btcPrice: DEFAULT_MARKET_CONDITIONS.btcPrice,
            networkDifficulty: DEFAULT_MARKET_CONDITIONS.networkDifficulty,
            blockReward: 3.125
        };
    }
}
