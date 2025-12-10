"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Search } from "lucide-react";

export type SortField = 'price' | 'roi' | 'payback' | 'efficiency' | 'revenue' | 'score';

interface PriceListFilterBarProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    sortBy: SortField;
    setSortBy: (field: SortField) => void;
    sortOrder: 'asc' | 'desc';
    toggleSortOrder: () => void;
}

export function PriceListFilterBar({
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    sortOrder,
    toggleSortOrder
}: PriceListFilterBarProps) {
    return (
        <div className="flex gap-4 items-center bg-white p-4 rounded-lg border shadow-sm">
            <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search models..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Select value={sortBy} onValueChange={(v: SortField) => setSortBy(v)}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="score">Sort by Score</SelectItem>
                    <SelectItem value="roi">Sort by ROI</SelectItem>
                    <SelectItem value="price">Sort by Price</SelectItem>
                    <SelectItem value="payback">Sort by Payback</SelectItem>
                    <SelectItem value="revenue">Sort by Revenue</SelectItem>
                    <SelectItem value="efficiency">Sort by Efficiency</SelectItem>
                </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={toggleSortOrder}>
                <ArrowUpDown className={`h-4 w-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
            </Button>
        </div>
    );
}
