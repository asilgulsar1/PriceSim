import Link from "next/link";
import { ArrowLeft, FileText, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { listArchivedBriefs } from "@/lib/blob-store";

export const revalidate = 60; // Revalidate every minute

export default async function ArchivePage() {
    const archives = await listArchivedBriefs();

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <Link href="/dashboard/news" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Intelligence
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Intelligence Archive</h1>
                    <p className="text-slate-600 mt-2">Access historical daily briefings and reports.</p>
                </header>

                <div className="grid gap-4">
                    {archives.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200 text-slate-500">
                            No archives found yet.
                        </div>
                    ) : (
                        archives.map((item) => (
                            <Card key={item.id} className="flex flex-row items-center justify-between p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 rounded-lg">
                                        <FileText className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">
                                            Daily Intel: {item.id}
                                        </h3>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                            <Calendar className="w-3 h-3" />
                                            Generated: {new Date(item.date).toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                <a href={`/api/reports/daily?id=${item.id}`} target="_blank" rel="noopener noreferrer">
                                    <Button variant="outline" size="sm" className="gap-2">
                                        <Download className="w-4 h-4" />
                                        PDF
                                    </Button>
                                </a>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
