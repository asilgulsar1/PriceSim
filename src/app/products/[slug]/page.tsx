
import { INITIAL_MINERS } from '@/lib/miner-data';
import { slugify } from '@/lib/slug-utils';
import { notFound } from 'next/navigation'; // Server component safe
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Metadata } from 'next';
import ProductPageClient from '@/components/ProductPageClient';

import { list } from '@vercel/blob';


interface ExtendedMinerProfile {
    name: string;
    hashrateTH: number;
    powerWatts: number;
    price: number;
    listings?: any[];
    stats?: any;
    slug?: string;
}

// Helper to find miner
async function getMiner(slug: string): Promise<ExtendedMinerProfile | null> {
    let result: ExtendedMinerProfile | null = null;

    // 1. Check Static List
    const staticMiner = INITIAL_MINERS.find(m => slugify(m.name) === slug);
    if (staticMiner) {
        result = { ...staticMiner, slug };
    }

    // 2. Fetch Market Data to enrich or fallback
    try {
        // Use implicit token from environment like the working API route
        const { blobs } = await list({ prefix: 'market-prices.json', limit: 1 });
        if (blobs.length > 0) {
            // Add cache busting query param
            const blobUrl = `${blobs[0].url}?t=${Date.now()}`;
            const res = await fetch(blobUrl, { cache: 'no-store' }); // Ensure fresh data

            if (res.ok) {
                const data = await res.json();
                const marketMiner = data.miners?.find((m: any) => slugify(m.name) === slug);

                if (marketMiner) {
                    // If we didn't have a static miner, use this one
                    if (!result) {
                        result = {
                            name: marketMiner.name,
                            hashrateTH: marketMiner.specs.hashrateTH,
                            powerWatts: marketMiner.specs.powerW,
                            price: marketMiner.stats.middlePrice,
                            slug, // Ensure slug is attached
                        };
                    }

                    // Attach market data (listings & stats) to the result
                    result.listings = marketMiner.listings;
                    result.stats = marketMiner.stats;
                }
            }
        }
    } catch (e) {
        console.error("Failed to fetch market miner fallback", e);
    }

    return result;
}

// SEO Metadata Generator
export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const params = await props.params;
    const miner = await getMiner(params.slug);

    if (!miner) {
        return {
            title: 'Miner Not Found',
            description: 'The requested mining hardware could not be found.'
        };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.asic.ae';
    const imageUrl = `${baseUrl}/asic-miner-large.png`;

    return {
        title: `Buy ${miner.name} | Best Price & Profitability Calculator`,
        description: `Get the best deal on ${miner.name} (${miner.hashrateTH} TH/s). Real-time profitability ROI: ${(miner.price ? '$' + miner.price : 'Get Quote')}. Verified stock ships from Dubai.`,
        keywords: [miner.name, 'buy asic miner', 'bitcoin mining hardware', 'crypto mining profitability', 'segments.ae', 'asic.ae'],
        alternates: {
            canonical: `${baseUrl}/products/${params.slug}`,
        },
        openGraph: {
            title: `${miner.name} - ${miner.hashrateTH} TH/s - Profitability Analysis`,
            description: `Efficiency: ${(miner.powerWatts / miner.hashrateTH).toFixed(1)} J/TH. Daily Revenue: Check real-time mining stats.`,
            images: [{ url: imageUrl, width: 800, height: 600, alt: miner.name }],
            type: 'website',
        }
    };
}

export default async function ProductPage(props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;
    const miner = await getMiner(params.slug);

    if (!miner) {
        return notFound();
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.asic.ae';

    // JSON-LD Structured Data for SEO
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: miner.name,
        image: `${baseUrl}/asic-miner-large.png`,
        description: `Verified ${miner.name} Bitcoin Miner. Hashrate: ${miner.hashrateTH} TH/s. Power: ${miner.powerWatts}W.`,
        brand: {
            '@type': 'Brand',
            name: miner.name.split(' ')[0] // e.g. "Antminer" or "Whatsminer"
        },
        offers: {
            '@type': 'Offer',
            url: `${baseUrl}/products/${params.slug}`,
            priceCurrency: 'USD',
            price: miner.price || '0',
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
        }
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ProductPageClient miner={miner as any} />
        </>
    );
}
