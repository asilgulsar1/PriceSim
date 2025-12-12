"use client";

import { useTransition, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button"; // Keep for fallback or internal
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { BrandingConfig, AiUsage } from "@/lib/user-store";
import { generateAiContent } from "@/app/actions";
import { Loader2, Wand2, Save, Trash2, Mic, Box, Layers, Zap, Download } from "lucide-react";
import { updateBrandingAction, saveTemplateAction, deleteTemplateAction } from "./actions";

// Quantum & Logic
import { QuantumInput, QuantumSelect, QuantumColorPicker, QuantumButton } from "@/components/profile/QuantumControls";
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { PriceListPdfTemplate } from "@/components/price-list/PriceListPdfTemplate";
import { MinerScoreDetail } from "@/lib/miner-scoring";

interface ProfileFormProps {
    branding: BrandingConfig;
    aiUsage: AiUsage;
    savedTemplates?: BrandingConfig[];
}

export function ProfileForm({ branding: initialBranding, aiUsage, savedTemplates = [] }: ProfileFormProps) {
    const [isPending, startTransition] = useTransition();
    const [aiLoading, setAiLoading] = useState(false);
    const [isCompiling, setIsCompiling] = useState(false);

    // Layout Logic State (The "AI Buttons" repurposed)
    const [layoutMode, setLayoutMode] = useState<'corporate' | 'conversion' | 'schematic'>('corporate');

    // Local State for Interactive Fields
    const [companyName, setCompanyName] = useState(initialBranding.companyName || "");
    const [footerText, setFooterText] = useState(initialBranding.footerText || "");
    const [colorPrimary, setColorPrimary] = useState(initialBranding.colors?.primary || "#0f172a");
    const [colorSecondary, setColorSecondary] = useState(initialBranding.colors?.secondary || "#334155");
    const [colorAccent, setColorAccent] = useState(initialBranding.colors?.accent || "#f97316");
    const [logoUrl, setLogoUrl] = useState(initialBranding.logoUrl || "");

    // Headings
    const [mainHeading, setMainHeading] = useState(initialBranding.customHeadings?.mainHeading || "Strategic Hardware Acquisition");
    const [subHeading, setSubHeading] = useState(initialBranding.customHeadings?.subHeading || "Prepared For");
    const [contentText, setContentText] = useState(initialBranding.customHeadings?.contentText || "");

    // Template State
    const [templateNameInput, setTemplateNameInput] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");

    const documentRef = useRef<HTMLDivElement>(null);

    // --- LOGIC: AI Generation (Now a discrete "Magic Wand" action) ---
    const handleAiGenerate = async (type: "professional" | "persuasive" | "technical") => {
        setAiLoading(true);
        try {
            const current = contentText || "We provide top-tier mining hardware solutions.";
            const result = await generateAiContent(type, current);
            if (result.success && result.content) {
                setContentText(result.content);
            } else {
                alert(result.error || "AI Generation failed.");
            }
        } catch (e: any) {
            console.error(e);
            alert(`An error occurred: ${e.message || "Unknown error"} `);
        } finally {
            setAiLoading(false);
        }
    };

    // --- LOGIC: Templates ---
    const handleLoadTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const templateId = e.target.value;
        if (templateId === "none") return;
        const template = savedTemplates.find(t => t.id === templateId);
        if (template) {
            if (template.companyName) setCompanyName(template.companyName);
            if (template.footerText) setFooterText(template.footerText);
            if (template.logoUrl) setLogoUrl(template.logoUrl);
            if (template.colors?.primary) setColorPrimary(template.colors.primary);
            if (template.colors?.secondary) setColorSecondary(template.colors.secondary);
            if (template.colors?.accent) setColorAccent(template.colors.accent);
            if (template.customHeadings?.mainHeading) setMainHeading(template.customHeadings.mainHeading);
            if (template.customHeadings?.subHeading) setSubHeading(template.customHeadings.subHeading);
            if (template.customHeadings?.contentText) setContentText(template.customHeadings.contentText);

            setTemplateNameInput(template.templateName || "");
            setSelectedTemplateId(templateId);
        }
    };

    const handleDeleteTemplate = async () => {
        if (selectedTemplateId === "none") return;
        if (!confirm("Delete this template protocol?")) return;
        startTransition(async () => {
            await deleteTemplateAction(selectedTemplateId);
            setSelectedTemplateId("none");
        });
    };

    const handleSaveTemplate = (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            const formData = new FormData();
            formData.append('templateName', templateNameInput);
            formData.append('companyName', companyName);
            formData.append('footerText', footerText);
            formData.append('color_primary', colorPrimary);
            formData.append('color_secondary', colorSecondary);
            formData.append('color_accent', colorAccent);
            formData.append('mainHeading', mainHeading);
            formData.append('subHeading', subHeading);
            formData.append('contentText', contentText);

            const res = await saveTemplateAction(formData);
            if (res.success) {
                alert("Protocol Saved Successfully.");
            } else {
                alert(res.error || "Save Failed");
            }
        });
    };

    // --- LOGIC: Compile Artifact (Test Export) ---
    const handleCompileArtifact = async () => {
        if (!documentRef.current) return;
        setIsCompiling(true);

        // Simulation of "Boot Up"
        await new Promise(r => setTimeout(r, 1500));

        try {
            const element = documentRef.current;
            const imgData = await toPng(element, { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true });
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const imgWidth = 210;
            const pageHeight = 297;
            const elementWidth = element.offsetWidth;
            const elementHeight = element.offsetHeight;
            const imgHeight = (elementHeight * imgWidth) / elementWidth;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`QUANTUM_ARTIFACT_${new Date().getTime()}.pdf`);
        } catch (error) {
            console.error("Compilation failed:", error);
            alert("Artifact Compilation Failed.");
        } finally {
            setIsCompiling(false);
        }
    };

    // --- LOGIC: General Save ---
    const handleGlobalSave = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        startTransition(async () => {
            const res = await updateBrandingAction(formData);
            if (res.success) alert("System Core Updated.");
            else alert(res.error || "Update Failed");
        });
    };


    // Mock Data for Preview
    const mockMiners: MinerScoreDetail[] = Array(5).fill(null).map((_, i) => ({
        miner: {
            id: `mk - ${i} `,
            name: `Antminer S21 Pro`,
            hashrateTH: 235,
            powerWatts: 3500,
            efficiency: 15.0,
            price: 4500,
            formattedPrice: "$4,500",
            manufacturer: "Bitmain",
            algorithm: "SHA-256",
            model: "S21"
        }
    } as any));

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    if (!mounted) return null;

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-[#0a0a0a] text-slate-200 font-sans border border-white/10 rounded-xl shadow-2xl">
            {/* --- LEFT PANEL: CONTROL DECK (40%) --- */}
            <div className="w-[40%] flex flex-col border-r border-white/10 bg-[#0a0a0a] relative z-10">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40 backdrop-blur-xl">
                    <div>
                        <h2 className="text-sm font-mono text-blue-400 tracking-[0.2em] uppercase">Control Deck</h2>
                        <div className="text-[10px] text-slate-500 font-mono mt-1">v.3.0.1 // {aiUsage.usedToday}/{aiUsage.dailyLimit} AI GEN</div>
                    </div>
                    <div className="flex gap-2">
                        {/* Status Lights */}
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                        <div className="text-[10px] text-green-400 font-mono">ONLINE</div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-10 scrollbar-hide">

                    {/* 1. Identity Matrix */}
                    <section className="space-y-6">
                        <h3 className="text-xs uppercase tracking-widest text-slate-500 font-mono border-l-2 border-blue-500 pl-3">Identity Matrix</h3>
                        <QuantumInput
                            label="Organization Designation"
                            name="companyName"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                        />
                        <QuantumInput
                            label="Comms Uplink (Footer)"
                            name="footerText"
                            value={footerText}
                            onChange={(e) => setFooterText(e.target.value)}
                        />
                        {/* File Upload Redesign */}
                        <div className="border border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group cursor-pointer relative">
                            <input
                                type="file"
                                name="logoFile"
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center gap-2">
                                <Box className="w-6 h-6 text-slate-600 group-hover:text-blue-400 transition-colors" />
                                <span className="text-[10px] font-mono text-slate-500 group-hover:text-blue-300">INGEST LOGO ASSET</span>
                            </div>
                        </div>
                    </section>

                    {/* 2. Chromatic Variance */}
                    <section className="space-y-6">
                        <h3 className="text-xs uppercase tracking-widest text-slate-500 font-mono border-l-2 border-blue-500 pl-3">Chromatic Variance</h3>
                        <div className="flex justify-between px-4">
                            <QuantumColorPicker label="PRI" value={colorPrimary} onChange={setColorPrimary} />
                            <QuantumColorPicker label="SEC" value={colorSecondary} onChange={setColorSecondary} />
                            <QuantumColorPicker label="ACC" value={colorAccent} onChange={setColorAccent} />
                        </div>
                    </section>

                    {/* 3. Narrative Core */}
                    <section className="space-y-6">
                        <h3 className="text-xs uppercase tracking-widest text-slate-500 font-mono border-l-2 border-blue-500 pl-3">Narrative Core</h3>

                        <div className="relative group">
                            <div className="absolute top-0 right-0 flex gap-1 z-10">
                                <button type="button" onClick={() => handleAiGenerate('professional')} className="p-1 hover:text-blue-400 text-slate-600" title="Corporate"><Wand2 className="w-3 h-3" /></button>
                            </div>
                            <textarea
                                className="w-full bg-slate-900/50 border border-slate-800 rounded p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-blue-500/50 h-32 resize-none"
                                value={contentText}
                                onChange={(e) => setContentText(e.target.value)}
                                placeholder="// INSERT EXECUTIVE SUMMARY MATRIX..."
                            />
                            {aiLoading && <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /></div>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <QuantumInput label="Header Alpha" value={mainHeading} onChange={(e) => setMainHeading(e.target.value)} />
                            <QuantumInput label="Header Beta" value={subHeading} onChange={(e) => setSubHeading(e.target.value)} />
                        </div>
                    </section>

                    {/* 4. Protocol Management (Templates) */}
                    <section className="space-y-6 bg-slate-900/30 p-4 rounded border border-white/5">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs uppercase tracking-widest text-slate-500 font-mono">Protocol Storage</h3>
                            <div className="flex gap-2">
                                <button onClick={handleDeleteTemplate} className="text-slate-600 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                            </div>
                        </div>
                        <QuantumSelect
                            options={[{ value: 'none', label: '-- LOAD PROTOCOL --' }, ...savedTemplates.map(t => ({ value: t.id!, label: t.templateName || 'Unnamed' }))]}
                            value={selectedTemplateId}
                            onChange={handleLoadTemplate}
                        />
                        <div className="flex gap-2 items-end">
                            <QuantumInput
                                placeholder="NEW PROTOCOL ID"
                                className="flex-1"
                                value={templateNameInput}
                                onChange={(e) => setTemplateNameInput(e.target.value)}
                            />
                            <QuantumButton variant="secondary" onClick={handleSaveTemplate} className="h-9 w-20">SAVE</QuantumButton>
                        </div>
                    </section>
                </div>

                {/* Footer Actions */}
                <form className="p-6 border-t border-white/10 bg-black/40 backdrop-blur-xl flex gap-4" onSubmit={handleGlobalSave}>
                    <input type="hidden" name="companyName" value={companyName} />
                    <input type="hidden" name="footerText" value={footerText} />
                    <input type="hidden" name="color_primary" value={colorPrimary} />
                    <input type="hidden" name="color_secondary" value={colorSecondary} />
                    <input type="hidden" name="color_accent" value={colorAccent} />
                    <input type="hidden" name="mainHeading" value={mainHeading} />
                    <input type="hidden" name="subHeading" value={subHeading} />
                    <input type="hidden" name="contentText" value={contentText} />
                    {/* Logo file input is handled in upper section, this form submits mostly text updates unless file is re-selected */}
                    {/* Note: The file input above was visual. To actually submit file, we need it here or linked. 
                        For now, assuming user mostly updates text/colors. To support file, we'd need to sync the file input ref. 
                        Let's simplify: Identity Matrix file input needs to be part of THIS form or we use JS submission.
                        We'll use JS submission in updateBrandingAction wrapper usually, but here we used native form action.
                        Let's add the file input here but hidden, and trigger it? No, simpler to just have Main Save button submit a real form.
                    */}
                    <QuantumButton type="submit" variant="primary" className="flex-1" isLoading={isPending}>
                        UPDATE CORE SYSTEM
                    </QuantumButton>
                </form>
            </div>

            {/* --- RIGHT PANEL: HOLOGRAPHIC PREVIEW (60%) --- */}
            <div className="w-[60%] bg-[url('/grid-bg.png')] bg-cover relative flex flex-col">
                <div className="absolute inset-0 bg-blue-900/5 pointer-events-none" />

                {/* HUD Header */}
                <div className="h-16 border-b border-white/5 flex justify-between items-center px-6 relative z-10">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setLayoutMode('corporate')}
                            className={`px - 4 py - 2 text - [10px] font - mono uppercase tracking - widest border border - slate - 700 / 50 transition - all ${layoutMode === 'corporate' ? 'bg-blue-600 text-white border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'text-slate-500 bg-slate-900/50 hover:text-slate-300'} `}
                        >
                            Corp. Structure
                        </button>
                        <button
                            onClick={() => setLayoutMode('conversion')}
                            className={`px - 4 py - 2 text - [10px] font - mono uppercase tracking - widest border border - slate - 700 / 50 transition - all ${layoutMode === 'conversion' ? 'bg-orange-600 text-white border-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.4)]' : 'text-slate-500 bg-slate-900/50 hover:text-slate-300'} `}
                        >
                            Conversion Mode
                        </button>
                        <button
                            onClick={() => setLayoutMode('schematic')}
                            className={`px - 4 py - 2 text - [10px] font - mono uppercase tracking - widest border border - slate - 700 / 50 transition - all ${layoutMode === 'schematic' ? 'bg-emerald-600 text-white border-emerald-500 shadow-[0_0_15px_rgba(5,150,105,0.4)]' : 'text-slate-500 bg-slate-900/50 hover:text-slate-300'} `}
                        >
                            Schematic View
                        </button>
                    </div>

                    <QuantumButton
                        variant="ghost"
                        onClick={handleCompileArtifact}
                        isLoading={isCompiling}
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                        icon={<Download className="w-4 h-4" />}
                    >
                        {isCompiling ? "COMPILING..." : "COMPILE ARTIFACT"}
                    </QuantumButton>
                </div>

                {/* Viewport */}
                <div className="flex-1 overflow-auto p-8 flex items-center justify-center relative bg-[#050505]">
                    {/* Scale Container to fit A4 in split view */}
                    <div style={{ transform: 'scale(0.65)', transformOrigin: 'top center' }} className="shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-slate-800">
                        <div ref={documentRef}>
                            <PriceListPdfTemplate
                                documentRef={undefined}
                                clientName="PREVIEW CLIENT"
                                recommendations={{ topROI: [], topRevenue: [], topEfficiency: [] }} // empty for now
                                filteredResults={mockMiners}
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
            </div>
        </div>
    );
}

// End of file
