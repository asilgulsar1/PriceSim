import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { INITIAL_MINERS } from '@/lib/miner-data';
import { slugify } from '@/lib/slug-utils';
import { ProductPricing } from '@/components/ProductPricing';
import Link from 'next/link';
import { ArrowLeft, Zap, Box, Activity } from 'lucide-react';

interface ComponentProps {
    params: Promise<{
        slug: string;
    }>;
}

export async function generateStaticParams() {
    return INITIAL_MINERS.map((miner) => ({
        slug: slugify(miner.name),
    }));
}

export async function generateMetadata({ params }: ComponentProps): Promise<Metadata> {
    const { slug } = await params;
    const miner = INITIAL_MINERS.find((m) => slugify(m.name) === slug);

    if (!miner) {
        return {
            title: 'Product Not Found',
        };
    }

    return {
        title: `${miner.name} - Specs & Pricing`,
        description: `Buy ${miner.name} (${miner.hashrateTH} TH/s, ${miner.powerWatts}W). View live pricing and profitability analysis.`,
        keywords: [miner.name, 'ASIC Miner', 'Bitcoin Mining', 'Crypto Mining Hardware'],
    };
}

export default async function ProductPage({ params }: ComponentProps) {
    const { slug } = await params;
    const miner = INITIAL_MINERS.find((m) => slugify(m.name) === slug);

    if (!miner) {
        notFound();
    }

    const efficiency = (miner.powerWatts / miner.hashrateTH).toFixed(1);

    return (
        <div className="container mx-auto py-12 px-4 max-w-4xl">
            <Link href="/price-list" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 transition-colors">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Price List
            </Link>

            <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-6">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight mb-2">{miner.name}</h1>
                        <p className="text-xl text-muted-foreground">High-performance Bitcoin ASIC Miner</p>
                    </div>

                    <div className="bg-muted/30 p-6 rounded-2xl border border-border">
                        <ProductPricing miner={miner} />
                    </div>

                    <div className="prose dark:prose-invert">
                        <h3>Product Highlights</h3>
                        <ul>
                            <li>Industry leading efficiency at {efficiency} J/TH</li>
                            <li>Optimized for long-term mining operations</li>
                            <li>Full warranty support included</li>
                        </ul>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <SpecCard
                            icon={<Zap className="h-5 w-5 text-yellow-500" />}
                            label="Hashrate"
                            value={`${miner.hashrateTH} TH/s`}
                        />
                        <SpecCard
                            icon={<Box className="h-5 w-5 text-blue-500" />}
                            label="Power Consumption"
                            value={`${miner.powerWatts} W`}
                        />
                        <SpecCard
                            icon={<Activity className="h-5 w-5 text-green-500" />}
                            label="Efficiency"
                            value={`${efficiency} J/TH`}
                        />
                        <SpecCard
                            icon={<Box className="h-5 w-5 text-purple-500" />}
                            label="Algorithm"
                            value="SHA-256"
                        />
                    </div>

                    <div className="bg-card text-card-foreground p-6 rounded-xl border shadow-sm mt-8">
                        <h3 className="font-semibold mb-4">Technical Specifications</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-muted-foreground">Model</span>
                                <span className="font-medium">{miner.name}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-muted-foreground">Hashrate</span>
                                <span className="font-medium">{miner.hashrateTH} TH/s</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-muted-foreground">Power on Wall</span>
                                <span className="font-medium">{miner.powerWatts} Watts</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-muted-foreground">Efficiency</span>
                                <span className="font-medium">{efficiency} J/TH</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SpecCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className="bg-card hover:bg-muted/50 transition-colors p-4 rounded-xl border flex flex-col items-start gap-2">
            <div className="p-2 bg-muted rounded-lg mb-1">{icon}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</div>
            <div className="text-lg font-bold">{value}</div>
        </div>
    );
}
