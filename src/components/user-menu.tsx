"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export function UserMenu() {
    const { data: session } = useSession();

    if (!session?.user) {
        return null;
    }

    // Cast user to any to access role for now
    const role = (session.user as any).role;

    return (
        <div className="flex items-center gap-4">
            {role === 'admin' && (
                <Link href="/admin-dashboard" className="text-sm font-medium text-foreground/60 hover:text-foreground/80">
                    Admin
                </Link>
            )}

            <div className="flex items-center gap-2">
                {session.user.image && (
                    <img
                        src={session.user.image}
                        alt={session.user.name || "User"}
                        className="w-8 h-8 rounded-full"
                    />
                )}
                <div className="text-sm">
                    <p className="font-medium leading-none">{session.user.name}</p>
                    <p className="text-xs text-muted-foreground">{session.user.email}</p>
                </div>
            </div>

            <button
                onClick={() => signOut()}
                className="text-sm text-red-500 hover:text-red-700 font-medium"
            >
                Sign Out
            </button>
        </div>
    );
}
