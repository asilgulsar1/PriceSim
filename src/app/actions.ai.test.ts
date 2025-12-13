/**
 * @jest-environment node
 */

/* eslint-disable */
import { generateAiContent } from '@/lib/ai-actions';

// Mock dependencies
jest.mock("@/auth", () => ({
    auth: jest.fn().mockImplementation(() => {
        return Promise.resolve({ user: { email: "test@example.com" } });
    })
}));

jest.mock("@/lib/user-store", () => ({
    getUser: jest.fn().mockResolvedValue({
        email: "test@example.com",
        aiUsage: { dailyLimit: 100, usedToday: 0, lastResetDate: new Date().toISOString().split('T')[0] }
    }),
    addUser: jest.fn().mockResolvedValue(true)
}));

jest.mock("@/lib/activity-logger", () => ({
    logActivity: jest.fn()
}));

jest.mock("next/cache", () => ({
    revalidatePath: jest.fn()
}));

// Setup Global Mock Function
// This bypasses Jest hoisting issues by using the global namespace
const mockCreate = jest.fn();
(global as any).mockOpenAICreate = mockCreate;

jest.mock("openai", () => {
    return jest.fn().mockImplementation(() => {
        return {
            chat: {
                completions: {
                    create: (...args: any[]) => (global as any).mockOpenAICreate(...args)
                }
            }
        };
    });
});

describe('AI Content Generation', () => {
    beforeEach(() => {
        // Clear the specific mock
        mockCreate.mockReset();
        // Setup default behavior
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: "Generated Content" } }]
        });
    });

    it('should be defined', () => {
        expect(typeof generateAiContent).toBe('function');
    });

    it('should include company name and BTC price in the system prompt', async () => {
        const context = {
            topMiners: ["Antminer S21", "M50S"],
            totalRevenue: 500,
            maxRoi: 120,
            btcPrice: "$95,000",
            companyName: "Acme Mining Co"
        };


        await generateAiContent("professional", "Draft text", context);

        // Verify OpenAI was called
        expect(mockCreate).toHaveBeenCalled();

        // Inspect the messages passed to OpenAI
        const callArgs = mockCreate.mock.calls[0][0];
        const systemMessage = callArgs.messages.find((m: any) => m.role === "system").content;
        const userMessage = callArgs.messages.find((m: any) => m.role === "user").content;

        // Check for key substitutions
        expect(systemMessage).toContain("Acme Mining Co");
        expect(systemMessage).toContain("$95,000");
        expect(userMessage).toContain("DEAL CONTEXT");
        expect(userMessage).toContain("Acme Mining Co");
    });

    it('should fallback gracefully if context is missing', async () => {
        await generateAiContent("professional", "Draft text");

        expect(mockCreate).toHaveBeenCalled();
        const callArgs = mockCreate.mock.calls[0][0];
        const systemMessage = callArgs.messages.find((m: any) => m.role === "system").content;

        // Should use defaults
        expect(systemMessage).toContain("leading firm"); // Default fallback
    });
});
