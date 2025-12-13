import React from 'react';
/* eslint-disable @typescript-eslint/no-explicit-any */
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
jest.mock('./price-list/PriceListPdfTemplate', () => ({
    PriceListPdfTemplate: ({ userRole, branding }: any) => (
        <div data-testid="pdf-template" data-role={userRole} data-branding={JSON.stringify(branding)}>PDF</div>
    )
}));
jest.mock('next-auth/react', () => ({
    useSession: jest.fn(() => ({ data: { user: { role: 'client' } }, status: 'authenticated' })),
}));

// Mock image-utils to avoid fetch/blob issues in JSDOM
jest.mock('@/lib/image-utils', () => ({
    urlToBase64: jest.fn().mockResolvedValue('data:image/png;base64,mocked'),
}));

jest.mock('html-to-image', () => ({}));
jest.mock('jspdf', () => ({}));
jest.mock('@/hooks/useMarketData', () => ({
    useMarketData: jest.fn(() => ({
        market: { btcPrice: 100000, networkDifficulty: 100 },
        setMarket: jest.fn()
    }))
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
        fireEvent.click(screen.getByText('Refresh'));

        await waitFor(() => {
            expect(screen.getByText('Simulator Miner')).toBeInTheDocument();
            // Verify it didn't crash
        });

        // Verify Logic: Max(3500, 3200) = 3500. Margin applies to 3500.
    });

    it('applies reseller markup when userRole is reseller', async () => {
        (global.fetch as any) = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: async () => ({
                    updatedAt: new Date().toISOString(),
                    miners: [
                        {
                            miner: { // Nested
                                name: 'S19 XP',
                                hashrateTH: 140,
                                powerWatts: 3010,
                                calculatedPrice: 3500, // Base price from API
                                dailyRevenueUSD: 12,
                                dailyExpenseUSD: 6,
                                projectLifeDays: 365,
                                projections: []
                            },
                            score: 95
                        }
                    ]
                }),
                status: 200
            })
        );

        // Mock props
        const props = {
            userRole: 'reseller',
            resellerMargin: 500
        };

        await act(async () => {
            render(<PriceListGenerator {...props} />);
        });
        fireEvent.click(screen.getByText('Refresh'));


        // S19 XP: Sim Calculated = 3500. Market = 0 (mocked empty above or defaults?)
        // wait, fetch is mocked to return marketPrices map.
        // We need to ensure fetch returns something or matching logic works.

        // Sim Miner S19 XP is $3500 base. 
        // Reseller Margin: +500.
        // Expected Base Price: $4000.

        // Check for displayed price. 
        // Note: Default margin is 0% / 0 USD in UI. 
        // Just checking the table for "$4,000".

        await waitFor(() => {
            expect(screen.getByTestId('price-S19 XP')).toHaveTextContent('4000');
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
        fireEvent.click(screen.getByText('Refresh'));

        await waitFor(() => {
            expect(screen.getByText('API Miner')).toBeInTheDocument();
        }, { timeout: 2000 });
    });

    it('falls back to local calculation only if both fail', async () => {
        // Empty storage, Failed fetch
        await act(async () => { render(<PriceListGenerator />); });
        fireEvent.click(screen.getByText('Refresh'));

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
        fireEvent.click(screen.getByText('Refresh'));

        await waitFor(() => {
            // Expect 29000 (Market) > 19000 (Sim) because hashrate 1160 matches and "S23" matches
            // Note: The mocked PriceListTable displays price in a cell
            expect(screen.getByTestId('price-Sim S23 Mix 1160T')).toHaveTextContent('29000');
        });
    });

    it('propagates branding and userRole to PDF Template', async () => {
        const branding = {
            companyName: 'My Crypto',
            logoUrl: 'https://example.com/logo.png',
            footerText: 'Contact Us'
        };
        const props = {
            userRole: 'reseller',
            resellerMargin: 500,
            branding
        };

        await act(async () => {
            render(<PriceListGenerator {...props} />);
        });

        const pdf = screen.getByTestId('pdf-template');
        expect(pdf).toHaveAttribute('data-role', 'reseller');
        expect(pdf).toHaveAttribute('data-branding', JSON.stringify(branding));
    });
});
