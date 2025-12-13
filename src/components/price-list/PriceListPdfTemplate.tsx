"use client";

import React, { useEffect, useState } from "react";
import { MinerScoreDetail } from "@/lib/miner-scoring";

interface Recommendations {
    topROI: MinerScoreDetail[];
    topRevenue: MinerScoreDetail[];
    topEfficiency: MinerScoreDetail[];
}

interface PriceListPdfTemplateProps {
    documentRef?: React.RefObject<HTMLDivElement | null>;
    clientName: string;
    recommendations: Recommendations;
    filteredResults: MinerScoreDetail[];
    branding?: {
        companyName?: string;
        logoUrl?: string;
        footerText?: string;
        colors?: {
            primary: string;
            secondary: string;
            accent: string;
        };
        customHeadings?: {
            mainHeading?: string;
            subHeading?: string;
            contentText?: string;
        };
    };
    userRole?: string;
    pdfImages?: {
        logo: string;
    };
    style?: string;
}

export function PriceListPdfTemplate({
    documentRef,
    clientName,
    recommendations,
    filteredResults,
    branding,
    userRole,
    pdfImages,
    style = 'default'
}: PriceListPdfTemplateProps) {
    const isReseller = userRole === 'reseller';

    // Layout Flags
    const isHighConversion = style === 'high-conversion';
    const isBanker = style === 'banker';
    const isEngineer = style === 'engineer';

    // Branding Defaults
    let logoSrc = "/logo.png";
    let footerEmail = "sales@segments.ae";
    let footerCompany = "SEGMENTS CLOUD";

    // Strict Whitelabeling for Resellers
    if (isReseller) {
        logoSrc = branding?.logoUrl || ""; // No default logo
        footerEmail = branding?.footerText || "";
        footerCompany = branding?.companyName || "Enterprise Mining Solutions";
    } else {
        // Default Segments Branding
        logoSrc = branding?.logoUrl || "/logo.png";
        footerEmail = branding?.footerText || "sales@segments.ae";
        footerCompany = branding?.companyName || "SEGMENTS CLOUD";
    }

    // PREFER BASE64 IF AVAILABLE
    if (pdfImages?.logo && (isReseller && branding?.logoUrl || !isReseller)) {
        logoSrc = pdfImages.logo;
    }

    // Custom Branding Extraction
    const colors = branding?.colors || { primary: '#0f172a', secondary: '#334155', accent: '#f97316' };
    const headings = branding?.customHeadings || {
        mainHeading: isHighConversion ? 'Exclusive Investment Opportunity' : (isBanker ? 'Capital Efficiency Report' : (isEngineer ? 'Hardware Efficiency Matrix' : 'Strategic Hardware Acquisition')),
        subHeading: 'Prepared For',
        contentText: isHighConversion
            ? 'Pricing and ROI estimates are valid for 24 hours due to Bitcoin network difficulty adjustments.'
            : 'Hardware pricing reflects current network difficulty and global supply chain conditions. Acquiring efficient hardware at current levels is recommended to optimize fleet performance for the upcoming cycle.'
    };

    // --- Data Processing & Pagination ---

    // pagination limits
    const PAGE_1_ITEMS = 10;
    const PAGE_N_ITEMS = 18;

    // Fix hydration
    const [currentDate, setCurrentDate] = useState("");
    useEffect(() => {
        const timer = setTimeout(() => setCurrentDate(new Date().toLocaleDateString()), 0);
        return () => clearTimeout(timer);
    }, []);

    // Helper types
    type DisplayItem = { type: 'miner', data: MinerScoreDetail } | { type: 'header', title: string };

    const displayItems: DisplayItem[] = [];
    let heroItem: MinerScoreDetail | null = null;

    if (isHighConversion) {
        // 1. Extract Hero (S21+ Hydro 395T or best ROI)
        const specificHero = filteredResults.find(r => r.miner.name.includes("S21+ Hydro") && r.miner.name.includes("395"));
        heroItem = specificHero || recommendations.topROI[0] || filteredResults[0];

        // 2. Remaining items
        const remaining = filteredResults.filter(r => r.miner.name !== heroItem?.miner.name);

        // 3. Groups
        const maxEfficiency = remaining.filter(r => r.miner.name.includes("S23"));
        const fastPayback = remaining.filter(r => !r.miner.name.includes("S23")); // Simplified logic

        if (maxEfficiency.length) {
            displayItems.push({ type: 'header', title: "Maximum Efficiency (Long Term)" });
            maxEfficiency.forEach(m => displayItems.push({ type: 'miner', data: m }));
        }
        if (fastPayback.length) {
            displayItems.push({ type: 'header', title: "Fastest Payback (Short Term)" });
            fastPayback.forEach(m => displayItems.push({ type: 'miner', data: m }));
        }
    } else if (isBanker) {
        // Tiers
        const tier1 = filteredResults.filter(r => r.miner.name.includes("S21+") && r.miner.calculatedPrice < 5000);
        const tier2 = filteredResults.filter(r => r.miner.name.includes("S23") && r.miner.calculatedPrice > 15000);
        const tier3 = filteredResults.filter(r => !tier1.includes(r) && !tier2.includes(r));

        if (tier1.length) {
            displayItems.push({ type: 'header', title: "Tier 1: High Yield / Fast Recovery" });
            tier1.forEach(m => displayItems.push({ type: 'miner', data: m }));
        }
        if (tier2.length) {
            displayItems.push({ type: 'header', title: "Tier 2: Enterprise Infrastructure" });
            tier2.forEach(m => displayItems.push({ type: 'miner', data: m }));
        }
        if (tier3.length) {
            displayItems.push({ type: 'header', title: "Tier 3: Entry Level" });
            tier3.forEach(m => displayItems.push({ type: 'miner', data: m }));
        }
    } else if (isEngineer) {
        // Sort by Efficiency (J/TH asc)
        const sorted = [...filteredResults].sort((a, b) => {
            const effA = a.miner.powerWatts / a.miner.hashrateTH;
            const effB = b.miner.powerWatts / b.miner.hashrateTH;
            return effA - effB;
        });
        // S23 Hydro Mix Flagship check handled in render
        sorted.forEach(m => displayItems.push({ type: 'miner', data: m }));
    } else {
        // Default
        filteredResults.forEach(m => displayItems.push({ type: 'miner', data: m }));
    }

    // Chunking
    const chunks: DisplayItem[][] = [];
    if (displayItems.length <= PAGE_1_ITEMS) {
        chunks.push(displayItems);
    } else {
        chunks.push(displayItems.slice(0, PAGE_1_ITEMS));
        let remaining = displayItems.slice(PAGE_1_ITEMS);
        while (remaining.length > 0) {
            chunks.push(remaining.slice(0, PAGE_N_ITEMS));
            remaining = remaining.slice(PAGE_N_ITEMS);
        }
    }

    return (
        <div ref={documentRef} className="origin-top-left bg-white" style={{ width: '210mm' }}>
            {chunks.map((chunk, pageIndex) => (
                <div
                    key={pageIndex}
                    className="pdf-page bg-white shadow-none border-none w-[210mm] h-[297mm] relative flex flex-col justify-between"
                    style={{ overflow: 'hidden', pageBreakAfter: 'always' }}
                >
                    {/* --- Header Section --- */}
                    {pageIndex === 0 && (
                        <>
                            <div className="bg-white p-6 mb-2 border-b relative shrink-0" style={{ borderColor: `${colors.accent}33` }}>
                                <div className="flex justify-between items-center relative z-10">
                                    <div>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={logoSrc} alt={footerCompany} className="h-[60px] w-auto object-contain" />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: colors.secondary }}>
                                            {isBanker ? 'Financial Instrument' : 'Institutional Infrastructure'}
                                        </p>
                                        <p className="text-sm font-semibold text-slate-900">{currentDate}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-8 shrink-0">
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold mb-2 tracking-tight" style={{ color: colors.primary }}>
                                        {headings.mainHeading}
                                    </h2>
                                    <div className="flex justify-between items-end border-b pb-4" style={{ borderColor: '#e2e8f0' }}>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: colors.secondary }}>
                                                {headings.subHeading}
                                            </p>
                                            <p className="text-xl font-bold text-slate-900">{clientName || 'Valued Partner'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* STYLE SPECIFIC HERO BLOCKS */}
                                {isHighConversion && heroItem && (
                                    <div className="mb-4 bg-red-50 border border-red-100 rounded-lg p-4 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl">
                                            DEAL OF THE DAY
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="text-lg font-extrabold text-slate-900">{heroItem.miner.name}</h3>
                                                <div className="flex items-center gap-4 mt-2">
                                                    <div className="bg-white px-3 py-2 rounded border border-red-100 flex flex-col items-start shrink-0">
                                                        <span className="text-[10px] text-slate-500 uppercase font-bold leading-none mb-1">Est. ROI</span>
                                                        <span className="text-lg font-bold text-red-600 leading-none">
                                                            {((heroItem.miner.dailyRevenueUSD * 365 / heroItem.miner.calculatedPrice) * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-600">
                                                        Pays for itself in just {((heroItem.miner.calculatedPrice / heroItem.miner.dailyRevenueUSD) / 30.4).toFixed(1)} Months
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-red-600 uppercase mb-1 flex items-center justify-end gap-1">
                                                    <span className="block w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                                                    LOW STOCK
                                                </div>
                                                <div className="text-2xl font-black text-slate-900">
                                                    ${heroItem.miner.calculatedPrice.toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isBanker && (
                                    <div className="mb-6 bg-slate-100 border-l-4 border-slate-400 p-4 rounded-r">
                                        <h3 className="text-xs font-bold text-slate-600 uppercase mb-1">Executive Summary</h3>
                                        <p className="text-sm font-medium text-slate-800 leading-relaxed">
                                            Strategic Recommendation: The <span className="font-bold">{recommendations.topROI[0]?.miner.name}</span> offers the optimal balance of CAPEX recovery ({((recommendations.topROI[0]?.miner.calculatedPrice / recommendations.topROI[0]?.miner.dailyRevenueUSD) / 30.4).toFixed(0)} months) and hashrate density.
                                        </p>
                                    </div>
                                )}

                                {/* Default / Original Recommendations Block */}
                                {!isHighConversion && !isBanker && (recommendations.topROI.length > 0) && (
                                    <div className="mb-8 overflow-hidden rounded-sm border border-slate-200">
                                        <div className="bg-slate-100 px-5 py-2 border-b border-slate-200">
                                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Strategic Recommendations</h3>
                                        </div>
                                        <div className="grid grid-cols-3 divide-x divide-slate-200 bg-white">
                                            <div className="p-4">
                                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Fastest Payback</p>
                                                <p className="text-sm font-bold text-slate-900 mb-1 truncate">{recommendations.topROI[0]?.miner.name}</p>
                                                <p className="text-xs text-emerald-700 font-semibold mt-auto">
                                                    {((recommendations.topROI[0]?.miner.dailyRevenueUSD * 365 / recommendations.topROI[0]?.miner.calculatedPrice) * 100).toFixed(0)}% ROI
                                                </p>
                                            </div>
                                            <div className="p-4">
                                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Highest Revenue</p>
                                                <p className="text-sm font-bold text-slate-900 mb-1 truncate">{recommendations.topRevenue[0]?.miner.name}</p>
                                                <p className="text-xs text-blue-700 font-semibold mt-auto">
                                                    ${recommendations.topRevenue[0]?.miner.dailyRevenueUSD.toFixed(2)} / day
                                                </p>
                                            </div>
                                            <div className="p-4">
                                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Best Efficiency</p>
                                                <p className="text-sm font-bold text-slate-900 mb-1 truncate">{recommendations.topEfficiency[0]?.miner.name}</p>
                                                <p className="text-xs text-amber-700 font-semibold mt-auto">
                                                    {(recommendations.topEfficiency[0]?.miner.powerWatts / recommendations.topEfficiency[0]?.miner.hashrateTH).toFixed(1)} J/TH
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {pageIndex > 0 && (
                        <div className="bg-white border-b border-slate-100 p-6 mb-6 relative shrink-0 flex justify-between items-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={logoSrc} alt={footerCompany} className="h-[40px] w-auto object-contain opacity-80" />
                            <div className="text-right">
                                <span className="text-xs font-bold text-slate-400 uppercase">Continued</span>
                                <span className="text-xs text-slate-300 ml-2">| Page {pageIndex + 1}</span>
                            </div>
                        </div>
                    )}

                    {/* --- Table Section --- */}
                    <div className="px-8 flex-grow">
                        <div className="rounded-sm overflow-hidden border border-slate-200">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 font-bold text-slate-700 text-xs">
                                    <tr className="border-b border-slate-200">
                                        <th className="py-3 pl-3 w-[30%]">MODEL</th>

                                        {/* Dynamic Columns based on Style */}
                                        {isBanker ? (
                                            <>
                                                <th className="text-right py-3 text-blue-700">ANNUALIZED YIELD</th>
                                                <th className="text-right py-3 text-amber-700">CAPITAL RECOVERY</th>
                                                <th className="text-right py-3">HASHRATE</th>
                                                <th className="text-right py-3">POWER</th>
                                            </>
                                        ) : isEngineer ? (
                                            <>
                                                <th className="text-right py-3 text-slate-900">EFFICIENCY</th>
                                                <th className="text-left pl-4 py-3">POWER DRAW</th>
                                                <th className="text-right py-3">HASHRATE</th>
                                            </>
                                        ) : (
                                            // Default & High Conversion
                                            <>
                                                {!isHighConversion && <th className="text-right py-3">HASHRATE</th>}
                                                {!isHighConversion && <th className="text-right py-3">POWER</th>}
                                                <th className="text-right py-3 text-emerald-700">REVENUE/DAY</th>
                                                {isHighConversion ? (
                                                    <th className="text-right py-3 text-amber-700">BREAK EVEN</th>
                                                ) : (
                                                    <>
                                                        <th className="text-right py-3 text-blue-700">ROI</th>
                                                        <th className="text-right py-3 text-amber-700">PAYBACK</th>
                                                    </>
                                                )}
                                            </>
                                        )}

                                        <th className="text-right py-3 pr-3">PRICE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((item, i) => {
                                        if (item.type === 'header') {
                                            return (
                                                <tr key={`h-${i}`} className="bg-slate-100 border-b border-slate-200">
                                                    <td colSpan={7} className="py-2 pl-3 font-bold text-slate-600 text-xs uppercase tracking-wider">
                                                        {item.title}
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        const m = item.data.miner;
                                        const grossROI = ((m.dailyRevenueUSD * 365) / m.calculatedPrice) * 100;
                                        const paybackYears = m.calculatedPrice > 0 ? ((m.calculatedPrice / m.dailyRevenueUSD) / 365).toFixed(1) : 'N/A';
                                        const paybackMonths = m.calculatedPrice > 0 ? ((m.calculatedPrice / m.dailyRevenueUSD) / 30.4).toFixed(0) : 'N/A';
                                        const efficiency = (m.powerWatts / m.hashrateTH).toFixed(1);

                                        // Styling
                                        const isFlagship = isEngineer && m.name.includes("S23 Hydro Mix"); // Flagship for Engineer
                                        let rowBg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30';
                                        if (isFlagship) rowBg = 'bg-blue-50/60 border-l-2 border-blue-500';

                                        return (
                                            <tr key={i} className={`border-b border-slate-100 last:border-0 h-10 ${rowBg}`}>
                                                <td className="font-bold text-slate-800 pl-3 py-2 text-xs relative">
                                                    <div className="flex items-center gap-2">
                                                        {m.name}
                                                        {isBanker && !m.name.includes("Low Stock") && (
                                                            <span className="text-blue-500" title="Verified Stock">✓</span>
                                                        )}
                                                        {isEngineer && isFlagship && (
                                                            <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded uppercase">Flagship</span>
                                                        )}
                                                        {isEngineer && m.name.includes("S21+ Hydro 395") && (
                                                            <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded uppercase">Immediate</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* BANKER COLUMNS */}
                                                {isBanker && (
                                                    <>
                                                        <td className="text-right font-bold text-blue-700 py-2 text-xs">{grossROI.toFixed(0)}%</td>
                                                        <td className="text-right font-bold text-amber-700 py-2 text-xs">{paybackYears} yr</td>
                                                        <td className="text-right text-slate-600 py-2 text-xs">{m.hashrateTH}T</td>
                                                        <td className="text-right text-slate-600 py-2 text-xs">{m.powerWatts}W</td>
                                                    </>
                                                )}

                                                {/* ENGINEER COLUMNS */}
                                                {isEngineer && (
                                                    <>
                                                        <td className="text-right font-bold text-slate-900 py-2 text-xs">{efficiency} J/T</td>
                                                        <td className="pl-4 py-2 align-middle">
                                                            {/* Tiny Bar Chart for Power */}
                                                            <div className="h-1.5 bg-slate-200 rounded-full w-[80px] overflow-hidden">
                                                                <div
                                                                    className="h-full bg-slate-500"
                                                                    style={{ width: `${Math.min((m.powerWatts / 6000) * 100, 100)}%` }}
                                                                ></div>
                                                            </div>
                                                            <div className="text-[9px] text-slate-400 mt-0.5">{m.powerWatts}W</div>
                                                        </td>
                                                        <td className="text-right font-bold text-slate-900 py-2 text-xs text-lg">{m.hashrateTH}</td>
                                                    </>
                                                )}

                                                {/* DEFAULT / HIGH CONVERSION COLUMNS */}
                                                {!isBanker && !isEngineer && (
                                                    <>
                                                        {!isHighConversion && <td className="text-right text-slate-600 py-2 text-xs">{m.hashrateTH}T</td>}
                                                        {!isHighConversion && <td className="text-right text-slate-600 py-2 text-xs">{m.powerWatts}W</td>}

                                                        {/* Revenue/Day (Bold Green for High Conversion) */}
                                                        <td className={`text-right py-2 text-xs ${isHighConversion ? 'font-extrabold text-green-600 text-sm' : 'font-bold text-emerald-700'}`}>
                                                            ${m.dailyRevenueUSD.toFixed(2)}
                                                        </td>

                                                        {isHighConversion ? (
                                                            <td className="text-right font-bold text-amber-700 py-2 text-xs">{paybackMonths} Months</td>
                                                        ) : (
                                                            <>
                                                                <td className="text-right font-bold text-blue-700 py-2 text-xs">{grossROI.toFixed(0)}%</td>
                                                                <td className="text-right font-bold text-amber-700 py-2 text-xs">{paybackYears} yr</td>
                                                            </>
                                                        )}
                                                    </>
                                                )}

                                                <td className={`text-right font-extrabold text-slate-900 pr-3 py-2 ${isEngineer ? 'text-xs text-slate-400 font-normal' : 'text-sm'}`}>
                                                    ${m.calculatedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* --- Footer Section --- */}
                    <div className="px-8 pb-8 pt-4 shrink-0">
                        {(pageIndex > 0 || pageIndex === chunks.length - 1) && ( // Footer on Page 2+ or Last Page
                            <div className="mb-6 bg-slate-900 p-4 rounded-sm flex justify-between items-center text-white">
                                <div>
                                    <h4 className="font-bold text-sm">Ready to Deploy?</h4>
                                    <p className="text-xs text-slate-400">Secure your hardware before the next batch sells out.</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-orange-500">{footerEmail}</p>
                                    <p className="text-xs text-slate-400">Inventory Reserved for 24h</p>
                                </div>
                            </div>
                        )}
                        <div className="border-t border-slate-200 pt-3 flex justify-between items-end text-[10px] text-slate-400">
                            <div>
                                <h4 className="font-bold text-slate-600 mb-1 uppercase">{footerCompany}</h4>
                                {isBanker && <p>Inventory verified by Asil Company. Logistics ready.</p>}
                                {!isBanker && <p>Enterprise Mining Solutions</p>}
                            </div>
                            <div className="text-right">
                                <p>{isReseller ? '' : 'www.segments.ae'}</p>
                                {isHighConversion && <p className="text-red-500 font-bold">Pricing valid for 24h</p>}
                                <p className="text-slate-400">Generated: {currentDate}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
