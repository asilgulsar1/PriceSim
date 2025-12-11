"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Flame, Target, Users } from "lucide-react";
import { LeaderboardModal } from "@/components/leaderboard-modal";

interface Stats {
    currentStreak: number;
    points: number;
    accuracyScore: number;
    readingEfficiency: number;
}

export function GamificationHeader({ email }: { email: string }) {
    const [stats, setStats] = useState<Stats | null>(null);
    const [showLeaderboard, setShowLeaderboard] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/gamification/stats');
                if (res.ok) setStats(await res.json());
            } catch (e) {
                console.error("Failed to fetch gamification stats", e);
            }
        };
        fetchStats();
    }, [email]);

    if (!stats) return null;

    return (
        <div className="mb-6 animate-in slide-in-from-top-4 duration-700">
            <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />

            <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-none shadow-lg p-1">
                <div className="flex flex-col sm:flex-row items-center justify-between p-3 gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="p-2 bg-white/10 rounded-lg">
                            <Trophy className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sales Gym</h3>
                            <p className="font-bold text-lg leading-none">{stats.points.toLocaleString()} XP</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                            <Flame className={`w-4 h-4 ${stats.currentStreak > 0 ? 'text-orange-500 fill-orange-500' : 'text-slate-500'}`} />
                            <span className="font-mono font-bold">{stats.currentStreak}</span>
                            <span className="text-xs text-slate-400 hidden sm:inline">day streak</span>
                        </div>

                        <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                            <Target className="w-4 h-4 text-blue-400" />
                            <span className="font-mono font-bold">{stats.accuracyScore.toFixed(0)}%</span>
                            <span className="text-xs text-slate-400 hidden sm:inline">accuracy</span>
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-white hover:text-white hover:bg-white/10 h-8 px-2"
                            onClick={() => setShowLeaderboard(true)}
                        >
                            <Users className="w-4 h-4 mr-1.5" />
                            <span className="text-xs">Rankings</span>
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
