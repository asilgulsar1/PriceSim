import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { getUserRole } from "@/lib/user-store"

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [Google],
    callbacks: {
        async signIn({ user }) {
            if (!user.email) return false

            const role = await getUserRole(user.email)

            // If user has a valid role (admin or sales), allow sign in
            if (role) return true

            // Otherwise deny
            return false
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
                // We need to extend the session type, but for now we'll cast or just attach it
                // A proper TS setup would involve module augmentation
                (session.user as any).role = token.role
            }
            return session
        },
    },
    pages: {
        signIn: '/login', // We might create a custom login page, or use default
    }
})
