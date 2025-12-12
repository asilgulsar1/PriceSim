import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/user-store";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage(props: { searchParams: Promise<{ success?: string }> }) {
    const searchParams = await props.searchParams;
    const session = await auth();

    if (!session?.user?.email) {
        redirect("/api/auth/signin");
    }

    const user = await getUser(session.user.email);
    const branding = user?.branding || {};
    const aiUsage = user?.aiUsage || { dailyLimit: 5, usedToday: 0, lastResetDate: new Date().toISOString() };
    const successMsg = searchParams.success ? "Branding settings updated successfully." : undefined;

    return (
        <ProfileForm
            key={JSON.stringify(branding)} // NUCLEAR OPTION: Forces complete remount when data changes. Solves "Zombie State".
            branding={branding}
            aiUsage={aiUsage}
            savedTemplates={user?.savedTemplates || []}
            successMessage={successMsg}
        />
    );
}
