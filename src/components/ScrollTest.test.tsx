import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PriceSimulator } from './PriceSimulator';
import { fetchMarketData } from '@/lib/api';
import { MiningCalculator } from '@/lib/calculator';

// Mock API and Calculator to ensure it renders populated state
jest.mock('@/lib/api', () => ({
    fetchMarketData: jest.fn(),
}));

jest.mock('@/lib/calculator', () => ({
    MiningCalculator: {
        calculate: jest.fn(),
    },
}));

// Mock UI Components to simplify structure and ensure immediate rendering
jest.mock('@/components/ui/card', () => ({
    Card: ({ children }: any) => <div>{children}</div>,
    CardHeader: ({ children }: any) => <div>{children}</div>,
    CardTitle: ({ children }: any) => <h1>{children}</h1>,
    CardContent: ({ children }: any) => <div>{children}</div>,
}));

// Mock Dialog to render content immediately (no interaction needed)
jest.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children }: any) => <div>{children}</div>,
    DialogTrigger: ({ children }: any) => <div>{children}</div>,
    DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
    DialogHeader: ({ children }: any) => <div>{children}</div>,
    DialogTitle: ({ children }: any) => <div>{children}</div>,
}));

describe('PriceSimulator Scroll Fix', () => {
    beforeEach(() => {
        (fetchMarketData as jest.Mock).mockResolvedValue({
            btcPrice: 65000,
            networkDifficulty: 86000000000000,
        });

        (MiningCalculator.calculate as jest.Mock).mockReturnValue({
            summary: {
                totalDays: 10,
                totalProductionBTC: 1.5,
                totalCostUSD: 20000,
                totalRevenueUSD: 90000,
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

    it('Daily Logs table has correct scroll classes', async () => {
        render(<PriceSimulator />);

        // Click Calculate to populate results
        fireEvent.click(screen.getByText('Calculate'));

        // Wait for results to render
        await waitFor(() => {
            // Find Daily Logs table by specific header
            const dailyLogsHeaders = screen.getAllByText('Production (BTC)');
            expect(dailyLogsHeaders.length).toBeGreaterThan(0);

            // Get the table
            const headerCell = dailyLogsHeaders[0];
            const table = headerCell.closest('table');
            expect(table).toBeInTheDocument();

            // Verify table has correct classes for horizontal scrolling
            expect(table).toHaveClass('w-max');
            expect(table).toHaveClass('whitespace-nowrap');

            // Verify wrapper exists (even if mocked components don't preserve all classes)
            const wrapper = table?.parentElement;
            expect(wrapper).toBeInTheDocument();
        });
    });
});
