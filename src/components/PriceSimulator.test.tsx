import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PriceSimulator } from './PriceSimulator';
import { fetchMarketData } from '@/lib/api';
import { MiningCalculator } from '@/lib/calculator';

// Mock the API
jest.mock('@/lib/api', () => ({
    fetchMarketData: jest.fn(),
}));

// Mock pricing-solver
jest.mock('@/lib/pricing-solver', () => ({
    solveMinerPrice: jest.fn((miner) => ({
        name: miner.name,
        hashrateTH: miner.hashrateTH,
        powerWatts: miner.powerWatts,
        calculatedPrice: 1000,
        dailyRevenueUSD: 10,
        dailyExpenseUSD: 5,
        projectLifeDays: 365,
        projections: [],
        clientProfitabilityPercent: 50,
        finalTreasuryUSD: 500,
        finalTreasuryBTC: 0.01,
        estExpenseBTC: 0.005,
        estRevenueHostingBTC: 0.01
    }))
}));

// Mock MiningCalculator
jest.mock('@/lib/calculator', () => {
    return {
        MiningCalculator: {
            calculate: jest.fn(),
        },
        // Keep interfaces as is (they are types, so ignored by Jest, but if used as values...)
        // We only need to mock the static method.
    };
});

// Mock UI components
jest.mock('@/components/ui/card', () => ({
    Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CardTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
    CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('PriceSimulator', () => {
    beforeEach(() => {
        (fetchMarketData as jest.Mock).mockResolvedValue({
            btcPrice: 65000,
            networkDifficulty: 86000000000000,
        });

        (MiningCalculator.calculate as jest.Mock).mockReturnValue({
            summary: {
                totalDays: 1000,
                totalProductionBTC: 1.5,
                totalCostUSD: 20000,
                totalRevenueUSD: 90000,
                totalProfitUSD: 70000,
                roi: 350,
                daysUntilShutdown: 1000,
            },
            projections: [
                {
                    dayIndex: 0,
                    btcPrice: 65000,
                    difficulty: 86000000000000,
                    netProductionBTC: 0.001,
                    totalDailyCostUSD: 20,
                    dailyProfitUSD: 45,
                    isShutdown: false,
                }
            ]

        });

        // Mock global fetch
        (global.fetch as jest.Mock) = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve({}),
            })
        );
    });

    it('renders the simulation parameters form', async () => {
        render(<PriceSimulator />);
        await waitFor(() => expect(screen.getByText('Market Assumptions')).toBeInTheDocument());
        // Wait for button to be enabled to ensure initial load is done
        await waitFor(() => expect(screen.getAllByText('Calculate')[0].closest('button')).not.toBeDisabled());
    });

    it('calculates prices correctly', async () => {
        render(<PriceSimulator />);

        // Wait for loading to finish
        await waitFor(() => expect(screen.getAllByText('Calculate')[0].closest('button')).not.toBeDisabled());

        // Click Calculate
        fireEvent.click(screen.getAllByText('Calculate')[0]);

        // Wait for results
        // Check for calculated price
        const results = await screen.findAllByText('Antminer S21 XP', {}, { timeout: 3000 });
        expect(results.length).toBeGreaterThan(0);
        const daysElements = screen.getAllByText(/365 days/);
        expect(daysElements.length).toBeGreaterThan(0);
    });

    it('adds a custom miner', async () => {
        render(<PriceSimulator />);

        // Open Add Miner form
        fireEvent.click(screen.getByText('Add Custom Miner'));

        // Fill form
        fireEvent.change(screen.getByPlaceholderText('Antminer S21 Pro'), { target: { value: 'TestMiner' } });
        fireEvent.change(screen.getByPlaceholderText('200'), { target: { value: '150' } });
        fireEvent.change(screen.getByPlaceholderText('3000'), { target: { value: '2500' } });

        // Click Add
        fireEvent.click(screen.getByText('Add'));

        // Wait for loading to finish
        await waitFor(() => expect(screen.getAllByText('Calculate')[0].closest('button')).not.toBeDisabled());

        // Click Calculate to refresh the list with the new miner
        fireEvent.click(screen.getAllByText('Calculate')[0]);

        // Check if miner appears
        // Check if miner appears
        const miners = await screen.findAllByText('TestMiner', {}, { timeout: 3000 });
        expect(miners.length).toBeGreaterThan(0);
    });
});
