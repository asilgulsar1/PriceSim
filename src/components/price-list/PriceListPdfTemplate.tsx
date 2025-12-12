"use client";

import React, { useEffect, useState } from "react";
import { MinerScoreDetail } from "@/lib/miner-scoring";

interface Recommendations {
    topROI: MinerScoreDetail[];
    topRevenue: MinerScoreDetail[];
    topEfficiency: MinerScoreDetail[];
}

interface PriceListPdfTemplateProps {
    documentRef: React.RefObject<HTMLDivElement | null>;
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
}

export function PriceListPdfTemplate({
    documentRef,
    clientName,
    recommendations,
    filteredResults,
    branding,
    userRole,
    pdfImages
}: PriceListPdfTemplateProps) {
    const isReseller = userRole === 'reseller';

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

    // PREFER BASE64 IF AVAILABLE (Fixes CORS/PDF issues)
    if (pdfImages?.logo && isReseller && branding?.logoUrl) {
        logoSrc = pdfImages.logo;
    } else if (pdfImages?.logo && !isReseller) {
        logoSrc = pdfImages.logo;
    }

    // Custom Branding Extraction
    const colors = branding?.colors || { primary: '#0f172a', secondary: '#334155', accent: '#f97316' };
    const headings = branding?.customHeadings || {
        mainHeading: 'Strategic Hardware Acquisition',
        subHeading: 'Prepared For',
        contentText: 'Hardware pricing reflects current network difficulty and global supply chain conditions. Acquiring efficient hardware at current levels is recommended to optimize fleet performance for the upcoming cycle.'
    };

    // Pagination Config
    const PAGE_1_ITEMS = 9;
    const PAGE_N_ITEMS = 14;

    // Fix hydration mismatch by only rendering date on client
    const [currentDate, setCurrentDate] = useState("");
    useEffect(() => {
        const timer = setTimeout(() => setCurrentDate(new Date().toLocaleDateString()), 0);
        return () => clearTimeout(timer);
    }, []);

    // Chunking Logic
    const chunks: MinerScoreDetail[][] = [];
    if (filteredResults.length <= PAGE_1_ITEMS) {
        chunks.push(filteredResults);
    } else {
        chunks.push(filteredResults.slice(0, PAGE_1_ITEMS));
        let remaining = filteredResults.slice(PAGE_1_ITEMS);
        while (remaining.length > 0) {
            chunks.push(remaining.slice(0, PAGE_N_ITEMS));
            remaining = remaining.slice(PAGE_N_ITEMS);
        }
    }

    return (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            <div ref={documentRef}>
                {chunks.map((chunk, pageIndex) => (
                    <div
                        key={pageIndex}
                        className="pdf-page bg-white shadow-none border-none w-[210mm] h-[297mm] relative flex flex-col justify-between"
                        style={{ overflow: 'hidden', pageBreakAfter: 'always' }}
                    >
                        {/* --- Header Section (Page 1 Only) --- */}
                        {pageIndex === 0 && (
                            <>
                                <div className="bg-white p-8 mb-4 border-b relative shrink-0" style={{ borderColor: `${colors.accent}33` }}>
                                    {/* 33 = 20% opacity hex */}
                                    <div className="flex justify-between items-center relative z-10">
                                        <div>
                                            {/* Logo Image */}
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={logoSrc}
                                                alt={footerCompany}
                                                className="h-[75px] w-auto object-contain"
                                            // crossOrigin not needed for Base64, but harmless
                                            />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: colors.secondary }}>
                                                Institutional Infrastructure
                                            </p>
                                            <p className="text-sm font-semibold text-slate-900">{currentDate}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-8 shrink-0">
                                    <div className="mb-8">
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
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500 font-medium">Pricing valid for 24 hours</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Market Context (Professional) */}
                                    {headings.contentText && (
                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-sm mb-6 flex items-start gap-4">
                                            <div
                                                className="text-white rounded-full w-8 h-8 flex items-center justify-center font-serif font-bold text-sm shrink-0"
                                                style={{ backgroundColor: colors.accent }}
                                            >
                                                i
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm" style={{ color: colors.primary }}>Market Context</h3>
                                                <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                                                    {headings.contentText}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Strategic Analysis (Gross Revenue Focus) */}
                                    {(recommendations.topROI.length > 0) && (
                                        <div className="mb-8 overflow-hidden rounded-sm border border-slate-200">
                                            <div className="bg-slate-100 px-5 py-2 border-b border-slate-200">
                                                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Strategic Recommendations</h3>
                                            </div>
                                            <div className="grid grid-cols-3 divide-x divide-slate-200 bg-white">
                                                <div className="p-4">
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Fastest Capital Recycling</p>
                                                    <p className="text-sm font-bold text-slate-900 mb-1 truncate">{recommendations.topROI[0]?.miner.name}</p>
                                                    <p className="text-xs text-emerald-700 font-semibold mt-auto">
                                                        {((recommendations.topROI[0]?.miner.dailyRevenueUSD * 365 / recommendations.topROI[0]?.miner.calculatedPrice) * 100).toFixed(0)}% Est. Gross ROI
                                                    </p>
                                                </div>
                                                <div className="p-4">
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Highest Revenue Generation</p>
                                                    <p className="text-sm font-bold text-slate-900 mb-1 truncate">{recommendations.topRevenue[0]?.miner.name}</p>
                                                    <p className="text-xs text-blue-700 font-semibold mt-auto">
                                                        ${recommendations.topRevenue[0]?.miner.dailyRevenueUSD.toFixed(2)} / day
                                                    </p>
                                                </div>
                                                <div className="p-4">
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Operational Efficiency</p>
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

                        {/* --- Header Section (Subsequent Pages) --- */}
                        {pageIndex > 0 && (
                            <div className="bg-white border-b border-slate-100 p-6 mb-6 relative shrink-0 flex justify-between items-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={logoSrc}
                                    alt={footerCompany}
                                    className="h-[40px] w-auto object-contain opacity-80"
                                // crossOrigin="anonymous" // Base64 doesn't need this
                                />
                                <div className="text-right">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Inventory Continued</span>
                                    <span className="text-xs text-slate-300 ml-2">| Page {pageIndex + 1}</span>
                                </div>
                            </div>
                        )}

                        {/* --- Table Section --- */}
                        <div className="px-8 flex-grow">
                            <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                                Available Inventory <span className="text-slate-400 font-normal text-sm ml-2">Verified Stock</span>
                            </h3>
                            <div className="rounded-sm overflow-hidden border border-slate-200">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 font-bold text-slate-700 text-xs">
                                        <tr className="border-b border-slate-200">
                                            <th className="py-3 pl-3 w-[25%]">MODEL</th>
                                            <th className="text-right py-3">HASHRATE</th>
                                            <th className="text-right py-3">POWER</th>
                                            <th className="text-right py-3 text-emerald-700">REVENUE/DAY</th>
                                            <th className="text-right py-3 text-blue-700">GROSS ROI</th>
                                            <th className="text-right py-3 text-amber-700">PAYBACK</th>
                                            <th className="text-right py-3 pr-3">UNIT PRICE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chunk.map((r, i) => {
                                            const m = r.miner;

                                            // GROSS Logic:
                                            // Payback = Price / Daily Revenue
                                            // ROI = (Daily Revenue * 365) / Price

                                            let paybackYears = 'N/A';
                                            let grossROI = 0;

                                            if (m.dailyRevenueUSD > 0 && m.calculatedPrice > 0) {
                                                const years = (m.calculatedPrice / m.dailyRevenueUSD) / 365;
                                                paybackYears = years.toFixed(1);

                                                grossROI = ((m.dailyRevenueUSD * 365) / m.calculatedPrice) * 100;
                                            }

                                            // Scarcity Logic for Top ROI Miners
                                            const isTopROI = recommendations.topROI.slice(0, 3).some(top => top.miner.name === m.name);
                                            const isTopRevenue = recommendations.topRevenue.slice(0, 1).some(top => top.miner.name === m.name);

                                            // Row styling
                                            let rowBg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30';
                                            if (isTopROI) rowBg = 'bg-orange-50/60'; // Highlight top ROI
                                            if (isTopRevenue) rowBg = 'bg-blue-50/60'; // Highlight top Revenue

                                            return (
                                                <tr key={i} className={`border-b border-slate-100 last:border-0 h-10 ${rowBg}`}>
                                                    <td className="font-bold text-slate-800 pl-3 py-2 text-xs relative">
                                                        {m.name}
                                                        {isTopROI && (
                                                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-600 border border-red-200 uppercase tracking-wide">
                                                                Low Stock
                                                            </span>
                                                        )}
                                                        {isTopRevenue && !isTopROI && (
                                                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-wide">
                                                                Flagship
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="text-right text-slate-600 py-2 text-xs">{m.hashrateTH}T</td>
                                                    <td className="text-right text-slate-600 py-2 text-xs">{m.powerWatts}W</td>

                                                    {/* Daily Revenue */}
                                                    <td className="text-right font-bold text-emerald-700 py-2 text-xs">
                                                        ${m.dailyRevenueUSD.toFixed(2)}
                                                    </td>

                                                    {/* Gross ROI */}
                                                    <td className="text-right font-bold text-blue-700 py-2 text-xs">
                                                        {grossROI.toFixed(0)}%
                                                    </td>

                                                    {/* Gross Payback */}
                                                    <td className="text-right font-bold text-amber-700 py-2 text-xs">
                                                        {paybackYears} yr
                                                    </td>

                                                    <td className="text-right font-extrabold text-slate-900 pr-3 py-2 text-sm">
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
                            {pageIndex === chunks.length - 1 && (
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
                                    <p>Enterprise Mining Solutions</p>
                                </div>
                                <div className="text-right">
                                    <p>{isReseller ? '' : 'www.segments.ae'}</p>
                                    <p className="text-slate-400">Generated: {currentDate}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
