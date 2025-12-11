"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, CheckCircle, XCircle, ArrowRight, Loader2, Trophy } from "lucide-react";
import confetti from "canvas-confetti";

interface Question {
    id: string;
    scenario: string;
    question: string;
    options: string[];
}

interface QuizData {
    completed: boolean;
    date?: string;
    questions?: Question[];
}

export function DailyQuizModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [answers, setAnswers] = useState<{ [key: string]: number }>({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ score: number, newStats: any, results: any[] } | null>(null);

    useEffect(() => {
        checkQuizStatus();
    }, []);

    const checkQuizStatus = async () => {
        try {
            const res = await fetch('/api/gamification/quiz/today');
            if (res.ok) {
                const data = await res.json();
                setQuiz(data);
                // Open modal only if not completed and we have questions
                if (!data.completed && data.questions && data.questions.length > 0) {
                    setIsOpen(true);
                }
            }
        } catch (e) {
            console.error("Failed to check quiz", e);
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = (optionIndex: number) => {
        if (!quiz?.questions) return;
        const currentQ = quiz.questions[currentQIndex];
        setAnswers(prev => ({ ...prev, [currentQ.id]: optionIndex }));
    };

    const handleNext = () => {
        if (!quiz?.questions) return;
        if (currentQIndex < quiz.questions.length - 1) {
            setCurrentQIndex(prev => prev + 1);
        } else {
            submitQuiz();
        }
    };

    const submitQuiz = async () => {
        if (!quiz?.date) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/gamification/quiz/submit', {
                method: 'POST',
                body: JSON.stringify({
                    date: quiz.date,
                    answers
                })
            });
            const data = await res.json();
            setResult(data);
            if (data.score >= 70) {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
        } catch (e) {
            console.error("Submit failed", e);
        } finally {
            setSubmitting(false);
        }
    };

    if (!quiz || quiz.completed) return null; // Don't render if done

    const currentQ = quiz.questions?.[currentQIndex];
    if (!currentQ && !result) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-2xl bg-slate-50">
                <DialogHeader>
                    <div className="flex justify-between items-center mb-2">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Brain className="w-6 h-6 text-blue-600" />
                            Daily Scenario Challenge
                        </DialogTitle>
                        <Badge variant="outline" className="bg-white">
                            {!result ? `Question ${currentQIndex + 1} of ${quiz.questions?.length}` : 'Results'}
                        </Badge>
                    </div>
                    {!result && (
                        <DialogDescription>
                            Read the scenario and choose the best sales response.
                        </DialogDescription>
                    )}
                </DialogHeader>

                {!result ? (
                    <div className="space-y-6 mt-4">
                        {/* Scenario Card */}
                        <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
                            <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-2">The Scenario</h4>
                            <p className="text-slate-800 font-medium text-lg leading-relaxed">
                                {currentQ?.scenario}
                            </p>
                        </div>

                        <div className="bg-slate-100 p-4 rounded-lg">
                            <p className="font-semibold text-slate-700">{currentQ?.question}</p>
                        </div>

                        <div className="grid gap-3">
                            {currentQ?.options.map((opt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer(idx)}
                                    className={`p-4 rounded-xl border-2 text-left transition-all relative
                                        ${answers[currentQ!.id] === idx
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md ring-1 ring-blue-500'
                                            : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                                        }`}
                                >
                                    <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
                                    {opt}
                                </button>
                            ))}
                        </div>

                        <DialogFooter className="mt-6">
                            <Button
                                onClick={handleNext}
                                disabled={answers[currentQ!.id] === undefined || submitting}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white"
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                {currentQIndex === (quiz.questions?.length || 0) - 1 ? 'Submit Answers' : 'Next Question'}
                                {!submitting && <ArrowRight className="w-4 h-4 ml-2" />}
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="text-center py-8 space-y-6 animate-in fade-in zoom-in duration-500">
                        <div className="relative inline-block">
                            <Trophy className={`w-20 h-20 mx-auto ${result.score >= 70 ? 'text-yellow-500' : 'text-slate-300'}`} />
                            {result.score >= 70 && (
                                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce">
                                    +{result.newStats?.points - (result.newStats?.points - 15) /* rough approx */} Pts
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 className="text-3xl font-black text-slate-900">{result.score.toFixed(0)}% Score</h3>
                            <p className="text-slate-500 mt-2">
                                {result.score === 100 ? "Perfect game! You're a machine! 🤖" :
                                    result.score >= 70 ? "Great work! Solid application." :
                                        "Good effort. Review the brief again."}
                            </p>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-4 text-left space-y-3 max-h-60 overflow-y-auto">
                            {result.results.map((r: any, idx: number) => (
                                <div key={idx} className="flex gap-3 text-sm">
                                    <div className="mt-1">
                                        {r.correct ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900">Q{idx + 1}: {r.correct ? "Correct" : "Incorrect"}</p>
                                        {!r.correct && (
                                            <p className="text-slate-500 mt-1">{r.explanation}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button onClick={() => setIsOpen(false)} className="w-full" variant="outline">
                            Close & Continue Reading
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
