import { auth, signOut } from "@/auth"
import { getLatestBrief, getSalesProgress } from "@/lib/blob-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { redirect } from "next/navigation"
import { QuizModal } from "@/components/quiz-modal"
import Link from "next/link"
// Mock questions for the presentation. In real app, fetch from Blob/formatted report.
const MOCK_QUESTIONS = [
    { question: "What was the main driver of Bitcoin price this week?", options: ["ETF Flows", "Halving", "Interest Rates", "Mining Difficulty"], answerIndex: 0 },
    { question: "Which miner is currently the most profitable?", options: ["S19 XP", "S21", "M50", "T21"], answerIndex: 1 },
    { question: "What is the recommended sales pitch for undecided clients?", options: ["Wait for dip", "Buy now before difficulty jump", "Switch to Altcoins", "Sell existing hardware"], answerIndex: 1 },
    { question: "How did energy prices effect profitability?", options: ["No effect", "Increased margins", "Decreased margins", "Stabilized"], answerIndex: 2 },
    { question: "What is the new projected ROI for S21?", options: ["90 days", "180 days", "360 days", "500 days"], answerIndex: 2 },
    { question: "Which major institution recently bought BTC?", options: ["Tesla", "MicroStrategy", "Apple", "Amazon"], answerIndex: 1 },
    { question: "What is the current network difficulty?", options: ["80 T", "100 T", "120 T", "90 T"], answerIndex: 0 },
    { question: "Describe the 'Treasury' strategy update.", options: ["Hold USD", "Convert 100% to BTC", "Diversify to ETH", "Sell calls"], answerIndex: 1 },
    { question: "What is the fee structure change?", options: ["None", "Increased to 25%", "Decreased to 15%", "Dynamic"], answerIndex: 0 },
    { question: "Who should be targeted for the 'Scale' pitch?", options: ["Retail", "Institutional with >1MW", "Home miners", "Gamers"], answerIndex: 1 },
];

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.email) redirect("/login");

    const brief = await getLatestBrief();
    const progress = await getSalesProgress(session.user.email);

    // Simulate current week logic
    const reportId = "2025-W50";
    const isPassed = progress?.completedReports.includes(reportId);

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <header className="mb-10 flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Sales Dashboard</h1>
                        <p className="text-slate-500 mt-2 text-lg">Daily Intelligence & Performance Tracking</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/news">
                            <Button variant="outline" className="border-blue-200 hover:bg-blue-50 hover:text-blue-900">
                                📰 News Intelligence
                            </Button>
                        </Link>
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-medium text-slate-900">{session.user.name}</p>
                            <p className="text-xs text-slate-500">{session.user.email}</p>
                        </div>
                        <form action={async () => {
                            "use server"
                            await signOut()
                        }}>
                            <Button variant="outline" className="border-slate-200 hover:bg-slate-100 hover:text-slate-900">Sign Out</Button>
                        </form>
                    </div>
                </header>

                <div className="grid gap-8 lg:grid-cols-3">
                    {/* Daily Brief Section - Spans 2 cols */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="h-[700px] flex flex-col shadow-xl border-0 ring-1 ring-slate-900/5 bg-white/80 backdrop-blur-sm">
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-2xl text-slate-800">Daily Market Brief</CardTitle>
                                        <CardDescription className="text-slate-500 mt-1">Talking points generated for {new Date().toLocaleDateString()}</CardDescription>
                                    </div>
                                    {brief && <Badge className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">Latest</Badge>}
                                </div>
                            </CardHeader>
                            <Separator className="bg-slate-100" />
                            <ScrollArea className="flex-1 p-6">
                                {brief ? (
                                    <div className="space-y-6 animate-in fade-in duration-500">
                                        {brief.topMiner && (
                                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 shadow-sm">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h3 className="font-bold text-blue-900 flex items-center gap-2">
                                                        <span className="text-xl">🚀</span> Top Performer
                                                    </h3>
                                                    <Badge variant="outline" className="bg-white text-blue-700 border-blue-200">
                                                        {brief.topMiner.name}
                                                    </Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 mt-4">
                                                    <div>
                                                        <p className="text-xs text-blue-500 uppercase font-semibold">Daily Revenue</p>
                                                        <p className="text-lg font-bold text-blue-900">${brief.topMiner.dailyRevenue.toFixed(2)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-blue-500 uppercase font-semibold">Miner Score</p>
                                                        <p className="text-lg font-bold text-blue-900">98/100</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}


                                        {brief.talkingPoints && brief.talkingPoints.length > 0 && (
                                            <div className="space-y-4">
                                                <h3 className="font-bold text-slate-800 text-lg mb-4">🎯 Sales Ammunition</h3>
                                                {brief.talkingPoints.map((point, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`p-5 rounded-xl border-l-4 ${point.angle === 'FUD_FIGHTER' ? 'bg-red-50 border-red-500' :
                                                            point.angle === 'FOMO_INDUCER' ? 'bg-green-50 border-green-500' :
                                                                'bg-blue-50 border-blue-500'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-xl">
                                                                {point.angle === 'FUD_FIGHTER' ? '🛡️' :
                                                                    point.angle === 'FOMO_INDUCER' ? '🚀' : '⛏️'}
                                                            </span>
                                                            <h4 className="font-bold text-slate-800">{point.title}</h4>
                                                        </div>
                                                        <p className="text-slate-700 leading-relaxed">{point.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="prose prose-slate max-w-none">
                                            <div className="whitespace-pre-wrap leading-relaxed text-slate-700 text-base">
                                                {brief.content}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                                        <div className="bg-slate-50 p-4 rounded-full mb-4">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
                                        </div>
                                        <p className="font-medium text-slate-600">No brief available yet</p>
                                        <p className="text-sm mt-2">The AI is gathering market data...</p>
                                        <p className="text-xs mt-4 bg-slate-100 px-3 py-1 rounded-full">Next update in ~4 hours</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </Card>
                    </div>

                    {/* Sidebar Section */}
                    <div className="space-y-8">
                        {/* Quiz Section */}
                        <Card className="shadow-lg border-0 ring-1 ring-slate-900/5 overflow-hidden">
                            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-1 h-2 w-full"></div>
                            <CardHeader>
                                <CardTitle className="text-slate-800">Weekly Certification</CardTitle>
                                <CardDescription>Week 50 • Mandatory</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="font-semibold text-slate-700 text-sm">Market Report PDF</span>
                                        <Badge variant="outline" className="bg-white">10 Pages</Badge>
                                    </div>
                                    <a href={`/api/reports/download?id=${reportId}`} target="_blank" rel="noopener noreferrer" className="w-full">
                                        <Button variant="outline" className="w-full bg-white hover:bg-slate-50 text-slate-600 border-slate-200">
                                            Download PDF
                                        </Button>
                                    </a>
                                </div>

                                <div className={`p-4 rounded-lg border ${isPassed ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'
                                    }`}>
                                    <div className="flex justify-between items-center mb-4">
                                        <span className={`font-semibold text-sm ${isPassed ? 'text-green-800' : 'text-orange-800'}`}>
                                            Quiz Status
                                        </span>
                                        {isPassed ? (
                                            <Badge className="bg-green-500 hover:bg-green-600">Passed</Badge>
                                        ) : (
                                            <Badge className="bg-orange-500 hover:bg-orange-600">Pending</Badge>
                                        )}
                                    </div>

                                    {isPassed ? (
                                        <div className="text-center py-2 text-green-700 font-medium text-sm">
                                            ✓ Access Granted
                                        </div>
                                    ) : (
                                        <div className="w-full">
                                            <QuizModal questions={MOCK_QUESTIONS} reportId={reportId} />
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* CRM Section */}
                        <Card className="shadow-md border-0 ring-1 ring-slate-900/5">
                            <CardHeader>
                                <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                                    CRM Sync
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg border border-slate-100">
                                    All systems operational. Pipedrive is being monitored for stale deals automatically.
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
