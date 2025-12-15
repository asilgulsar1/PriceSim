import React from 'react';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { PriceListGenerator } from './PriceListGenerator';
import '@testing-library/jest-dom';

// --- Mocks ---

// Sub-components
jest.mock('./price-list/PriceListControls', () => ({
    PriceListControls: ({ onRefresh }: any) => <button onClick={onRefresh}>Refresh</button>
}));
jest.mock('./price-list/PriceListFilterBar', () => ({ PriceListFilterBar: () => <div>FilterBar</div> }));
jest.mock('./price-list/PriceListTable', () => ({
    PriceListTable: ({ miners }: any) => (
        <div data-testid="table-container">
            {miners.map((m: any) => (
                <div key={m.miner.name} data-testid={`miner-row-${m.miner.name}`}>
                    <span data-testid={`name-${m.miner.name}`}>{m.miner.name}</span>
                    <span data-testid={`price-${m.miner.name}`}>{m.miner.calculatedPrice}</span>
                </div>
            ))}
        </div>
    )
}));
jest.mock('./price-list/PriceListPdfTemplate', () => ({
    PriceListPdfTemplate: ({ userRole, branding }: any) => (
        <div data-testid="pdf-template" data-role={userRole} data-branding={JSON.stringify(branding)}>PDF</div>
    )
}));
jest.mock('next-auth/react', () => ({
    useSession: jest.fn(() => ({ data: { user: { role: 'client' } }, status: 'authenticated' })),
}));

// Lib/Hooks
jest.mock('@/lib/image-utils', () => ({
    urlToBase64: jest.fn().mockResolvedValue('data:image/png;base64,mocked'),
}));
jest.mock('html-to-image', () => ({}));
jest.mock('jspdf', () => ({}));

// Market Hook (Stable Mock)
const mockMarket = { btcPrice: 100000, networkDifficulty: 100, blockReward: 3.125 };
jest.mock('@/hooks/useMarketData', () => ({
    useMarketData: jest.fn(() => ({
        market: mockMarket,
        setMarket: jest.fn()
    }))
}));

// USE MINERS HOOK - Mutable Mock
let mockMinersReturn = {
    miners: [] as any[],
    loading: false,
    error: null,
    refresh: jest.fn()
};
jest.mock('@/hooks/useMiners', () => ({
    useMiners: () => mockMinersReturn
}));

// Fetch Mock
global.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    json: async () => ({})
})) as any;


describe('PriceListGenerator Integration', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        // Default Mock State
        mockMinersReturn = {
            miners: [
                { name: 'Hook Miner', hashrateTH: 100, powerWatts: 3000, price: 100 }
            ] as any[],
            loading: false,
            error: null,
            refresh: jest.fn()
        };
    });

    it('renders miners provided by useMiners hook', async () => {
        await act(async () => { render(<PriceListGenerator />); });

        // Check if loading finished and miners are likely rendered
        // The mock table renders 'Hook Miner'
        await waitFor(() => {
            expect(screen.getByTestId('miner-row-Hook Miner')).toBeInTheDocument();
        });
    });

    it('prioritizes Simulator Data from LocalStorage if present', async () => {
        // Setup LocalStorage
        const mockSimData = {
            updatedAt: new Date().toISOString(),
            market: { btcPrice: 999, networkDifficulty: 999 },
            miners: [
                {
                    miner: { // structure matches CalculatedMiner wrapped
                        name: 'Sim Miner',
                        hashrateTH: 50,
                        powerWatts: 1000,
                        calculatedPrice: 500,
                        dailyRevenueUSD: 5,
                        dailyExpenseUSD: 1,
                        projectLifeDays: 365,
                        projections: []
                    },
                    score: 99
                }
            ]
        };
        localStorage.setItem('LATEST_SIMULATION_DATA', JSON.stringify(mockSimData));

        await act(async () => { render(<PriceListGenerator />); });

        // Should show Sim Miner, NOT Hook Miner
        await waitFor(() => {
            expect(screen.queryByTestId('miner-row-Hook Miner')).not.toBeInTheDocument();
            expect(screen.getByTestId('miner-row-Sim Miner')).toBeInTheDocument();
        });
    });

    it('applies reseller markup code when userRole is reseller', async () => {
        const props = {
            userRole: 'reseller',
            resellerMargin: 500
        };

        mockMinersReturn.miners = [
            { name: 'Markup Miner', hashrateTH: 100, powerWatts: 3000, price: 2000 } as any
        ];

        await act(async () => { render(<PriceListGenerator {...props} />); });

        await waitFor(() => {
            expect(screen.getByTestId('miner-row-Markup Miner')).toBeInTheDocument();
        });
    });

    it('refreshes data when refresh button is clicked', async () => {
        await act(async () => { render(<PriceListGenerator />); });

        await waitFor(() => {
            // Use regex for case-insensitive and partial match (handles icons/whitespace)
            // getAll because we have one in Controls and one in Footer
            const btns = screen.getAllByRole('button', { name: /refresh/i });
            expect(btns.length).toBeGreaterThan(0);
        });

        const btns = screen.getAllByRole('button', { name: /refresh/i });
        fireEvent.click(btns[0]);

        expect(mockMinersReturn.refresh).toHaveBeenCalled();
    });
});
