"use client";

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Calendar, FileText, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Wrap content in Suspense for useSearchParams
function RequestQuoteContent() {
    const searchParams = useSearchParams();
    const minerName = searchParams.get('miner') || 'Mining Hardware';
    const [submitted, setSubmitted] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleRequestInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);

        // Import dynamically or use standard import if at top level
        // For now assuming we add imports at top
        const { submitQuoteRequest } = await import('./actions');

        await submitQuoteRequest({
            minerName,
            companyName: formData.get('company') as string,
            vatId: formData.get('vat') as string,
            timestamp: new Date().toISOString()
        });

        setSubmitted(true);
        setIsSubmitting(false);
    };

    if (submitted) {
        return (
            <div className="container mx-auto py-12 max-w-md">
                <Card className="border-green-200 bg-green-50 shadow-lg">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-green-100 p-3 rounded-full w-fit mb-4">
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl text-green-800">Invoice Sent!</CardTitle>
                        <CardDescription className="text-green-700">
                            We've sent a proforma invoice to your email address.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-white p-4 rounded-lg border border-green-100">
                            <h3 className="font-semibold text-gray-900 mb-2">Bank Details for Transfer</h3>
                            <div className="text-sm text-gray-600 space-y-1">
                                <p><span className="font-medium">Bank:</span> Emirates NBD</p>
                                <p><span className="font-medium">Account Name:</span> Asil Gulsar General Trading LLC</p>
                                <p><span className="font-medium">IBAN:</span> AE00 0000 0000 0000 000</p>
                                <p><span className="font-medium">SWIFT:</span> EBBNAEAD</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <a href="https://calendly.com/" target="_blank" rel="noopener noreferrer" className="w-full block">
                                <Button className="w-full gap-2" variant="outline">
                                    <Calendar className="h-4 w-4" />
                                    Book a Setup Call
                                </Button>
                            </a>
                            <Link href="/market-prices">
                                <Button className="w-full" variant="ghost">Return to Market</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-12 max-w-lg">
            <Card>
                <CardHeader>
                    <CardTitle>Request Quote</CardTitle>
                    <CardDescription>
                        Complete your request for <strong>{minerName}</strong>.
                        We will generate an official invoice instantly.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleRequestInvoice}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="company">Company Name (Optional)</Label>
                            <Input id="company" name="company" placeholder="Enter company name" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vat">VAT / Tax ID (Optional)</Label>
                            <Input id="vat" name="vat" placeholder="Enter Tax ID" />
                        </div>
                        <div className="bg-muted p-4 rounded text-sm text-muted-foreground">
                            An invoice will be sent to your registered email address with payment instructions.
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3">
                        <Button type="submit" size="lg" className="w-full gap-2" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <FileText className="h-4 w-4" />
                                    Generate Invoice & Pay
                                </>
                            )}
                        </Button>
                        <div className="text-center text-xs text-muted-foreground">
                            By proceeding, you agree to our Terms of Service.
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}

export default function RequestQuotePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RequestQuoteContent />
        </Suspense>
    );
}
