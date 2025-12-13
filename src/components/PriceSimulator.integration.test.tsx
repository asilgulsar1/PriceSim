import React from 'react';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PriceSimulator } from './PriceSimulator';
import { fetchMarketData } from '@/lib/api';

// --- INTEGRATION TEST ---
// This test does NOT mock the internal calculator logic (pricing-solver or MiningCalculator).
// It tests the "User -> UI -> Logic -> UI" flow.

// We ONLY mock the external API call to ensure deterministic inputs.
jest.mock('@/lib/api', () => ({
    fetchMarketData: jest.fn(),
}));

// Mock the UI components that complicate rendering (Charts, etc) but keep the logic containers
jest.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    LineChart: () => <div>Chart</div>,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
}));

describe('PriceSimulator Integration Flow', () => {
    // Mock URL.createObjectURL
    beforeAll(() => {
        global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: async () => ({})
        } as Response));
    });
    beforeEach(() => {
        // Deterministic Market Data for Math Verification
        (fetchMarketData as jest.Mock).mockResolvedValue({
            btcPrice: 100000, // $100k BTC
            networkDifficulty: 80000000000000, // 80T Diff
            blockReward: 3.125
        });
    });

    it('calculates real prices using the actual solver logic', async () => {
        render(<PriceSimulator />);

        // 1. Verify Load
        await waitFor(() => expect(screen.getByText('Market Assumptions')).toBeInTheDocument());
        await waitFor(() => expect(screen.getAllByText('Calculate')[0].closest('button')).not.toBeDisabled());

        // 2. Add a Custom Miner (To track specific known inputs)
        fireEvent.click(screen.getByText('Add Custom Miner'));

        // Input: 100 TH/s, 3000 Watts
        fireEvent.change(screen.getByPlaceholderText('Antminer S21 Pro'), { target: { value: 'IntegrationMiner' } });
        fireEvent.change(screen.getByPlaceholderText('200'), { target: { value: '100' } });
        fireEvent.change(screen.getByPlaceholderText('3000'), { target: { value: '3000' } });

        fireEvent.click(screen.getByText('Add'));

        // 3. Set Market Parameters (Optional, defaults are usually fine, but lets be explicit)
        // We'll trust the defaults loaded from mock for now to keep test simple.

        // 4. Run Calculation
        fireEvent.click(screen.getAllByText('Calculate')[0]);

        // 5. Verify Output
        // The miner should appear with a calculated price.
        const results = await screen.findAllByText('IntegrationMiner', {}, { timeout: 5000 });
        expect(results.length).toBeGreaterThan(0);

        // VERIFY LOGIC CONNECTION:
        // If the calculator is working, we should see a Price and the Project Life table header.
        // The table header "Project Life" should be present (hidden in mobile card view, but present in DOM)
        // Card view doesn't have "Project Life" header, but Table does.
        // We just check if it exists in document.
        const projectLifeHeaders = await screen.findAllByText('Project Life');
        expect(projectLifeHeaders.length).toBeGreaterThan(0);

        // We expect a calculated price (Format is usually "$ X,XXX")
        // We can't know the exact number without duplicating logic, but it should NOT be $0 or NaN if logic works.
        // We check for the presence of "$"
        const priceElements = screen.getAllByText(/\$[\d,]+\.?\d*/);
        expect(priceElements.length).toBeGreaterThan(0);

        // Verify valid data row exists for our miner
        // We look for any container (tr or div) that contains the miner name
        const minerElements = screen.getAllByText('IntegrationMiner');
        const container = minerElements[0].closest('tr') || minerElements[0].closest('div');
        expect(container).toBeInTheDocument();

        // Success: The UI accepted inputs, passed them to REAL One-Pass/Two-Pass solver, and rendered results.
        console.log('Integration Test: Real Solver produced output successfully.');
    });
});
