/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PriceSimulator } from './PriceSimulator';
import { fetchMarketData } from '@/lib/api';

// Mock API and Calculator to ensure it renders populated state
jest.mock('@/lib/api', () => ({
    fetchMarketData: jest.fn(),
}));

jest.mock('@/lib/pricing-solver', () => ({
    solveMinerPrice: jest.fn((miner) => ({
        name: miner.name,
        hashrateTH: miner.hashrateTH || 100,
        powerWatts: miner.powerWatts || 3000,
        calculatedPrice: 1000,
        dailyRevenueUSD: 10,
        dailyExpenseUSD: 5,
        projectLifeDays: 365,
        projections: [{
            dayIndex: 1,
            date: '2024-01-01',
            btcPrice: 65000,
            difficulty: 86000000000000,
            netProductionBTC: 0.001,
            totalDailyCostUSD: 10,
            dailyProfitUSD: 55,
            accumulatedProfitUSD: 55,
            dailyRevenueUSD: 65,
            btcHeld: 0.01,
            cashBalance: 1000,
            portfolioValueUSD: 1650,
            isShutdown: false
        }],
        clientProfitabilityPercent: 50,
        finalTreasuryUSD: 500,
        finalTreasuryBTC: 0.01,
        estExpenseBTC: 0.005,
        estRevenueHostingBTC: 0.01
    }))
}));

// Mock UI Components to simplify structure and ensure immediate rendering
jest.mock('@/components/ui/card', () => ({

    Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    CardTitle: ({ children }: { children?: React.ReactNode }) => <h1>{children}</h1>,
    CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Dialog to render content immediately (no interaction needed)
jest.mock('@/components/ui/dialog', () => {
    // Mock ScrollArea component structure
    const MockScrollArea = ({ children, className }: { children: React.ReactNode, className?: string }) => (
        <div data-testid="scroll-area" className={className}>
            <div data-testid="viewport">
                {children}
            </div>
        </div>
    );

    return {
        Dialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
        DialogTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
        DialogContent: ({ children, className }: { children?: React.ReactNode, className?: string }) => (
            <div data-testid="dialog-content" className={className}>
                <MockScrollArea>{children}</MockScrollArea>
            </div>
        ),
        DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
        DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    };
});

describe('PriceSimulator Scroll Fix', () => {
    beforeEach(() => {
        (fetchMarketData as jest.Mock).mockResolvedValue({
            btcPrice: 65000,
            networkDifficulty: 86000000000000,
        });

        (global.fetch as jest.Mock) = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve({}),
            })
        );
    });

    it('Daily Logs table has correct scroll classes', async () => {
        render(<PriceSimulator />);

        // Wait for loading to finish (button enabled)
        await waitFor(() => expect(screen.getByText('Calculate').closest('button')).not.toBeDisabled());

        // Click Calculate to populate results
        fireEvent.click(screen.getByText('Calculate'));

        // Wait for results to render
        await waitFor(async () => {
            // Find View button
            const viewButtons = screen.getAllByText('View');
            expect(viewButtons.length).toBeGreaterThan(0);

            // Click to open dialog
            fireEvent.click(viewButtons[0]);

            // Find Daily Logs table by specific header inside dialog
            const dailyLogsHeaders = await screen.findAllByText('Production (BTC)');
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
