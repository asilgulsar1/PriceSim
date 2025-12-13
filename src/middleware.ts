/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const { nextUrl } = req;
    const user = req.auth?.user as { role?: string };
    const role = user?.role;

    // Public Routes (Allow access without login)
    const isPublicRoute =
        nextUrl.pathname === '/login' ||
        nextUrl.pathname.startsWith('/market-prices') ||
        nextUrl.pathname.startsWith('/products') || // Product pages are public
        nextUrl.pathname.startsWith('/_next') ||    // Next.js internals
        nextUrl.pathname.startsWith('/static') ||   // Static assets
        // Explicit Public API Whitelist
        nextUrl.pathname.startsWith('/api/auth') ||         // NextAuth Authentication
        nextUrl.pathname.startsWith('/api/market/latest') ||
        nextUrl.pathname.startsWith('/api/miners/latest') ||
        nextUrl.pathname.startsWith('/api/price-list') ||
        nextUrl.pathname.startsWith('/api/cron/update-prices'); // Cron handles its own auth

    if (!isLoggedIn) {
        if (!isPublicRoute) {
            // Redirect to login if trying to access protected route
            return Response.redirect(new URL('/login', nextUrl));
        }
        // Allow public route access
        return;
    }

    if (isLoggedIn) {
        // If on login page, redirect to home (or role specific page)
        if (nextUrl.pathname === '/login') {
            return Response.redirect(new URL('/', nextUrl));
        }

        // Sales Logic
        if (role === 'sales') {
            // Sales Restricted Routes
            // Block /admin-dashboard, /price-simulator, /treasury
            // Allow /price-list, /market-prices, /products
            const blockedPrefixes = ['/admin-dashboard', '/price-simulator', '/treasury'];
            if (blockedPrefixes.some(prefix => nextUrl.pathname.startsWith(prefix))) {
                return Response.redirect(new URL('/price-list', nextUrl));
            }

            if (nextUrl.pathname === '/') {
                return Response.redirect(new URL('/price-list', nextUrl));
            }
        }

        // Reseller Logic (Strict)
        if (role === 'reseller') {
            // Unwanted Protected Routes for Resellers
            // Allowed: /price-list, /market-prices, /products, /profile, /api
            // Blocked: /price-simulator, /treasury, /admin-dashboard

            // Note: Public routes like /market-prices and /products are allowed by default logic above?
            // "if (!isLoggedIn) ... if (!isPublic) redirect login"
            // But here we are logged in.
            // We must explicitly BLOCK restricted routes.

            // Let's be explicit about what is BLOCKED.
            // Block /admin-dashboard, /price-simulator, /treasury, /market-prices
            const blockedPrefixes = ['/admin-dashboard', '/price-simulator', '/treasury', '/market-prices'];
            if (blockedPrefixes.some(prefix => nextUrl.pathname.startsWith(prefix))) {
                return Response.redirect(new URL('/price-list', nextUrl));
            }

            // If on root, send to price-list
            if (nextUrl.pathname === '/') {
                return Response.redirect(new URL('/price-list', nextUrl));
            }
        }

        // Admin Logic
        // Redirect root '/' to admin-dashboard
        if (role === 'admin' && nextUrl.pathname === '/') {
            return Response.redirect(new URL('/admin-dashboard', nextUrl));
        }
    }
});

export const config = {
    // Matcher excluding static files
    // Matcher excluding static files and images
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$).*)"],
};
