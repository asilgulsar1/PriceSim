import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";
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

    return (
        <div className="container mx-auto py-10 max-w-2xl text-slate-900">
            <h1 className="text-3xl font-bold mb-8">User Profile</h1>

            {searchParams.success && (
                <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
                    <CheckCircle2 className="h-4 w-4" color="green" />
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>
                        Your branding settings have been updated successfully.
                    </AlertDescription>
                </Alert>
            )}

            <ProfileForm branding={branding} aiUsage={aiUsage} savedTemplates={user?.savedTemplates || []} />
        </div>
    );
}
