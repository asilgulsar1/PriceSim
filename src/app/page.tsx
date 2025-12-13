import Dashboard from '@/components/dashboard';
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;

  // Strict Routing for Root Path
  if (role === 'admin') {
    // Check if we want them on dashboard or admin-dashboard.
    // Middleware sends admin to /admin-dashboard usually.
    // But if they land here, let's show the Simulator (Dashboard).
    return (
      <main className="min-h-screen bg-background">
        <Dashboard />
      </main>
    );
  }

  // Everyone else (Sales, Reseller, Client, unauth) -> Price List
  redirect('/price-list');
}
