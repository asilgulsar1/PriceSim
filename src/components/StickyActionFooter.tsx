"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, MessageSquare, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

interface StickyActionFooterProps {
    minerName: string;
    price: number;
    purchaseLink: string;
}

export function StickyActionFooter({ minerName, price, purchaseLink }: StickyActionFooterProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // Show after scrolling past the initial hero section (approx 600px)
            const show = window.scrollY > 600;
            setIsVisible(show);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-50 animate-in slide-in-from-bottom duration-300">
            <div className="container mx-auto px-4 py-3 max-w-7xl flex items-center justify-between gap-4">

                {/* Left: Product Info (Hidden on very small screens) */}
                <div className="hidden md:flex flex-col">
                    <div className="text-sm font-bold text-slate-900">{minerName}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-medium text-slate-700">${price.toLocaleString()}</span>
                        <span className="text-green-600 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> In Stock
                        </span>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">

                    {/* Secondary: Chat/Compare */}
                    <Button variant="ghost" size="sm" className="hidden sm:flex text-slate-500 hover:text-blue-600">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Ask Question
                    </Button>

                    <Link href={purchaseLink} className="w-full md:w-auto">
                        <Button className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5">
                            Request Quote <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
