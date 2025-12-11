
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MarketPriceTable } from './MarketPriceTable';
import { syncMarketplaceAction } from '@/app/market-prices/actions';

// Mock Lucide icons
jest.mock('lucide-react', () => ({
    Search: () => <div data-testid="search-icon" />,
    RefreshCw: () => <div data-testid="refresh-icon" />,
    ArrowUpDown: () => <div data-testid="sort-icon" />,
    ArrowUp: () => <div data-testid="arrow-up" />,
    ArrowDown: () => <div data-testid="arrow-down" />,
    ExternalLink: () => <div data-testid="link-icon" />
}));

// Mock Server Actions
jest.mock('@/app/market-prices/actions', () => ({
    syncMarketplaceAction: jest.fn().mockResolvedValue({ success: true })
}));

const mockData = [
    {
        id: 'miner-a',
        name: 'Antminer A (100Th)',
        specs: { hashrateTH: 100, powerW: 3000, algo: 'SHA-256' },
        listings: [],
        stats: { minPrice: 1000, maxPrice: 1200, avgPrice: 1100, middlePrice: 1100, vendorCount: 5, lastUpdated: '2025-01-01T12:00:00Z' }
    },
    {
        id: 'miner-b',
        name: 'Antminer B (200Th)',
        specs: { hashrateTH: 200, powerW: 3500, algo: 'SHA-256' },
        listings: [],
        stats: { minPrice: 2000, maxPrice: 2500, avgPrice: 2250, middlePrice: 2200, vendorCount: 3, lastUpdated: '2025-01-01T12:00:00Z' }
    }
];

// Mock Fetch
global.fetch = jest.fn();

describe('MarketPriceTable', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders initial data correctly', async () => {
        await act(async () => {
            render(<MarketPriceTable initialData={mockData} />);
        });

        expect(screen.getByText('Antminer A (100Th)')).toBeInTheDocument();
        expect(screen.getByText('Antminer B (200Th)')).toBeInTheDocument();
        // Check formatted prices
        expect(screen.getByText('$1,100')).toBeInTheDocument();
        expect(screen.getByText('$2,200')).toBeInTheDocument();
    });

    test('sorts by price', async () => {
        await act(async () => {
            render(<MarketPriceTable initialData={mockData} />);
        });

        // Initial order: A ($1100), B ($2200). Default sort logic might vary, let's assume default or we click header.

        // Initial State is Price ASC (A first)

        // Click Middle Price header -> Toggles to DESC (B first)
        const priceHeader = screen.getByText('Middle Price');
        fireEvent.click(priceHeader);

        // Should sort DESC (2200 first)
        const rowsDesc = screen.getAllByRole('row');
        expect(rowsDesc[1]).toHaveTextContent('Antminer B');

        // Click again -> Toggles to ASC (A first)
        fireEvent.click(priceHeader);
        const rowsAsc = screen.getAllByRole('row');
        expect(rowsAsc[1]).toHaveTextContent('Antminer A');
    });

    // Test Search
    test('filters by name', async () => {
        await act(async () => {
            render(<MarketPriceTable initialData={mockData} />);
        });

        const searchInput = screen.getByPlaceholderText('Search miners...');
        fireEvent.change(searchInput, { target: { value: 'Antminer B' } });

        expect(screen.queryByText('Antminer A (100Th)')).not.toBeInTheDocument();
        expect(screen.getByText('Antminer B (200Th)')).toBeInTheDocument();
    });

    test('handles Sync Now click', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'ok' })
        });
        // Second fetch for refresh
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ miners: mockData })
        });

        await act(async () => {
            render(<MarketPriceTable initialData={mockData} />);
        });

        const syncBtn = screen.getByText('Sync Now');
        fireEvent.click(syncBtn);

        expect(screen.getByText('Syncing...')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('Sync Now')).toBeInTheDocument();
        });

        expect(syncMarketplaceAction).toHaveBeenCalled();
    });

    test('requests fresh data (no-cache) on sync/refresh', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ status: 'ok', miners: [] })
        });

        await act(async () => {
            render(<MarketPriceTable initialData={mockData} />);
        });

        // Click Refresh
        const refreshBtn = screen.getByText('Refresh');
        fireEvent.click(refreshBtn);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/market/latest', expect.objectContaining({
                cache: 'no-store'
            }));
        });
    });
});
