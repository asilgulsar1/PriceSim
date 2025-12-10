"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Download, FileText, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PriceListControlsProps {
    clientName: string;
    setClientName: (name: string) => void;
    salesMargin: number;
    setSalesMargin: (val: number) => void;
    salesMarginType: 'usd' | 'percent';
    setSalesMarginType: (type: 'usd' | 'percent') => void;
    lastUpdated: string | null;
    loading: boolean;
    onRefresh: () => void;
    onExportCSV: () => void;
    onDownloadPDF: () => void;
}

export function PriceListControls({
    clientName,
    setClientName,
    salesMargin,
    setSalesMargin,
    salesMarginType,
    setSalesMarginType,
    lastUpdated,
    loading,
    onRefresh,
    onExportCSV,
    onDownloadPDF
}: PriceListControlsProps) {

    return (
        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
            <div className="flex justify-between items-start">
                <h2 className="text-lg font-semibold">Price List Configuration</h2>
                {lastUpdated && <span className="text-xs text-muted-foreground">Updated: {lastUpdated}</span>}
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-end">
                <div className="space-y-2 flex-1">
                    <Label>Client Name</Label>
                    <Input
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Enter Client Name"
                    />
                </div>

                <div className="space-y-2 w-full md:w-64">
                    <Label>Additional Sales Margin</Label>
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            value={salesMargin}
                            onChange={(e) => setSalesMargin(Number(e.target.value))}
                            placeholder="0"
                        />
                        <Select value={salesMarginType} onValueChange={(v: 'usd' | 'percent') => setSalesMarginType(v)}>
                            <SelectTrigger className="w-[100px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="usd">$ (USD)</SelectItem>
                                <SelectItem value="percent">% (Pct)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={onRefresh} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Fresh Data
                    </Button>
                    <Button variant="outline" onClick={onExportCSV}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    <Button onClick={onDownloadPDF}>
                        <FileText className="mr-2 h-4 w-4" />
                        Export PDF
                    </Button>
                </div>
            </div>
        </div>
    );
}
