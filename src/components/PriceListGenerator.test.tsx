import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { PriceListGenerator } from './PriceListGenerator';
import '@testing-library/jest-dom';

// Mocks
jest.mock('./price-list/PriceListControls', () => ({
    PriceListControls: ({ onRefresh }: any) => <button onClick={onRefresh}>Fresh Data</button>
}));
jest.mock('./price-list/PriceListFilterBar', () => ({ PriceListFilterBar: () => <div>FilterBar</div> }));
jest.mock('./price-list/PriceListTable', () => ({
    PriceListTable: ({ miners }: any) => (
        <table>
            <tbody>
                {miners.map((m: any) => (
                    <tr key={m.miner.name}>
                        <td>{m.miner.name}</td>
                        <td data-testid={`price-${m.miner.name}`}>{m.miner.calculatedPrice}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}));
jest.mock('./price-list/PriceListPdfTemplate', () => ({ PriceListPdfTemplate: () => <div>PDF</div> }));
jest.mock('html-to-image', () => ({}));
jest.mock('jspdf', () => ({}));
jest.mock('@/hooks/useMarketData', () => ({
    useMarketData: () => ({
        market: { btcPrice: 100000, networkDifficulty: 100 },
        setMarket: jest.fn()
    })
}));

describe('PriceListGenerator Sync Logic', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        (global.fetch as any) = jest.fn(() => Promise.resolve({ ok: false, json: async () => ({}) }));
    });

    it('loads Simulator data (CalculatedMiner[]) from LocalStorage', async () => {
        // Simulator saves raw calculated miners
        const mockSimData = {
            updatedAt: new Date().toISOString(),
            market: { btcPrice: 90000, networkDifficulty: 90 },
            miners: [ // Array of CalculatedMiner
                {
                    name: 'Simulator Miner',
                    hashrateTH: 100,
                    powerWatts: 3000,
                    calculatedPrice: 100,
                    dailyRevenueUSD: 10,
                    dailyExpenseUSD: 5,
                    projectLifeDays: 365,
                    projections: []
                }
            ]
        };
        localStorage.setItem('LATEST_SIMULATION_DATA', JSON.stringify(mockSimData));

        await act(async () => { render(<PriceListGenerator />); });
        fireEvent.click(screen.getByText('Fresh Data'));

        await waitFor(() => {
            expect(screen.getByText('Simulator Miner')).toBeInTheDocument();
            // Verify it didn't crash
        });
    });

    it('loads API data (MinerScoreDetail[]) from Fallback', async () => {
        // API returns Ranked miners (MinerScoreDetail)
        (global.fetch as any) = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: async () => ({
                    updatedAt: new Date().toISOString(),
                    miners: [
                        {
                            miner: { // Nested
                                name: 'API Miner',
                                hashrateTH: 110,
                                powerWatts: 3100,
                                calculatedPrice: 200,
                                dailyRevenueUSD: 12,
                                dailyExpenseUSD: 6,
                                projectLifeDays: 365,
                                projections: []
                            },
                            score: 95
                        }
                    ]
                })
            })
        );

        await act(async () => { render(<PriceListGenerator />); });
        fireEvent.click(screen.getByText('Fresh Data'));

        await waitFor(() => {
            expect(screen.getByText('API Miner')).toBeInTheDocument();
        }, { timeout: 2000 });
    });

    it('falls back to local calculation only if both fail', async () => {
        // Empty storage, Failed fetch
        await act(async () => { render(<PriceListGenerator />); });
        fireEvent.click(screen.getByText('Fresh Data'));

        await waitFor(() => {
            // Should contain default miners from INITIAL_MINERS
            const rows = screen.getAllByRole('row');
            expect(rows.length).toBeGreaterThan(0);
        });
    });

    it('applies Max price logic using Hashrate matching', async () => {
        // Mock Sim Data: S23 1160T @ $19k
        const mockSimData = {
            updatedAt: new Date().toISOString(),
            market: { btcPrice: 90000, networkDifficulty: 90 },
            miners: [
                { name: 'Sim S23 Mix 1160T', hashrateTH: 1160, powerWatts: 3000, calculatedPrice: 19000, dailyRevenueUSD: 1, dailyExpenseUSD: 1, projectLifeDays: 1, projections: [] }
            ]
        };
        localStorage.setItem('LATEST_SIMULATION_DATA', JSON.stringify(mockSimData));

        // Mock Market API: S23 Hyd 3U (1160T) @ $29k
        (global.fetch as any) = jest.fn((url) => {
            if (url.includes('/api/market/latest')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        miners: [
                            {
                                name: 'Market S23 Hyd 3U',
                                stats: { middlePrice: 29000 },
                                specs: { hashrateTH: 1160 }
                            }
                        ]
                    })
                });
            }
            return Promise.resolve({ ok: false, json: async () => ({}) });
        });

        await act(async () => { render(<PriceListGenerator />); });
        fireEvent.click(screen.getByText('Fresh Data'));

        await waitFor(() => {
            // Expect 29000 (Market) > 19000 (Sim) because hashrate 1160 matches and "S23" matches
            // Note: The mocked PriceListTable displays price in a cell
            expect(screen.getByTestId('price-Sim S23 Mix 1160T')).toHaveTextContent('29000');
        });
    });
});
