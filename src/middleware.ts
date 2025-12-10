import { auth } from "@/auth"

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const role = (req.auth?.user as any)?.role;
    const { nextUrl } = req;

    // Paths that don't require auth (e.g. if we had a public landing page, but we don't for now)
    // We'll treat api/auth/* as public implicitly by NextAuth

    if (!isLoggedIn) {
        // If trying to access a protected page, let NextAuth handle the redirect to sign-in
        // or we can force it. NextAuth middleware usually handles this if we return false?
        // Actually, simply wrapping with `auth` exposes the session. We need to do the logic.
        const isSignInPage = nextUrl.pathname.startsWith('/api/auth/signin');
        if (!isSignInPage) {
            // We rely on NextAuth to handle the unauthenticated state for generic pages?
            // Actually, it's better to explicitly redirect to api/auth/signin or a custom login page
            // But for simplicity, we will assume standard behavior. 
            // NOTE: Returning Response.redirect is the standard way.
            // However, standard NextAuth middleware example usually just allows falling through if valid?

            // Let's implement strict blocking
            return Response.redirect(new URL('/api/auth/signin', nextUrl));
        }
    }

    if (isLoggedIn) {
        // Sales Logic
        if (role === 'sales') {
            const isPriceList = nextUrl.pathname.startsWith('/price-list');
            // If they are on any other page, redirect to price-list
            if (!isPriceList && nextUrl.pathname !== '/') {
                return Response.redirect(new URL('/price-list', nextUrl));
            }
            // If they hit root '/', redirect to price-list
            if (nextUrl.pathname === '/') {
                return Response.redirect(new URL('/price-list', nextUrl));
            }
        }

        // Admin Logic
        // Admin can access everything.
        // Maybe redirect root '/' to admin-dashboard for admins? Or just keeping it as is.
        if (role === 'admin' && nextUrl.pathname === '/') {
            return Response.redirect(new URL('/admin-dashboard', nextUrl));
        }
    }
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
