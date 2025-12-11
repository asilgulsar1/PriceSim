'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';

interface Question {
    question: string;
    options: string[];
    answerIndex: number; // In real app, might hide this from client, but for simplicity here we keep it or validate server side. 
    // Ideally: Client sends answers, server validates.
}

interface QuizModalProps {
    questions: Question[];
    reportId: string;
}

export function QuizModal({ questions, reportId }: QuizModalProps) {
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [submitting, setSubmitting] = useState(false);
    const [open, setOpen] = useState(false);
    const [score, setScore] = useState<number | null>(null);

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            // Validate client side first?
            let correctCount = 0;
            questions.forEach((q, idx) => {
                if (answers[idx] === q.answerIndex) correctCount++;
            });

            const passed = correctCount >= questions.length * 0.8; // 80% pass

            const res = await fetch('/api/sales/submit-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId, answers, passed })
            });

            if (res.ok) {
                setScore(correctCount);
                if (passed) {
                    // Refresh page after delay
                    setTimeout(() => window.location.reload(), 2000);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    if (score !== null) {
        const passed = score >= questions.length * 0.8;
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button>Take Quiz</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{passed ? 'Congratulations! 🎉' : 'Quiz Failed'}</DialogTitle>
                        <DialogDescription>
                            You scored {score}/{questions.length}.
                            {passed ? ' Sales scripts unlocked.' : ' Please review the report and try again.'}
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Take Quiz</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Weekly Market Certification</DialogTitle>
                    <DialogDescription>
                        Answer 10 questions to prove your knowledge of this week's market update.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {questions.map((q, qIdx) => (
                        <div key={qIdx} className="space-y-3">
                            <h3 className="font-medium text-sm">{qIdx + 1}. {q.question}</h3>
                            <RadioGroup
                                onValueChange={(val) => setAnswers(prev => ({ ...prev, [qIdx]: parseInt(val) }))}
                            >
                                {q.options.map((opt, oIdx) => (
                                    <div key={oIdx} className="flex items-center space-x-2">
                                        <RadioGroupItem value={oIdx.toString()} id={`q${qIdx}-o${oIdx}`} />
                                        <Label htmlFor={`q${qIdx}-o${oIdx}`}>{opt}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>
                    ))}
                </div>

                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={Object.keys(answers).length < questions.length || submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Answers
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
