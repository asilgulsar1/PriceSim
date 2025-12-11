import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { getUserRole, addUser } from "@/lib/user-store"

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [Google],
    callbacks: {
        async signIn({ user }) {
            if (!user.email) return false
            const role = await getUserRole(user.email)
            // Allow if role exists OR if it matches Admin Email (bootstrap)
            if (role) return true
            // If completely new in this specific app context, we might block?
            // Requirement: "We'll need a market news updator tool... Sales will be given a prior copy"
            // Implies Sales users exist. They should be created in the Main App.
            // But if I want to allow auto-provisioning here too?
            // For now, allow generic login but with 'client' role if not found?
            // Actually, best to strictly mirror the main app logic:
            // "New User -> Provision as 'client'"
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
                const role = await getUserRole(user.email)
                token.role = role
            }
            return token
        },
        async session({ session, token }) {
            if (session.user && token.role) {
                // @ts-expect-error - extending session type
                session.user.role = token.role
            }
            return session
        },
    },
    pages: {
        signIn: '/login',
    }
})
