'use server'

import { addUser, removeUser, updateUser, UserRole } from "@/lib/user-store";
import { revalidatePath } from "next/cache";

export async function addUserAction(formData: FormData) {
    const email = formData.get('email') as string;
    const role = formData.get('role') as UserRole;
    const name = formData.get('name') as string;
    const marginRaw = formData.get('resellerMargin');

    // Default margin is 500 if not provided, but we only store if it's explicitly set or we want to enforce it?
    // Let's store it if provided.
    let resellerMargin: number | undefined = undefined;
    if (marginRaw) {
        resellerMargin = Number(marginRaw);
    }

    if (!email || !role) {
        throw new Error("Missing required fields");
    }

    await addUser({ email, role, name, resellerMargin });
    revalidatePath('/admin-dashboard');
}

export async function removeUserAction(formData: FormData) {
    const email = formData.get('email') as string;

    if (!email) return;

    await removeUser(email);
    revalidatePath('/admin-dashboard');
}

export async function updateUserMarginAction(email: string, margin: number) {
    if (!email) throw new Error("Email is required");

    await updateUser(email, { resellerMargin: margin });
    revalidatePath('/admin-dashboard');
}
