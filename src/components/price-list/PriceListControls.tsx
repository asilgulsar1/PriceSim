"use client";

import React from "react";
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
    pdfStyle: string;
    setPdfStyle: (style: string) => void;
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
    onDownloadPDF,
    pdfStyle,
    setPdfStyle,
    userRole,
    branding,
    // setBranding unused
}: PriceListControlsProps & {
    userRole?: string;
    branding?: { companyName: string; logoUrl: string; footerText: string };
    setBranding?: (val: { companyName: string; logoUrl: string; footerText: string }) => void;
}) {

    return (
        <div className="bg-white p-4 md:p-6 rounded-lg border shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                <h2 className="text-lg font-semibold">Price List Configuration</h2>
                {lastUpdated && <span className="text-xs text-muted-foreground whitespace-nowrap">Updated: {lastUpdated}</span>}
            </div>

            {/* Branding Section (Resellers Only) */}
            {/* Branding Section (Resellers Only) */}
            {userRole === 'reseller' && (
                <div className="bg-orange-50 border border-orange-200 rounded p-4 mb-4 flex justify-between items-center">
                    <div>
                        <h3 className="text-sm font-bold text-orange-900">Reseller Branding</h3>
                        {branding && branding.companyName ? (
                            <p className="text-xs text-orange-700 mt-1">Configured as: <span className="font-semibold">{branding.companyName}</span></p>
                        ) : (
                            <p className="text-xs text-orange-700 mt-1">Customize your logo and company details.</p>
                        )}
                    </div>
                    <Button variant="outline" size="sm" className="bg-white border-orange-200 hover:bg-orange-100 text-orange-900" asChild>
                        <a href="/profile">Edit Profile</a>
                    </Button>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-6 w-full md:items-end">
                <div className="space-y-2 flex-1">
                    <Label>Client Name</Label>
                    <Input
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Enter Client Name"
                    />
                </div>
                {/* ... rest of existing controls */}
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

            </div>

            <div className="flex gap-2">
                <div className="space-y-2 w-[180px]">
                    <Label>PDF Style</Label>
                    <Select value={pdfStyle} onValueChange={setPdfStyle}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="default">Default</SelectItem>
                            <SelectItem value="high-conversion">High-Conversion</SelectItem>
                            <SelectItem value="banker">The Banker</SelectItem>
                            <SelectItem value="engineer">The Engineer</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="hidden md:flex gap-2 items-end">
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
