"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface StickyActionFooterProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function StickyActionFooter({ children, className, ...props }: StickyActionFooterProps) {
    return (
        <div
            className={cn(
                "fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t z-50 md:hidden flex items-center justify-between gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
