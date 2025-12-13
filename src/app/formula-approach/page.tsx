import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FormulaApproachClient } from "@/components/formula-approach/FormulaApproachClient";

export default async function FormulaApproachPage() {
    const session = await auth();
    const role = (session?.user as { role?: string })?.role;

    if (role !== 'admin') {
        redirect('/price-list');
    }

    return <FormulaApproachClient />;
}
