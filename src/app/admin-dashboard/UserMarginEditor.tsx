'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { updateUserMarginAction } from './actions';

interface UserMarginEditorProps {
    email: string;
    initialMargin: number;
}

export function UserMarginEditor({ email, initialMargin }: UserMarginEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(initialMargin.toString());
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSave = async () => {
        setIsLoading(true);
        setStatus('idle');
        try {
            await updateUserMarginAction(email, parseFloat(value));

            // Brief success state before closing
            setStatus('success');
            setTimeout(() => {
                setIsEditing(false);
                setStatus('idle');
            }, 1000);

        } catch (error) {
            console.error(error);
            setStatus('error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setValue(initialMargin.toString());
        setIsEditing(false);
        setStatus('idle');
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className={`w-24 h-8 text-sm ${status === 'error' ? 'border-red-500' : ''}`}
                    autoFocus
                />
                <Button
                    size="icon"
                    variant="ghost"
                    className={`h-8 w-8 ${status === 'success' ? 'text-green-600 bg-green-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}`}
                    onClick={handleSave}
                    disabled={isLoading || status === 'success'}
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleCancel}
                    disabled={isLoading}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 group">
            <span className="text-sm text-gray-700 dark:text-gray-300">
                ${initialMargin}
            </span>
            <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-700"
                onClick={() => setIsEditing(true)}
            >
                <Pencil className="h-3 w-3" />
            </Button>
        </div>
    );
}
