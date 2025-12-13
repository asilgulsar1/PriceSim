import '@testing-library/jest-dom';
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import ProductPageClient from './ProductPageClient';
import { useMarketData } from '@/hooks/useMarketData';
import { solveMinerPrice } from '@/lib/pricing-solver';
import { INITIAL_MINERS } from '@/lib/miner-data';
import { slugify } from '@/lib/slug-utils';

// Mock dependencies
jest.mock('@/hooks/useMarketData');
jest.mock('@/lib/pricing-solver');

// Mock Next.js & Lucide components
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ priority, ...props }: any) => <img {...props} alt={props.alt} />,
}));

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

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

// Setup stable mock market data
const mockMarketData = {
    market: {
        btcPrice: 70000,
        networkDifficulty: 90000000000000,
    },
    loading: false
};

describe('All Product Pages Verification', () => {
    beforeEach(() => {
        (useMarketData as jest.Mock).mockReturnValue({
            market: mockMarketData.market,
            loading: false,
            error: null
        });
        // We mock solveMinerPrice to return a realistic price based on hashrate to ensure strictness
        // Or simpler: just return a valid price > 0 so we confirm "not placeholder"
        (solveMinerPrice as jest.Mock).mockImplementation((miner: any) => ({
            calculatedPrice: miner.hashrateTH * 15 // $15/TH arbitrary logic for test
        }));
    });

    test.each(INITIAL_MINERS)('renders complete data for %s', (miner) => {
        // Setup dynamic price mock per miner
        const calculatedPrice = miner.hashrateTH * 20; // Example dynamic price
        (solveMinerPrice as jest.Mock).mockReturnValue({ calculatedPrice });

        const slug = slugify(miner.name);
        // Render
        render(<ProductPageClient miner={{ ...miner, slug }} />);

        // 1. Verify Name
        expect(screen.getByText(miner.name)).toBeInTheDocument();

        // 2. Verify Price is displayed and NOT $0
        // The component logic formats price with locale string
        const formattedPrice = `$${calculatedPrice.toLocaleString()}`;
        const priceElements = screen.getAllByText(formattedPrice);
        expect(priceElements.length).toBeGreaterThanOrEqual(1);

        // Verify it is NOT $0
        expect(screen.queryByText('$0')).not.toBeInTheDocument();

        // 3. Verify ID/Slug is displayed and NOT UNKNOWN
        // The component displays ID: SLUG in uppercase
        expect(screen.getByText(`ID: ${slug.toUpperCase()}`)).toBeInTheDocument();
        expect(screen.queryByText('ID: UNKNOWN')).not.toBeInTheDocument();

        // 4. Verify Image Source (check if the default or v2 image is used)
        const img = screen.getByAltText(`${miner.name} Bitcoin Miner`);
        expect(img).toHaveAttribute('src', '/asic-miner-v2.png');
    });
});
