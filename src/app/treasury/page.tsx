import { TreasuryCalculator } from "@/components/TreasuryCalculator";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function TreasuryPage() {
    const session = await auth();
    const role = (session?.user as { role?: string })?.role;

    if (role !== 'admin') {
        redirect('/price-list');
    }

    return (
        <div className="container mx-auto py-6 md:py-10 px-4 md:px-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Treasury Simulator</h1>
                <p className="text-muted-foreground">
                    Analyze the profitability of the synthetic cloud mining model.
                </p>
            </div>
            <TreasuryCalculator />
        </div>
    );
}
