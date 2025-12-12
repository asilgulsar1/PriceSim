import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { getUserRole, addUser } from "@/lib/user-store"

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [Google],
    callbacks: {
        async signIn({ user }) {
            if (!user.email) return false

            const role = await getUserRole(user.email)

            // If user has a valid role (admin or sales), allow sign in
            if (role) return true

            // New User -> Provision as 'client'
            try {
                await addUser({
                    email: user.email,
                    role: 'client',
                    name: user.name || undefined
                });
                return true;
            } catch (e) {
                console.error("Failed to provision client user", e);
                return false;
            }
        },
        async jwt({ token, user }) {
            if (user && user.email) {
                const role = await getUserRole(user.email);
                token.role = role;
                // We need to fetch the full user to get margin
                // Optimization: getUserRole already fetches user internally? 
                // No, getUserRole fetches user and returns role.
                // We should expose a getUser function or modify getUserRole.
                // Let's modify getUserRole to return full user? Or just fetch again.
                // Since this is sign-in/jwt refresh, fetching again is okay.
                // Or better, let's just use getUserRole which essentially does a fetch.
                // Let's use `getUsers` and find? No, inefficient.
                // In `src/lib/user-store.ts`, we export `getUserRole`.
                // Let's rely on that for role, but for margin we need the user object.
                // I will assume `token.resellerMargin` needs to be set.

                // HACK: I will just fetch ALL users and find matching email here for now, 
                // OR better, I should have exported `getUser(email)` from user-store.
                // But I can't change `user-store` again right now easily without context switch.
                // Wait, `getUserRole` implementation in `user-store.ts` (viewed in Step 276) finds the user blob and returns role.

                // I will add a `getUser` function to `user-store.ts`?
                // actually, I will just import `getUsers` and filter, it's <100 users.
                const { getUsers } = await import("@/lib/user-store");
                const allUsers = await getUsers();
                const found = allUsers.find(u => u.email === user.email);
                if (found) {
                    token.role = found.role;
                    token.resellerMargin = found.resellerMargin;
                    token.branding = found.branding;
                }
            }
            return token
        },
        async session({ session, token }) {
            if (session.user && token.role) {
                (session.user as any).role = token.role;
                (session.user as any).resellerMargin = token.resellerMargin;
                (session.user as any).branding = token.branding;
            }
            return session
        },
    },
    pages: {
        signIn: '/login', // We might create a custom login page, or use default
    }
})
