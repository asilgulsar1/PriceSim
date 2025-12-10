import Link from 'next/link';
import { cn } from '@/lib/utils';
import { UserMenu } from '@/components/user-menu';


export function Navbar() {
    return (
        <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="flex h-16 items-center px-4 container mx-auto justify-between">
                <div className="flex items-center gap-8">
                    <Link href="/" className="font-bold text-xl tracking-tight">
                        Mining Sim
                    </Link>
                    <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
                        <Link
                            href="/price-simulator"
                            className={cn(
                                "transition-colors hover:text-foreground/80 text-foreground/60"
                            )}
                        >
                            Price Simulator
                        </Link>
                        <Link
                            href="/price-list"
                            className={cn(
                                "transition-colors hover:text-foreground/80 text-foreground/60"
                            )}
                        >
                            Price List
                        </Link>
                        <Link
                            href="/treasury"
                            className={cn(
                                "transition-colors hover:text-foreground/80 text-foreground/60"
                            )}
                        >
                            Treasury
                        </Link>
                    </div>
                </div>
                <UserMenu />
            </div>
        </nav>
    );
}
