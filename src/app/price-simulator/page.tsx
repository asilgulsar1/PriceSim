import { PriceSimulator } from '@/components/PriceSimulator';
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function PriceSimulatorPage() {
    const session = await auth();
    const role = (session?.user as { role?: string })?.role;

    if (role !== 'admin') {
        redirect('/price-list');
    }

    return (
        <main className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Miner Pricing Simulator</h1>
                    <p className="text-muted-foreground">
                        Calculate required sales prices to achieve target profit margins for customers.
                    </p>
                </div>
                <PriceSimulator />
            </div>
        </main>
    );
}
