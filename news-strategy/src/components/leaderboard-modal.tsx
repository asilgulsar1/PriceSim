"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Flame, Target } from "lucide-react";

interface AgentRank {
    email: string;
    points: number;
    streak: number;
    accuracy: number;
}

export function LeaderboardModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [leaders, setLeaders] = useState<AgentRank[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            fetchLeaderboard();
        }
    }, [isOpen]);

    const fetchLeaderboard = async () => {
        try {
            const res = await fetch('/api/gamification/leaderboard');
            if (res.ok) {
                const data = await res.json();
                setLeaders(data);
            }
        } catch (e) {
            console.error("Failed to fetch leaderboard", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md bg-slate-50">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                        <Trophy className="w-6 h-6 text-yellow-500" />
                        Sales Gym Leaderboard
                    </DialogTitle>
                    <DialogDescription>
                        Top performing agents based on consistency and mastery.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-[50px]">Rank</TableHead>
                                <TableHead>Agent</TableHead>
                                <TableHead className="text-right">Points</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center text-slate-500">
                                        Loading rankings...
                                    </TableCell>
                                </TableRow>
                            ) : leaders.map((agent, index) => (
                                <TableRow key={agent.email}>
                                    <TableCell className="font-bold text-slate-700">
                                        {index === 0 ? <Medal className="w-5 h-5 text-yellow-500" /> :
                                            index === 1 ? <Medal className="w-5 h-5 text-slate-400" /> :
                                                index === 2 ? <Medal className="w-5 h-5 text-orange-400" /> :
                                                    `#${index + 1}`}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-900">{agent.email.split('@')[0]}</span>
                                            <div className="flex gap-2 text-[10px] text-slate-500">
                                                <span className="flex items-center gap-0.5"><Flame className="w-3 h-3 text-orange-500" /> {agent.streak}d</span>
                                                <span className="flex items-center gap-0.5"><Target className="w-3 h-3 text-blue-500" /> {agent.accuracy.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-blue-600">
                                        {agent.points.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
