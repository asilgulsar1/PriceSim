import { PriceListGenerator } from "@/components/PriceListGenerator";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { auth } from "@/auth";
import { getUser } from "@/lib/user-store";

export default async function PriceListPage() {
    const session = await auth();
    const userRole = (session?.user as any)?.role;

    // Fetch fresh user data to ensure branding is up-to-date
    // Session data can be stale (JWT strategy)
    let freshBranding = (session?.user as any)?.branding;
    let resellerMargin = (session?.user as any)?.resellerMargin || 0;

    if (session?.user?.email) {
        const user = await getUser(session.user.email);
        if (user) {
            if (user.branding) freshBranding = user.branding;
            if (user.resellerMargin !== undefined) resellerMargin = user.resellerMargin;
        }
    }

    return (
        <div className="container mx-auto py-8">
            <PriceListGenerator
                userRole={userRole}
                resellerMargin={resellerMargin}
                branding={freshBranding}
            />
        </div>
    );
}
