import { TreasuryCalculator } from "@/components/TreasuryCalculator";

export default function TreasuryPage() {
    return (
        <div className="container mx-auto py-10 px-4">
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
