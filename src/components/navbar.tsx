import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Navbar() {
    return (
        <nav className="border-b bg-background">
            <div className="flex h-16 items-center px-4 container mx-auto">
                <div className="mr-8 font-bold text-xl">
                    Mining Sim
                </div>
                <div className="flex items-center space-x-6 text-sm font-medium">
                    <Link
                        href="/"
                        className={cn(
                            "transition-colors hover:text-foreground/80",
                            // Since we don't have usePathname hook usage here yet (it requires client component), 
                            // let's just make simple links for now. 
                            // Or better, make this a client component if we want active states.
                            // For simplicity and robustness, standard links are fine.
                            "text-foreground"
                        )}
                    >
                        Mining Calculator
                    </Link>
                    <Link
                        href="/treasury"
                        className={cn(
                            "transition-colors hover:text-foreground/80",
                            "text-foreground"
                        )}
                    >
                        Treasury Calculator
                    </Link>
                    <Link
                        href="/price-simulator"
                        className={cn(
                            "transition-colors hover:text-foreground/80",
                            "text-foreground"
                        )}
                    >
                        Price Simulator
                    </Link>
                </div>
            </div>
        </nav>
    );
}
