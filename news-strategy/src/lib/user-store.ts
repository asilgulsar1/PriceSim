import { list, put, del } from '@vercel/blob';

export type UserRole = 'admin' | 'sales' | 'client';

export interface User {
    email: string;
    role: UserRole;
    name?: string;
}

const USERS_DIR = 'users/';

function getUserPath(email: string): string {
    return `${USERS_DIR}${email}.json`;
}

export async function getUsers(): Promise<User[]> {
    try {
        const { blobs } = await list({ prefix: USERS_DIR, token: process.env.BLOB_READ_WRITE_TOKEN });
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
        const validUsers = users.filter((u): u is User => u !== null);
        if (validUsers.length === 0 && process.env.ADMIN_EMAIL) {
            return [{ email: process.env.ADMIN_EMAIL, role: 'admin', name: 'Bootstrap Admin' }];
        }
        return validUsers;
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
}

export async function addUser(user: User) {
    if (!user.email) throw new Error('Email is required');
    await put(getUserPath(user.email), JSON.stringify(user), {
        access: 'public',
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
    });
}

export async function removeUser(email: string) {
    await del(getUserPath(email), {
        token: process.env.BLOB_READ_WRITE_TOKEN,
    });
}

export async function getUserRole(email: string): Promise<UserRole | null> {
    try {
        const path = getUserPath(email);
        const { blobs } = await list({ prefix: path, limit: 1, token: process.env.BLOB_READ_WRITE_TOKEN });
        const blob = blobs.find(b => b.pathname === path);

        if (!blob) {
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
