
import { signIn } from "@/auth"

export default function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
            <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold text-slate-900">Mining Sim Login</h1>
                    <p className="text-sm text-slate-500">Sign in to access the dashboard</p>
                </div>
                <form
                    action={async () => {
                        "use server"
                        await signIn("google", { redirectTo: "/" })
                    }}
                >
                    <button
                        type="submit"
                        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Sign in with Google
                    </button>
                </form>
            </div>
        </div>
    )
}
