"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ExternalLink, TrendingUp, Users, Briefcase, Star, Info, ArrowLeft, Archive } from "lucide-react";
import Link from "next/link";
import { NewsItem } from "@/lib/news-engine/types";

import { GamificationHeader } from "@/components/gamification-header";
import { GamificationTracker } from "@/components/gamification-tracker";
import { DailyQuizModal } from "@/components/daily-quiz-modal";

export default function NewsClientPage({ items, email }: { items: any[], email: string }) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 40);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100">
            <GamificationTracker email={email} />
            <DailyQuizModal />

            {/* Sticky Floating Header (Visible on Scroll) */}
            <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out transform ${scrolled ? "bg-white/90 backdrop-blur-md shadow-sm translate-y-0" : "-translate-y-full bg-transparent"
                }`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-slate-100">
                                <ArrowLeft className="w-5 h-5 text-slate-600" />
                            </Button>
                        </Link>
                        <div className="h-6 w-px bg-slate-200"></div>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">News Intelligence</h2>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="pt-12 px-4 sm:px-8 pb-16">
                <div className="max-w-7xl mx-auto">
                    <GamificationHeader email={email} />

                    {/* Hero Section */}
                    <header className="mb-10 relative">
                        <div className="flex justify-between items-start">
                            <div className="space-y-4 max-w-3xl">
                                <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-2">
                                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                                </Link>
                                <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
                                    Market Intelligence
                                </h1>
                                <p className="text-xl text-slate-600 leading-relaxed font-light">
                                    Live feed from institutional APIs, social sentiment, and industry press.
                                </p>
                            </div>
                        </div>

                        {/* Educational Badge Row */}
                        <div className="flex flex-wrap gap-3 mt-8">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                [Insti] Professional
                            </div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-sm font-medium border border-orange-100">
                                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                [Social] Community
                            </div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-sm font-medium border border-slate-200">
                                <Info className="w-4 h-4" />
                                Updated every 30m
                            </div>
                            <Link href="/dashboard/news/archive" className="ml-auto inline-flex items-center gap-2 px-4 py-1.5 bg-white text-slate-600 rounded-full text-sm font-medium border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
                                <Archive className="w-4 h-4" />
                                View Archive
                            </Link>
                        </div>
                    </header>

                    {/* Controls & Grid */}
                    <Tabs defaultValue="all" className="w-full">
                        <div className="sticky top-20 z-40 bg-slate-50/95 backdrop-blur-sm py-4 -mx-2 px-2 transition-all">
                            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                                <TabsList className="bg-white shadow-sm border border-slate-200 p-1 h-auto w-full md:w-auto overflow-x-auto flex flex-nowrap md:flex-wrap">
                                    <TabsTrigger value="all" className="px-4 py-2 text-slate-600 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:font-semibold transition-all">All</TabsTrigger>
                                    <TabsTrigger value="Macro" className="px-4 py-2 text-slate-600 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:font-semibold">Macro</TabsTrigger>
                                    <TabsTrigger value="Crypto" className="px-4 py-2 text-slate-600 data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:font-semibold">Crypto</TabsTrigger>
                                    <TabsTrigger value="Mining" className="px-4 py-2 text-slate-600 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:font-semibold">Mining</TabsTrigger>
                                    <TabsTrigger value="Celeb" className="px-4 py-2 text-slate-600 data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=active]:font-semibold">Influencers</TabsTrigger>
                                </TabsList>
                                <div className="relative w-full md:w-auto">
                                    <Input
                                        placeholder="Search headlines..."
                                        className="pl-4 pr-10 w-full md:w-64 bg-white border-slate-300 placeholder:text-slate-500 text-slate-900 focus:ring-slate-900 focus:border-slate-900 shadow-sm"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {['all', 'Macro', 'Crypto', 'Mining', 'Celeb'].map(category => (
                            <TabsContent key={category} value={category} className="mt-4 focus-visible:outline-none">
                                <NewsGrid
                                    items={category === 'all' ? items : items.filter(i => i.category === category)}
                                    category={category}
                                />
                            </TabsContent>
                        ))}
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

function NewsGrid({ items }: { items: NewsItem[], category: string }) {
    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                <div className="mb-4 p-4 bg-slate-50 rounded-full">
                    <Briefcase className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">No updates yet</h3>
                <p className="text-slate-500 max-w-xs text-center mt-1">
                    The intelligence engine hasn't picked up news in this category for today.
                </p>
            </div>
        );
    }

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
                <div
                    key={item.id}
                    className="group relative bg-white rounded-xl border border-slate-200 p-5 hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col h-full hover:-translate-y-1"
                >
                    <div className="flex gap-2 mb-4 flex-wrap">
                        <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 uppercase tracking-wider font-bold ${item.category === 'Macro' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                item.category === 'Crypto' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                    item.category === 'Mining' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                        'bg-green-50 text-green-700 border-green-200'
                                }`}
                        >
                            {item.category}
                        </Badge>
                        {item.tags?.map((tag: string) => (
                            <span
                                key={tag}
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${tag.includes('Insti') ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                    tag.includes('Social') ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                        'bg-slate-50 text-slate-600 border-slate-100'
                                    }`}
                            >
                                {tag.replace('[', '').replace(']', '')}
                            </span>
                        ))}
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mb-2 leading-snug group-hover:text-blue-600 transition-colors">
                        {item.title}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 font-medium">
                        <span className="text-slate-900">{item.source}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <time>{new Date(item.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed mb-6 line-clamp-3">
                        {item.description}
                    </p>

                    <div className="mt-auto pt-4 border-t border-slate-50 flex justify-between items-end">
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 group-hover:gap-2 transition-all"
                        >
                            Read Full Story <ExternalLink className="w-3 h-3" />
                        </a>

                        {/* Sentiment Indicator (Mock for now, until Phase 8 fully populated) */}
                        {item.sentiment && (
                            <div className={`w-2 h-2 rounded-full ${item.sentiment.score > 0 ? 'bg-green-500' : 'bg-red-500'
                                }`} title={`Sentiment Impact: ${item.sentiment.impact}/10`}></div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
