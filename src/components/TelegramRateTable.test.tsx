import React from 'react';
import { render, screen } from '@testing-library/react';
import { TelegramRateTable } from './TelegramRateTable';

// Mock the hook
jest.mock('@/hooks/useMarketData', () => ({
    useMarketData: () => ({
        market: {
            btcPrice: 95000,
            networkDifficulty: 100000000000000,
            blockReward: 3.125,
            difficultyGrowthMonthly: 0,
            btcPriceGrowthMonthly: 0
        }
    })
}));

// Mock the util imports if they have complex logic or use external files
jest.mock('@/lib/miner-data', () => ({
    INITIAL_MINERS: [
        { name: 'Antminer S21 Hydro', powerWatts: 5360 }
    ]
}));

describe('TelegramRateTable', () => {

    it('renders empty message when no data provided', () => {
        render(<TelegramRateTable telegramMiners={[]} />);
        expect(screen.getByText(/No recent Telegram data/i)).toBeInTheDocument();
    });

    it('renders empty message when data is invalid (object instead of array)', () => {
        // @ts-ignore - simulating runtime error
        render(<TelegramRateTable telegramMiners={{ miners: [] }} />);
        expect(screen.getByText(/No recent Telegram data/i)).toBeInTheDocument();
    });

    it('renders rows for valid data', () => {
        const mockData = [
            {
                name: 'Antminer S21 Hydro',
                hashrateTH: 335,
                price: 5000,
                specs: { powerW: 5360 },
                listings: [{ source: 'TestChannel' }]
            },
            // @ts-ignore - Invalid item to test robustness
            {
                hashrateTH: 100,
                price: 1000
            }
        ];

        render(<TelegramRateTable telegramMiners={mockData} />);

        // Expect Model Name
        expect(screen.getByText('Antminer S21 Hydro')).toBeInTheDocument();
        // Expect Source
        expect(screen.getByText('TestChannel')).toBeInTheDocument();
        // Expect Calculated Data (Revenue > 0)
        // Since we mocked market data, rev should be > 0.
        // We can check if "Daily Rev" cell exists and has $ value
        const dollarValues = screen.getAllByText(/\$\d+\.\d+/);
        expect(dollarValues.length).toBeGreaterThan(0);
    });

    it('handles normalization and matching (S21 Hyd)', () => {
        const mockData = [
            {
                name: 'S21 Hyd 335T', // Variant name
                hashrateTH: 335,
                price: 4500,
                listings: []
            }
        ];

        // Should match "Antminer S21 Hydro" from INITIAL_MINERS mock
        render(<TelegramRateTable telegramMiners={mockData} />);

        // Check if it renders
        expect(screen.getByText('S21 Hyd 335T')).toBeInTheDocument();
        // If it extracted power correctly from match (5360W), expense should be > 0.
    });
});
