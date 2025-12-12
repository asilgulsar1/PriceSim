
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
        nextUrl.pathname.startsWith('/api') ||      // API routes public (mostly)
        nextUrl.pathname.startsWith('/_next') ||    // Next.js internals
        nextUrl.pathname.startsWith('/static');     // Static assets

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
            const isPriceList = nextUrl.pathname.startsWith('/price-list');
            // Allow access to public pages even for sales? 
            // Original logic forced them to price-list if not on price-list.
            // But they should probably be able to see products too?
            // "If they are on any other page, redirect to price-list" << this was strict.
            // Let's keep it strict ONLY if it's not a public page?
            // Actually, if sales logs in, they might want to use the calculator?
            // "Sales staff can only view the Price List" -> Strict.
            // But maybe allow them to logout? (Access to Profile/Logout UI?)
            // For now, I'll stick to the strict logic but EXEMPT public pages if they want to browse?
            // Let's keep it strict to match previous intent: "Sales -> Only Price List".
            // BUT, if they navigate to /products/..., should we block?
            // User requirement: "Product pages must be... SEO-friendly". Public.
            // So Sales seeing public pages is fine.
            // Only redirect if they try to go to PROTECTED pages that are not Price List?
            // Actually, `nextUrl.pathname !== '/'` was the condition.

            // Let's refine:
            // If they are on root '/', send to price-list.
            // If they are on a protected page that is NOT price-list, send to price-list.
            // If they are on public page, let them be.

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
