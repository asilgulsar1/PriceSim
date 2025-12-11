"use client";

import { useEffect, useRef } from "react";

export function GamificationTracker({ email }: { email: string }) {
    const hasTracked = useRef(false);

    useEffect(() => {
        // Only track if we haven't already for this session mount
        if (hasTracked.current) return;

        // Requirement: "Reading" means staying on the page for at least 30 seconds.
        const timer = setTimeout(async () => {
            try {
                // Determine duration. We just say 30s for the streak trigger.
                // If we want real WPM, we'd need start/end time, but this is a "Activity" ping.
                await fetch('/api/gamification/track', {
                    method: 'POST',
                    body: JSON.stringify({
                        type: 'READING_COMPLETE',
                        durationSeconds: 30,
                        email // Passing email explicit mostly for redundancy, simple auth check on server
                    })
                });
                console.log("Activity tracked: 30s reading");
                hasTracked.current = true;
            } catch (e) {
                console.error("Failed to track activity", e);
            }
        }, 30000); // 30 seconds

        return () => clearTimeout(timer);
    }, [email]);

    return null; // Invisible component
}
