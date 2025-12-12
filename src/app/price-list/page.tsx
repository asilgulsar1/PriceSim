import { PriceListGenerator } from "@/components/PriceListGenerator";
import { auth } from "@/auth";

export default async function PriceListPage() {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    const resellerMargin = (session?.user as any)?.resellerMargin;
    const branding = (session?.user as any)?.branding;

    return (
        <div className="container mx-auto py-8">
            <PriceListGenerator
                userRole={userRole}
                resellerMargin={resellerMargin}
                branding={branding}
            />
        </div>
    );
}
