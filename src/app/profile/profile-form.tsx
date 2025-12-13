/* eslint-disable */
"use client";

import { useTransition, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { BrandingConfig, AiUsage } from "@/lib/user-store";
import { generateAiContent } from "@/app/actions";
import { Loader2, Wand2, Save, Download, Upload, LayoutTemplate, Palette, Type, CheckCircle2 } from "lucide-react";
import { updateBrandingAction } from "./actions";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

// PDF & Data Logic
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { PriceListPdfTemplate } from "@/components/price-list/PriceListPdfTemplate";
import { MinerScoreDetail, rankMiners } from "@/lib/miner-scoring";
import { useMarketData } from "@/hooks/useMarketData";
import { INITIAL_MINERS } from "@/lib/miner-data";
import { solveMinerPrice } from "@/lib/pricing-solver";
import { DEFAULT_CONTRACT_TERMS, DEFAULT_TARGET_MARGIN } from "@/lib/constants";

interface ProfileFormProps {
    branding: BrandingConfig;
    aiUsage: AiUsage;
    savedTemplates?: any[]; // Keep for prop compatibility but unused
    successMessage?: string;
}

export function ProfileForm({ branding: initialBranding, aiUsage, successMessage }: ProfileFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isCompiling, setIsCompiling] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    // --- STATE ---
    // Identity
    const [companyName, setCompanyName] = useState(initialBranding.companyName || "");
    const [footerText, setFooterText] = useState(initialBranding.footerText || "");
    const [logoUrl, setLogoUrl] = useState(initialBranding.logoUrl || "");

    // Colors
    const [colorPrimary, setColorPrimary] = useState(initialBranding.colors?.primary || "#0f172a");
    const [colorSecondary, setColorSecondary] = useState(initialBranding.colors?.secondary || "#334155");
    const [colorAccent, setColorAccent] = useState(initialBranding.colors?.accent || "#0ea5e9");

    // Content
    const [mainHeading, setMainHeading] = useState(initialBranding.customHeadings?.mainHeading || "Strategic Hardware Acquisition");
    const [subHeading, setSubHeading] = useState(initialBranding.customHeadings?.subHeading || "Prepared For");
    const [contentText, setContentText] = useState(initialBranding.customHeadings?.contentText || "");
    const [aiTone, setAiTone] = useState<'professional' | 'persuasive' | 'technical'>('professional');

    // --- DATA CALCULATION (For Preview) ---
    const { market, loading: marketLoading } = useMarketData();
    const [calculatedMiners, setCalculatedMiners] = useState<MinerScoreDetail[]>([]);
    const [recommendations, setRecommendations] = useState<any>({ topROI: [], topRevenue: [], topEfficiency: [] });

    useEffect(() => {
        if (!market.btcPrice) return;
        const solved = INITIAL_MINERS.map(m => solveMinerPrice(m, DEFAULT_CONTRACT_TERMS, market, DEFAULT_TARGET_MARGIN, false));
        const ranked = rankMiners(solved);
        setCalculatedMiners(ranked);
        setRecommendations({
            topROI: [ranked.sort((a, b) => b.metrics.profitabilityScore - a.metrics.profitabilityScore)[0]],
            topRevenue: [ranked.sort((a, b) => b.metrics.revenueScore - a.metrics.revenueScore)[0]],
            topEfficiency: [ranked.sort((a, b) => b.metrics.efficiencyScore - a.metrics.efficiencyScore)[0]]
        });
    }, [market]);

    // --- HANDLERS ---

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 4 * 1024 * 1024) {
                alert("File too large. Maximum size is 4MB.");
                e.target.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => setLogoUrl(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        // Previous mock save logic removed
    };

    // Improved Save Handler to include File
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleGlobalSave = (e: React.FormEvent) => {
        e.preventDefault();

        // Safety Check
        const file = fileInputRef.current?.files?.[0];
        if (file && file.size > 4 * 1024 * 1024) {
            alert("Logo file is too large (Max 4MB). Please use a smaller image.");
            return;
        }

        // EXPLICIT FORM DATA CONSTRUCTION
        // Ensures state is exactly what is sent, bypassing potentially buggy DOM extraction
        const formData = new FormData();
        formData.append('companyName', companyName);
        formData.append('footerText', footerText);
        formData.append('color_primary', colorPrimary);
        formData.append('color_secondary', colorSecondary);
        formData.append('color_accent', colorAccent);
        formData.append('mainHeading', mainHeading);
        formData.append('subHeading', subHeading);
        formData.append('contentText', contentText);

        if (file) {
            formData.append('logoFile', file);
        }

        startTransition(async () => {
            const res = await updateBrandingAction(formData);
            if (res.success) {
                router.refresh(); // Sync server state to trigger re-render
            } else {
                alert(res.error || "Save Failed");
            }
        });
    };

    const handleAiGenerate = async () => {
        setAiLoading(true);
        try {
            const context = {
                topMiners: calculatedMiners.slice(0, 3).map(m => m.miner.name),
                totalRevenue: calculatedMiners[0]?.miner.dailyRevenueUSD || 0,
                maxRoi: calculatedMiners[0]?.metrics.profitabilityScore * 10,
                btcPrice: market.btcPrice ? `$${market.btcPrice.toLocaleString()}` : "Unknown",
                companyName: companyName || "Our Agency"
            };
            const res = await generateAiContent(aiTone, contentText, context);
            if (res.success && res.content) setContentText(res.content);
        } catch (e) {
            console.error(e);
        } finally {
            setAiLoading(false);
        }
    };

    // PDF ENGINE
    const printRef = useRef<HTMLDivElement>(null);
    const handleCompile = async () => {
        if (!printRef.current) return;
        setIsCompiling(true);
        await new Promise(r => setTimeout(r, 500)); // UX Delay
        try {
            const element = printRef.current;
            const imgData = await toPng(element, {
                backgroundColor: '#ffffff',
                pixelRatio: 4,
                width: 794,
            });
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
            pdf.save(`DEAL_SHEET_${companyName.replace(/\s+/g, '_')}.pdf`);
        } catch (e) {
            console.error(e);
            alert("PDF Generation Failed");
        } finally {
            setIsCompiling(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans text-slate-900">
            <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* --- LEFT: CONFIGURATION (4 Cols) --- */}
                <div className="lg:col-span-4 space-y-6">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reseller Profile</h1>
                            <p className="text-sm text-slate-500">Configure your deal sheet branding.</p>
                        </div>
                        {successMessage && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 flex gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Saved
                            </Badge>
                        )}
                    </div>

                    <form onSubmit={handleGlobalSave} className="space-y-6">
                        {/* 1. Identity */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                    <LayoutTemplate className="w-4 h-4" /> Identity
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Company Name</Label>
                                    <Input name="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your Brand Name" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Footer / Contact</Label>
                                    <Input name="footerText" value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="Contact Info" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Logo</Label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                                            {logoUrl ? <img src={logoUrl} className="w-full h-full object-contain" alt="Logo" /> : <Upload className="w-4 h-4 text-slate-400" />}
                                        </div>
                                        <div className="flex-1">
                                            <Input
                                                ref={fileInputRef}
                                                type="file"
                                                name="logoFile"
                                                accept="image/*"
                                                onChange={handleLogoUpload}
                                                className="text-xs"
                                            />
                                        </div>
                                    </div>
                                    {/* Hidden input to pass existing URL if no new file */}
                                    {/* Actually, server action handles this check usually. If no file, it keeps old. */}
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. Theme */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                    <Palette className="w-4 h-4" /> Theme
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Primary</Label>
                                        <div className="flex gap-2">
                                            <div className="w-6 h-6 rounded border shadow-sm shrink-0" style={{ background: colorPrimary }} />
                                            <Input type="color" name="color_primary" value={colorPrimary} onChange={e => setColorPrimary(e.target.value)} className="w-full h-8 p-1" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Secondary</Label>
                                        <div className="flex gap-2">
                                            <div className="w-6 h-6 rounded border shadow-sm shrink-0" style={{ background: colorSecondary }} />
                                            <Input type="color" name="color_secondary" value={colorSecondary} onChange={e => setColorSecondary(e.target.value)} className="w-full h-8 p-1" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Accent</Label>
                                        <div className="flex gap-2">
                                            <div className="w-6 h-6 rounded border shadow-sm shrink-0" style={{ background: colorAccent }} />
                                            <Input type="color" name="color_accent" value={colorAccent} onChange={e => setColorAccent(e.target.value)} className="w-full h-8 p-1" />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 3. Content */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                    <Type className="w-4 h-4" /> Content
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Main Heading</Label>
                                    <Input name="mainHeading" value={mainHeading} onChange={e => setMainHeading(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Subtitle</Label>
                                    <Input name="subHeading" value={subHeading} onChange={e => setSubHeading(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label>Executive Summary</Label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs text-blue-600 hover:text-blue-700"
                                            onClick={handleAiGenerate}
                                            disabled={aiLoading}
                                        >
                                            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wand2 className="w-3 h-3 mr-1" />}
                                            AI Generate
                                        </Button>
                                    </div>
                                    <Textarea
                                        name="contentText"
                                        value={contentText}
                                        onChange={e => setContentText(e.target.value)}
                                        className="min-h-[120px]"
                                    />
                                    <div className="flex justify-end">
                                        <select
                                            className="text-xs border rounded px-2 py-1 bg-white"
                                            value={aiTone}
                                            onChange={e => setAiTone(e.target.value as any)}
                                        >
                                            <option value="professional">Professional Tone</option>
                                            <option value="persuasive">Persuasive Tone</option>
                                            <option value="technical">Technical Tone</option>
                                        </select>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-4 border-t bg-slate-50/50">
                                <Button type="submit" disabled={isPending} className="w-full">
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    Save Configuration
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>
                </div>

                {/* --- RIGHT: PREVIEW (8 Cols) --- */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-center justify-between h-8">
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Live Preview</h2>
                        <Button variant="outline" size="sm" onClick={handleCompile} disabled={isCompiling}>
                            {isCompiling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                            Export PDF
                        </Button>
                    </div>

                    <div className="bg-slate-200/50 rounded-xl border border-slate-200 p-8 md:p-12 overflow-auto flex justify-center min-h-[800px]">
                        {/* Scaled Preview Wrapper */}
                        <div className="origin-top scale-[0.5] md:scale-[0.6] lg:scale-[0.8] xl:scale-[0.85] shadow-2xl">
                            <div className="bg-white w-[210mm] h-[297mm] relative pointer-events-none select-none">
                                <PriceListPdfTemplate
                                    documentRef={undefined as any}
                                    clientName="VALUED CLIENT"
                                    recommendations={recommendations}
                                    filteredResults={calculatedMiners}
                                    branding={{
                                        companyName,
                                        footerText,
                                        logoUrl: logoUrl || initialBranding.logoUrl,
                                        colors: { primary: colorPrimary, secondary: colorSecondary, accent: colorAccent },
                                        customHeadings: { mainHeading, subHeading, contentText }
                                    }}
                                    userRole="reseller"
                                    pdfImages={{ logo: "" }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* --- HIDDEN PRINT STAGE --- */}
            <div className="absolute top-0 left-0 overflow-hidden w-0 h-0 opacity-0 pointer-events-none">
                <div ref={printRef} style={{ width: '210mm', minHeight: '297mm', background: 'white' }}>
                    <PriceListPdfTemplate
                        documentRef={undefined}
                        clientName="VALUED CLIENT"
                        recommendations={recommendations}
                        filteredResults={calculatedMiners}
                        branding={{
                            companyName: companyName,
                            footerText: footerText,
                            logoUrl: logoUrl || initialBranding.logoUrl,
                            colors: { primary: colorPrimary, secondary: colorSecondary, accent: colorAccent },
                            customHeadings: { mainHeading, subHeading, contentText }
                        }}
                        userRole="reseller"
                        pdfImages={{ logo: "" }}
                    />
                </div>
            </div>
        </div>
    );
}
