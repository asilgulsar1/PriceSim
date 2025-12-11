import Link from 'next/link';
import { cn } from '@/lib/utils';
import { UserMenu } from '@/components/user-menu';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";


export function Navbar() {
    return (
        <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="flex h-16 items-center px-4 container mx-auto justify-between">
                <div className="flex items-center gap-8">
                    {/* Mobile Menu */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left">
                            <SheetHeader>
                                <SheetTitle className="text-left">Mining Sim</SheetTitle>
                            </SheetHeader>
                            <div className="flex flex-col gap-4 mt-8">
                                <Link
                                    href="/"
                                    className="text-foreground/60 hover:text-foreground transition-colors"
                                >
                                    Home
                                </Link>
                                <Link
                                    href="/price-simulator"
                                    className="text-foreground/60 hover:text-foreground transition-colors"
                                >
                                    Price Simulator
                                </Link>
                                <Link
                                    href="/price-list"
                                    className="text-foreground/60 hover:text-foreground transition-colors"
                                >
                                    Price List
                                </Link>
                                <Link
                                    href="/treasury"
                                    className="text-foreground/60 hover:text-foreground transition-colors"
                                >
                                    Treasury
                                </Link>
                                <Link
                                    href="/market-prices"
                                    className="text-foreground/60 hover:text-foreground transition-colors"
                                >
                                    Market Prices
                                </Link>
                            </div>
                        </SheetContent>
                    </Sheet>

                    <Link href="/" className="font-bold text-xl tracking-tight hidden md:block">
                        Mining Sim
                    </Link>
                    <Link href="/" className="font-bold text-xl tracking-tight md:hidden">
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
                        <Link
                            href="/market-prices"
                            className={cn(
                                "transition-colors hover:text-foreground/80 text-foreground/60"
                            )}
                        >
                            Market Prices
                        </Link>
                    </div>
                </div>
                <UserMenu />
            </div>
        </nav>
    );
}
