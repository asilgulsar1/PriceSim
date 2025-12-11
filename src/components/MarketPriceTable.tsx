
'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
}

type SortField = 'name' | 'price' | 'hashrate' | 'vendors';
type SortOrder = 'asc' | 'desc';

import { syncMarketplaceAction } from '@/app/market-prices/actions';

export function MarketPriceTable({ initialData, lastUpdated }: MarketPriceTableProps) {
    const [data, setData] = useState<MarketMiner[]>(initialData);
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
                        Last Updated: {mounted ? (lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Never') : 'Loading...'}
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
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[300px] cursor-pointer" onClick={() => handleSort('name')}>
                                <div className="flex items-center">Model <SortIcon field="name" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort('hashrate')}>
                                <div className="flex items-center">Hashrate <SortIcon field="hashrate" /></div>
                            </TableHead>
                            <TableHead>Power</TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort('price')}>
                                <div className="flex items-center">Middle Price <SortIcon field="price" /></div>
                            </TableHead>
                            <TableHead>Price Range</TableHead>
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
                                <TableRow key={miner.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{miner.name}</span>
                                            <span className="text-xs text-muted-foreground">{miner.listings.length > 0 && miner.listings[0].stockStatus}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{miner.specs.hashrateTH} TH/s</Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{miner.specs.powerW} W</TableCell>
                                    <TableCell>
                                        <div className="font-bold text-green-500 text-lg">
                                            ${miner.stats.middlePrice.toLocaleString()}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        ${miner.stats.minPrice.toLocaleString()} - ${miner.stats.maxPrice.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="outline">{miner.stats.vendorCount}</Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="text-xs text-muted-foreground text-center">
                Data sourced from AsicMinerValue Marketplace. "Middle Price" ignores outliers.
            </div>
        </div>
    );
}
