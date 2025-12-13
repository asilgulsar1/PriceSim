/* eslint-disable */
'use server';

import { DEFAULT_MARKET_CONDITIONS } from '@/lib/constants';
import { auth, signIn, signOut } from "@/auth";
import { revalidatePath } from "next/cache";
import { getUser, addUser, User } from "@/lib/user-store";
import { logActivity } from "@/lib/activity-logger";
import OpenAI from "openai";

import { generateAiContent as generateAiContentLogic } from "@/lib/ai-actions";

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
) {
    return generateAiContentLogic(promptType, currentText, context);
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
