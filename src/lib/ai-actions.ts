import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { getUser, addUser } from "@/lib/user-store";
import { logActivity } from "@/lib/activity-logger";
/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_simulation',
});

export async function generateAiContent(
    promptType: "professional" | "persuasive" | "technical",
    currentText: string,
    context?: {
        topMiners: string[];
        totalRevenue: number;
        maxRoi: number;
        btcPrice?: string;
        companyName?: string;
    }
): Promise<{ success: boolean; content?: string; error?: string; usage?: { used: number; limit: number } }> {
    try {
        const session = await auth();
        if (!session?.user?.email) return { success: false, error: "Not Authenticated" };

        const email = session.user.email;
        const user = await getUser(email);
        if (!user) return { success: false, error: "User not found" };

        // 1. Check Rate Limit (Daily Reset)
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

        // 2. Construct Prompt with Deal Context
        let contextStr = "";
        if (context) {
            contextStr = `\n\nDEAL CONTEXT:\n- Company: ${context.companyName || 'Our Firm'}\n- Bitcoin Price: ${context.btcPrice || 'Current Market Price'}\n- Top Recommendations: ${context.topMiners.join(", ")}\n- Max ROI Available: ${context.maxRoi.toFixed(0)}%\n- Est. Daily Revenue: $${context.totalRevenue.toLocaleString()}`;
        }

        const baseInstructions = {
            professional: `You are an Investment Banking Analyst at ${context?.companyName || 'a leading firm'}. Focus on ROI, capital efficiency, and market timing given Bitcoin is at ${context?.btcPrice || 'current levels'}. Tone: Formal, Objective.`,
            persuasive: `You are a Senior Consultant at ${context?.companyName || 'Galaxy Mining'}. Focus on urgency, scarce inventory, and massive revenue potential. Tone: Urgent, Confident.`,
            technical: `You are a Data Center Engineer. Focus on efficiency (J/TH) and hardware specs. Tone: Precise, Factual.`
        };

        const systemPrompt = `${baseInstructions[promptType]}
        
        TASK: Write a 2-3 sentence Executive Summary for this proposal.
        RULES:
        - Do not use markdown headers.
        - Keep it under 60 words.
        - Explicitly mention the Bitcoin Price context if relevant to ROI.
        - Use the DEAL CONTEXT metrics to make it specific.`;

        const messages: { role: string; content: string }[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: `User Draft: "${currentText}"${contextStr}` }
        ];

        // 3. Call OpenAI
        let generatedText = "";
        try {
            const completion = await openai.chat.completions.create({
                messages: messages as any,
                model: "gpt-4o", // Default to 4o for quality
                temperature: 0.7,
                max_tokens: 100,
            });
            generatedText = completion.choices[0].message.content || currentText;
        } catch (e: unknown) {
            console.error("OpenAI Error:", e);
            // Fallback Simulation for Dev/Error
            const fallbackPitches = {
                professional: `This proposal outlines a high-ROI acquisition strategy focused on ${context?.topMiners[0] || 'market-leading hardware'}, projected to deliver ${context?.maxRoi || 0}% annual returns through optimized capital allocation.`,
                persuasive: `Don't miss this allocation of ${context?.topMiners[0] || 'premium miners'}. With ${context?.maxRoi || 0}% ROI potential and strictly limited inventory, immediate execution is recommended to secure these revenue streams.`,
                technical: `Spec-sheet analysis confirms the ${context?.topMiners[0] || 'hardware'} as the efficiency leader. Optimized for high-density deployment, this fleet maximizes hashrate per watt for long-term viability.`
            };
            generatedText = fallbackPitches[promptType];
        }

        // 4. Update Usage
        usage.usedToday += 1;
        user.aiUsage = usage;
        await addUser(user);
        await logActivity(email, "AI_GENERATION", { promptType, length: generatedText.length });

        revalidatePath("/profile");
        return {
            success: true,
            content: generatedText,
            usage: { used: usage.usedToday, limit: usage.dailyLimit }
        };

    } catch (err: any) {
        console.error("Unexpected AI Error:", err);
        return { success: false, error: `System Error: ${err.message}` };
    }
}
