
import { MinerRow } from '@/components/market/MinerDisplay';
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell
} from '@/components/ui/table';
import { Search, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { slugify } from '@/lib/slug-utils';

interface MarketMiner {
    id: string;
    name: string;
    specs: {
        hashrateTH: number;
        powerW: number;
        algo: string;
    };
    listings: MarketListing[];
    stats: {
        minPrice: number;
        maxPrice: number;
        avgPrice: number;
        middlePrice: number;
        vendorCount: number;
        lastUpdated: string;
    };
    source?: string;
}

interface MarketListing {
    vendor: string;
    price: number;
    currency: string;
    url?: string;
    stockStatus?: string;
}

interface MarketPriceTableProps {
    initialData: MarketMiner[];
    lastUpdated?: string;
    userRole?: string;
}

type SortField = 'name' | 'price' | 'hashrate' | 'vendors';
type SortOrder = 'asc' | 'desc';

import { syncMarketplaceAction } from '@/app/market-prices/actions';

export function MarketPriceTable({ initialData, lastUpdated, userRole }: MarketPriceTableProps) {
    const [data, setData] = useState<MarketMiner[]>(initialData);
    const [lastUpdatedTime, setLastUpdatedTime] = useState<string | undefined>(lastUpdated);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<SortField>('price');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [mounted, setMounted] = useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const handleRefresh = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/market/latest', { cache: 'no-store' });
            const json = await res.json();
            if (json.miners) {
                setData(json.miners);
            }
            if (json.updatedAt) {
                setLastUpdatedTime(json.updatedAt);
            }
        } catch (e) {
            console.error("Failed to refresh", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const result = await syncMarketplaceAction();
            if (!result.success) throw new Error(result.error);

            // Refresh data after sync
            await handleRefresh();
        } catch (e: any) {
            console.error("Failed to sync", e);
            alert(`Sync failed: ${e.message}`);
        } finally {
            setSyncing(false);
        }
    };

    const filteredData = data.filter(miner =>
        miner.name.toLowerCase().includes(search.toLowerCase())
    );

    const sortedData = [...filteredData].sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        switch (sortField) {
            case 'name':
                valA = a.name;
                valB = b.name;
                break;
            case 'price':
                valA = a.stats.middlePrice;
                valB = b.stats.middlePrice;
                break;
            case 'hashrate':
                valA = a.specs.hashrateTH;
                valB = b.specs.hashrateTH;
                break;
            case 'vendors':
                valA = a.stats.vendorCount;
                valB = b.stats.vendorCount;
                break;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const router = useRouter();

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
        return sortOrder === 'asc'
            ? <ArrowUp className="ml-2 h-4 w-4" />
            : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search miners..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs text-muted-foreground mr-2">
                        Last Updated: {mounted ? (lastUpdatedTime ? new Date(lastUpdatedTime).toLocaleString() : 'Never') : 'Loading...'}
                    </Badge>
                    <Button variant="secondary" size="sm" onClick={handleSync} disabled={syncing || loading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading || syncing}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="rounded-md border bg-card">
                {/* Mobile Card View */}
                <div className="md:hidden space-y-4 p-4">
                    {sortedData.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">No miners found.</div>
                    ) : (
                        sortedData.map((miner) => (
                            <Card key={miner.id} className="cursor-pointer" onClick={() => router.push(`/products/${slugify(miner.name)}`)}>
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-lg leading-tight text-primary">{miner.name}</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {miner.listings.length > 0 && miner.listings[0].stockStatus}
                                            </div>
                                        </div>
                                        <Badge variant="secondary">{miner.specs.hashrateTH} TH/s</Badge>
                                    </div>
                                    <div className="flex justify-between items-center border-t pt-3">
                                        <div>
                                            <span className="text-xs text-muted-foreground block">Middle Price</span>
                                            <span className="font-bold text-green-600 text-lg">${miner.stats.middlePrice.toLocaleString()}</span>
                                            {userRole === 'admin' && miner.source && miner.source.includes('Telegram') && (
                                                <Badge variant="secondary" className="ml-2 text-[10px] h-5 bg-sky-100 text-sky-800">
                                                    Telegram
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-muted-foreground block">Vendors</span>
                                            <Badge variant="outline">{miner.stats.vendorCount}</Badge>
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground text-center bg-muted/30 p-1 rounded">
                                        Range: ${miner.stats.minPrice.toLocaleString()} - ${miner.stats.maxPrice.toLocaleString()}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* Desktop Table */}
                <Table className="hidden md:table">
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[300px] cursor-pointer" onClick={() => handleSort('name')}>
                                <div className="flex items-center">Model <SortIcon field="name" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort('hashrate')}>
                                <div className="flex items-center">Hashrate <SortIcon field="hashrate" /></div>
                            </TableHead>
                            <TableHead>Power</TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort('price')}>
                                <div className="flex items-center">Est. Price <SortIcon field="price" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer text-right" onClick={() => handleSort('vendors')}>
                                <div className="flex items-center justify-end">Vendors <SortIcon field="vendors" /></div>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                    No miners found matching your search.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedData.map((miner) => (
                                <MinerRow
                                    key={miner.id || miner.name}
                                    miner={miner}
                                    userRole={userRole}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="text-xs text-muted-foreground text-center">
                For miners not yet listed, we estimate pricing based on similar models&apos; price-per-TH. &quot;Middle Price&quot; is the median of active listings.
            </div>
        </div>
    );
}
