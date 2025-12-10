'use server'

import { addUser, removeUser, UserRole } from "@/lib/user-store";
import { revalidatePath } from "next/cache";

export async function addUserAction(formData: FormData) {
    const email = formData.get('email') as string;
    const role = formData.get('role') as UserRole;
    const name = formData.get('name') as string;

    if (!email || !role) {
        throw new Error("Missing required fields");
    }

    await addUser({ email, role, name });
    revalidatePath('/admin-dashboard');
}

export async function removeUserAction(formData: FormData) {
    const email = formData.get('email') as string;

    if (!email) return;

    await removeUser(email);
    revalidatePath('/admin-dashboard');
}
