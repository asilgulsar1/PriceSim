import { auth } from "@/auth"

export default auth((req) => {
    // middleware logic if needed, e.g. protecting routes
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
