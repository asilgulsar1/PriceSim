import '@testing-library/jest-dom';

// Mock NextAuth to avoid ESM issues
jest.mock('@/auth', () => ({
    auth: jest.fn(() => Promise.resolve({ user: { email: 'test@example.com' } })),
    signIn: jest.fn(),
    signOut: jest.fn(),
    handlers: { GET: jest.fn(), POST: jest.fn() }
}));

// Mock Actions that might be called
jest.mock('@/app/actions', () => ({
    generateAiContent: jest.fn(),
    getMarketDataAction: jest.fn(() => Promise.resolve({
        btcPrice: 95000,
        networkDifficulty: 100000000000000,
        blockReward: 3.125
    }))
}));
