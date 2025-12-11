import { auth } from "@/auth";
import { Newspaper, Info, Download, Archive, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDailyIndex } from "@/lib/news-engine/storage";
import { redirect } from "next/navigation";
import NewsClientPage from "./client-page";

export default async function NewsPage() {
    const session = await auth();
    if (!session?.user?.email) redirect("/login");

    const today = new Date().toISOString().split('T')[0];
    const newsIndex = await getDailyIndex(today);
    const items = newsIndex?.items || [];

    return <NewsClientPage items={items} email={session.user.email} />;
}

// ... existing NewsGrid ...


function NewsGrid({ items, category }: { items: any[], category: string }) {
    if (items.length === 0) {
        return (
            <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
                <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Info className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 text-lg">Multi-source market intelligence • Updated every 30m</p>
                <p className="text-slate-500 font-medium">No news items in this category yet.</p>
                <p className="text-sm text-slate-400 mt-2">Check back after the next update cycle (every 30 minutes)</p>
            </div>
        );
    }

    return (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item, idx) => (
                <Card
                    key={item.id}
                    className="group hover:shadow-2xl transition-all duration-300 border-slate-200 hover:border-blue-300 bg-white hover:-translate-y-1"
                >
                    <CardHeader className="pb-3">
                        <div className="flex gap-2 mb-3 flex-wrap">
                            <Badge
                                variant="outline"
                                className={`text - xs font - semibold ${item.category === 'Macro' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                    item.category === 'Crypto' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                        item.category === 'Mining' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            'bg-green-50 text-green-700 border-green-200'
                                    } `}
                            >
                                {item.category}
                            </Badge>
                            {item.tags?.map((tag: string) => (
                                <Badge
                                    key={tag}
                                    className={`text - xs font - medium ${tag.includes('Insti') ? 'bg-blue-500 text-white hover:bg-blue-600' :
                                        tag.includes('Social') || tag.includes('Crazy') ? 'bg-orange-500 text-white hover:bg-orange-600' :
                                            'bg-slate-500 text-white hover:bg-slate-600'
                                        } `}
                                    title={tag.includes('Insti') ? 'Institutional/Professional Source' : 'Social/Community Source'}
                                >
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                        <CardTitle className="text-base leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {item.title}
                        </CardTitle>
                        <CardDescription className="text-xs flex items-center gap-2 mt-2">
                            <span className="font-medium text-slate-700">{item.source}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500">{new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-600 line-clamp-3 mb-4 leading-relaxed">
                            {item.description || 'No description available.'}
                        </p>
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-semibold group-hover:gap-3 transition-all"
                        >
                            Read full article <ExternalLink className="w-4 h-4" />
                        </a>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
