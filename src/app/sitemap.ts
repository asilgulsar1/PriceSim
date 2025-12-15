import { MetadataRoute } from 'next';
import { INITIAL_MINERS } from '@/lib/miner-data';
import { slugify } from '@/lib/slug-utils';

// We could also fetch dynamic miners here if we want to be exhaustive
// but INITIAL_MINERS is a good baseline + we can try to fetch from market blob if needed.
// For static generation, fetching from blob might fail during build if not available.
// Let's stick to safe INITIAL_MINERS for now and add a dynamic fetch try-catch.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.asic.ae';

    // 1. Static Routes
    const routes = [
        '',
        '/market-prices',
        '/price-list', // It's somewhat restricted (Login required?) Middleware says NO prompt for sales, but allows public if logged in?
        // Actually middleware redirects to /price-list for Sales/Resellers.
        // Public access? "nextUrl.pathname.startsWith('/price-list')" is NOT in public routes list in Middleware.
        // Middleware line 12: isPublicRoute = ...
        // It does NOT include /price-list.
        // So /price-list is Login Protected? 
        // Checking middleware again... 
        // `nextUrl.pathname.startsWith('/api/price-list')` is public.
        // `/price-list` page is NOT in `isPublicRoute`. 
        // So it redirects to login.
        // Robots should NOT index /price-list then if it redirects to login?
        // "Sales staff can only view the Price List" implies it's internal.
        // Let's EXCLUDE /price-list from sitemap if it requires login.
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: route === '' ? 1 : 0.8,
    }));

    // 2. Product Pages (Public)
    // Core miners from static data
    const miners = [...INITIAL_MINERS];

    // Try to fetch dynamic miners from the blob storage (same as simulator)
    // The exact URL or method to fetch blob server-side here might be tricky without full request context,
    // but we can try the public API endpoint or duplicate logic.
    // simpler: just link the ones we know.
    // If we want dynamic, we can try to import the scraper service or just use the API URL if build allows.
    // During `next build`, fetch to localhost executes? Maybe not.
    // Let's strictly use INITIAL_MINERS to ensure build stability for now.

    // De-dupe by name just in case
    const uniqueMiners = new Map();
    miners.forEach(m => uniqueMiners.set(slugify(m.name), m));

    const productRoutes = Array.from(uniqueMiners.values()).map((miner) => ({
        url: `${baseUrl}/products/${slugify(miner.name)}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
    }));

    return [...routes, ...productRoutes];
}
