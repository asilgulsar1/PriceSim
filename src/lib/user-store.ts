import { list, put, del } from '@vercel/blob';

export type UserRole = 'admin' | 'sales' | 'client' | 'reseller';

export interface BrandingConfig {
    companyName?: string;
    logoUrl?: string;
    footerText?: string;
    colors?: {
        primary: string; // Hex
        secondary: string;
        accent: string;
    };
    customHeadings?: {
        mainHeading?: string;
        subHeading?: string;
        contentText?: string; // Main body text (AI enhanced)
    };
    // Template Metadata (for saved templates)
    id?: string;
    templateName?: string;
    createdAt?: string;
}

export interface AiUsage {
    dailyLimit: number;
    usedToday: number;
    lastResetDate: string; // ISO Date String YYYY-MM-DD
}

export interface User {
    email: string;
    role: UserRole;
    name?: string;
    resellerMargin?: number; // Markup in USD for Resellers
    branding?: BrandingConfig;
    savedTemplates?: BrandingConfig[]; // Max 10 templates
    aiUsage?: AiUsage; // New field for AI usage tracking
}

const USERS_DIR = 'users/';

// Helper to get the blob path for an email
function getUserPath(email: string): string {
    // Sanitize email to ensure valid path? Usually emails are fine as keys.
    return `${USERS_DIR}${email}.json`;
}

// Fetch all users by listing the directory and fetching each blob
export async function getUsers(): Promise<User[]> {
    try {
        const { blobs } = await list({ prefix: USERS_DIR });

        // Parallel fetch of all user files
        const users = await Promise.all(
            blobs.map(async (blob) => {
                try {
                    const response = await fetch(blob.url);
                    if (!response.ok) return null;
                    return (await response.json()) as User;
                } catch (e) {
                    console.error(`Failed to fetch user blob: ${blob.url}`, e);
                    return null;
                }
            })
        );

        // Filter out any failed fetches
        const validUsers = users.filter((u): u is User => u !== null);

        // If no users found (and not even legacy file exists presumably), 
        // fallback to bootstrap admin if env var is present
        if (validUsers.length === 0) {
            const adminEmail = process.env.ADMIN_EMAIL;
            if (adminEmail) {
                // Return it but don't save it yet? Or maybe just return it transiently.
                return [{ email: adminEmail, role: 'admin', name: 'Bootstrap Admin' }];
            }
        }

        return validUsers;
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
}

// No longer needed to save *all* users. We only save individual ones.
// export async function saveUsers(users: User[]) { ... }

export async function addUser(user: User) {
    if (!user.email) throw new Error('Email is required');

    // We can simply overwrite/put the file. 
    // This atomic operation avoids race conditions with other users.
    await put(getUserPath(user.email), JSON.stringify(user), {
        access: 'public',
        addRandomSuffix: false, // We WANT to determine the filename exactly
        token: process.env.BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true, // Explicitly allow updating THIS user
    });
}

export async function removeUser(email: string) {
    const path = getUserPath(email);
    // Delete the specific blob for this user
    await del(path, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
    });
}

export async function getUserRole(email: string): Promise<UserRole | null> {
    try {
        // Optimization: Try to list specifically this file or just fetch the URL constructed?
        // Since Vercel Blob URLs are predictable if we know the store ID... 
        // But we don't know the store ID easily without listing or caching it.
        // `list` is consistent. listing with prefix match is safest.

        // Actually, just calling getUsers() is fine for N < 100.
        // But for "best practice", let's try to find just this one.
        // We can't easily construct the full URL without the random store-id part unless we store it.
        // So listing with a specific prefix filter is the way.

        // Wait, `getUserPath` gives us the pathname, but `list` gives us the full `url`.
        // To generic fetch, we need the `url`. 
        // We can list with prefix = `users/<email>.json`? 
        const path = getUserPath(email);
        const { blobs } = await list({ prefix: path, limit: 1 });

        const blob = blobs.find(b => b.pathname === path);

        if (!blob) {
            // Fallback for bootstrap admin
            if (process.env.ADMIN_EMAIL === email) return 'admin';
            return null;
        }

        const response = await fetch(blob.url);
        if (!response.ok) return null;
        const user = (await response.json()) as User;
        return user.role;

    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
}

export async function getUser(email: string): Promise<User | null> {
    try {
        const path = getUserPath(email);
        const { blobs } = await list({ prefix: path, limit: 1 });
        const blob = blobs.find(b => b.pathname === path);

        if (!blob) {
            if (process.env.ADMIN_EMAIL === email) {
                return { email, role: 'admin', name: 'Admin' };
            }
            return null;
        }

        const response = await fetch(blob.url);
        if (!response.ok) return null;
        return (await response.json()) as User;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}
