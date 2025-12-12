import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ProductPageClient from './ProductPageClient';
import { useMarketData } from '@/hooks/useMarketData';
import { solveMinerPrice } from '@/lib/pricing-solver';

// Mock dependencies
jest.mock('@/hooks/useMarketData');
jest.mock('@/lib/pricing-solver');

// Mock Next.js components
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ priority, ...props }: any) => <img {...props} alt={props.alt} />,
}));

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

// Mock Lucide icons to avoid rendering issues if any
jest.mock('lucide-react', () => ({
    Loader2: () => <div data-testid="loader">Loading</div>,
    Zap: () => <span>Zap</span>,
    TrendingUp: () => <span>TrendingUp</span>,
    ShieldCheck: () => <span>ShieldCheck</span>,
    Globe: () => <span>Globe</span>,
    Check: () => <span>Check</span>,
    Search: () => <span>Search</span>,
    ArrowRight: () => <span>ArrowRight</span>,
    Lock: () => <span>Lock</span>,
    Server: () => <span>Server</span>,
    Info: () => <span>Info</span>,
    X: () => <span>X</span>,
    ExternalLink: () => <span>ExternalLink</span>,
}));

jest.mock('@/components/StickyActionFooter', () => ({
    StickyActionFooter: () => <div data-testid="sticky-footer">Sticky Footer</div>
}));

const mockMiner = {
    name: "Antminer S21",
    hashrateTH: 200,
    powerWatts: 3500,
    price: 4500,
    slug: 'antminer-s21'
};

const mockMarketData = {
    market: {
        btcPrice: 65000,
        networkDifficulty: 80000000000000,
    },
    loading: false
};

describe('ProductPageClient', () => {
    beforeEach(() => {
        (useMarketData as jest.Mock).mockReturnValue(mockMarketData);
        (solveMinerPrice as jest.Mock).mockReturnValue({ calculatedPrice: 5000 });
    });

    it('renders the product name and known static elements', () => {
        render(<ProductPageClient miner={mockMiner} />);

        // Assert: Title
        expect(screen.getByText('Antminer S21')).toBeInTheDocument();

        // Assert: Static Labels
        expect(screen.getByText('Source of Truth v2.0')).toBeInTheDocument();
        expect(screen.getByText('Global Source Matrix')).toBeInTheDocument();
        expect(screen.getByText('Revenue Engine')).toBeInTheDocument();

        // Assert: Price (Mocked via solveMinerPrice returning 5000)
        // Price appears in the Hero section and the Global Source Matrix table
        const priceElements = screen.getAllByText('$5,000');
        expect(priceElements.length).toBeGreaterThanOrEqual(1);
    });

    it('renders loader when market data is loading', () => {
        (useMarketData as jest.Mock).mockReturnValue({ market: null, loading: true });
        render(<ProductPageClient miner={mockMiner} />);

        expect(screen.getByText('Initializing Market Terminal...')).toBeInTheDocument();
    });

    it('handles missing miner slug gracefully', () => {
        const minerWithoutSlug = { ...mockMiner, slug: undefined };
        render(<ProductPageClient miner={minerWithoutSlug} />);
        expect(screen.getByText('ID: UNKNOWN')).toBeInTheDocument();
    });
});
