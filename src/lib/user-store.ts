import { list, put } from '@vercel/blob';

export type UserRole = 'admin' | 'sales';

export interface User {
    email: string;
    role: UserRole;
    name?: string;
}

const USERS_FILE_PATH = 'users.json';

// Helper to fetch the users list (or empty list if not initializing)
export async function getUsers(): Promise<User[]> {
    try {
        const { blobs } = await list({ prefix: USERS_FILE_PATH });
        const userBlob = blobs.find((blob) => blob.pathname === USERS_FILE_PATH);

        if (!userBlob) {
            // If no users file exists, and we have an ADMIN_EMAIL env var, return that as a bootstrap user
            const adminEmail = process.env.ADMIN_EMAIL;
            if (adminEmail) {
                return [{ email: adminEmail, role: 'admin', name: 'Bootstrap Admin' }];
            }
            return [];
        }

        const response = await fetch(userBlob.url);
        if (!response.ok) throw new Error('Failed to fetch user data');

        return await response.json();
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
}

export async function saveUsers(users: User[]) {
    await put(USERS_FILE_PATH, JSON.stringify(users), {
        access: 'public',
        addRandomSuffix: false, // Overwrites the file
        token: process.env.BLOB_READ_WRITE_TOKEN,
        // @ts-ignore - Vercel Blob types might be slightly outdated in this project
        allowOverwrite: true,
    });
}

export async function addUser(user: User) {
    const users = await getUsers();
    if (users.find((u) => u.email === user.email)) {
        throw new Error('User already exists');
    }
    users.push(user);
    await saveUsers(users);
}

export async function removeUser(email: string) {
    const users = await getUsers();
    const newUsers = users.filter((u) => u.email !== email);
    await saveUsers(newUsers);
}

export async function getUserRole(email: string): Promise<UserRole | null> {
    const users = await getUsers();
    const user = users.find((u) => u.email === email);
    return user ? user.role : null;
}
