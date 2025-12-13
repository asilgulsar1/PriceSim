import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarketPriceTable } from './MarketPriceTable';

// Mock Next.js components
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
        <a href={href} data-testid="product-link">{children}</a>
    ),
}));

jest.mock('lucide-react', () => ({
    Search: () => <div>Search</div>,
    RefreshCw: () => <div>RefreshCw</div>,
    ArrowUpDown: () => <div>ArrowUpDown</div>,
    ArrowUp: () => <div>ArrowUp</div>,
    ArrowDown: () => <div>ArrowDown</div>,
    ExternalLink: () => <div>ExternalLink</div>,
}));

// Mock the server action
jest.mock('@/app/market-prices/actions', () => ({
    syncMarketplaceAction: jest.fn(() => Promise.resolve({ success: true })),
}));

const mockData = [
    {
        id: 'antminer-s21-xp',
        name: 'Antminer S21 XP',
        specs: {
            hashrateTH: 270,
            powerW: 3645,
            algo: 'SHA-256',
        },
        listings: [
            {
                vendor: 'Test Vendor',
                price: 5000,
                currency: 'USD',
                stockStatus: 'In Stock',
            },
        ],
        stats: {
            minPrice: 4800,
            maxPrice: 5200,
            avgPrice: 5000,
            middlePrice: 5000,
            vendorCount: 3,
            lastUpdated: new Date().toISOString(),
        },
    },
    {
        id: 'antminer-s21-pro',
        name: 'Antminer S21 Pro 245T',
        specs: {
            hashrateTH: 245,
            powerW: 3510,
            algo: 'SHA-256',
        },
        listings: [],
        stats: {
            minPrice: 4500,
            maxPrice: 4800,
            avgPrice: 4650,
            middlePrice: 4650,
            vendorCount: 2,
            lastUpdated: new Date().toISOString(),
        },
    },
];

describe('MarketPriceTable - Product Links', () => {
    beforeEach(() => {
        // Mock fetch for refresh functionality
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ miners: mockData }),
            } as Response)
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('renders product links for all miners', () => {
        render(<MarketPriceTable initialData={mockData} lastUpdated={new Date().toISOString()} />);

        // Check that both miner names are present as links (likely duplicated for mobile/desktop)
        const s21XpLinks = screen.getAllByText('Antminer S21 XP');
        const s21ProLinks = screen.getAllByText('Antminer S21 Pro 245T');

        expect(s21XpLinks.length).toBeGreaterThan(0);
        expect(s21ProLinks.length).toBeGreaterThan(0);
    });

    it('product links have correct href attributes', () => {
        render(<MarketPriceTable initialData={mockData} lastUpdated={new Date().toISOString()} />);

        const links = screen.getAllByTestId('product-link');

        // Default sort is by price ascending
        // S21 Pro has middlePrice 4650, S21 XP has middlePrice 5000
        // So S21 Pro should appear first (in both mobile and desktop lists likely)
        // We expect at LEAST 2 links, likely 4.
        expect(links.length).toBeGreaterThanOrEqual(2);

        // Check filtering for specific hrefs
        const proLinks = links.filter(l => l.getAttribute('href') === '/products/antminer-s21-pro-245t');
        const xpLinks = links.filter(l => l.getAttribute('href') === '/products/antminer-s21-xp');

        expect(proLinks.length).toBeGreaterThan(0);
        expect(xpLinks.length).toBeGreaterThan(0);
    });

    it('product links are clickable (not disabled)', () => {
        render(<MarketPriceTable initialData={mockData} lastUpdated={new Date().toISOString()} />);

        const links = screen.getAllByTestId('product-link');

        // Links should not have disabled attributes or pointer-events: none
        links.forEach(link => {
            expect(link).not.toHaveAttribute('disabled');
            expect(link).not.toHaveStyle({ pointerEvents: 'none' });
        });
    });

    it('can click on product links', () => {
        render(<MarketPriceTable initialData={mockData} lastUpdated={new Date().toISOString()} />);

        const firstLink = screen.getAllByTestId('product-link')[0];

        // Should be able to click without errors
        expect(() => {
            fireEvent.click(firstLink);
        }).not.toThrow();
    });

    it('displays correct number of vendors for each miner', () => {
        render(<MarketPriceTable initialData={mockData} lastUpdated={new Date().toISOString()} />);

        // Check vendor counts are displayed. Note: logic must account for duplicate "3" or "2" if they appear multiple times.
        // screen.getByText('3') throws if multiple.
        expect(screen.getAllByText('3').length).toBeGreaterThan(0); // S21 XP has 3 vendors
        expect(screen.getAllByText('2').length).toBeGreaterThan(0); // S21 Pro has 2 vendors
    });
});
