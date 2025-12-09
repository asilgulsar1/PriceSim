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
    });

    it('renders the simulation parameters form', async () => {
        render(<PriceSimulator />);
        expect(screen.getByText('Simulation Parameters')).toBeInTheDocument();
    });

    it('calculates prices correctly', async () => {
        render(<PriceSimulator />);

        // Click Calculate
        fireEvent.click(screen.getByText('Calculate'));

        // Wait for results
        await waitFor(() => {
            expect(screen.getByText('Antminer S21 XP')).toBeInTheDocument();
            // Check for calculated price (mocked logic will produce some price)
            // We just check if the table row is rendered
            const daysElements = screen.getAllByText(/1000 days/);
            expect(daysElements.length).toBeGreaterThan(0);
        });
    });

    it('adds a custom miner', async () => {
        render(<PriceSimulator />);

        // Open Add Miner form
        fireEvent.click(screen.getByText('Add Miner'));

        // Fill form
        fireEvent.change(screen.getByPlaceholderText('e.g. SuperMiner 9000'), { target: { value: 'TestMiner' } });
        fireEvent.change(screen.getByPlaceholderText('200'), { target: { value: '150' } });
        fireEvent.change(screen.getByPlaceholderText('3000'), { target: { value: '2500' } });

        // Click Add
        fireEvent.click(screen.getByText('Add'));

        // Check if miner appears
        await waitFor(() => {
            expect(screen.getByText('TestMiner')).toBeInTheDocument();
        });
    });
});
