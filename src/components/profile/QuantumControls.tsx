import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface QuantumInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export function QuantumInput({ label, className, ...props }: QuantumInputProps) {
    return (
        <div className="space-y-1.5 w-full">
            {label && <label className="block text-xs font-medium text-slate-400">{label}</label>}
            <input
                className={cn(
                    "w-full bg-slate-950 border border-white/10 rounded-md text-slate-200 text-base md:text-sm px-3 py-2 min-h-[44px] md:min-h-[auto] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-600 font-sans",
                    className
                )}
                autoComplete="off"
                {...props}
            />
        </div>
    );
}

interface QuantumSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: { value: string; label: string }[];
}

export function QuantumSelect({ label, options, className, value, onChange, ...props }: QuantumSelectProps) {
    return (
        <div className="space-y-1.5 w-full">
            {label && <label className="block text-xs font-medium text-slate-400">{label}</label>}
            <div className="relative">
                <select
                    className={cn(
                        "w-full bg-slate-950 border border-white/10 rounded-md text-slate-200 text-base md:text-sm px-3 py-2 min-h-[44px] md:min-h-[auto] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 appearance-none cursor-pointer font-sans",
                        className
                    )}
                    value={value}
                    onChange={onChange}
                    {...props}
                >
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-300">
                            {opt.label}
                        </option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                    ▼
                </div>
            </div>
        </div>
    );
}

interface QuantumColorPickerProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
}

export function QuantumColorPicker({ label, value, onChange }: QuantumColorPickerProps) {
    return (
        <div className="flex flex-col items-center gap-2">
            <label className="text-[10px] text-slate-500 font-medium text-center">{label}</label>
            <div className="relative group">
                <div
                    className="w-11 h-11 md:w-10 md:h-10 rounded-full cursor-pointer shadow-sm transition-transform group-hover:scale-105 border border-white/10"
                    style={{ backgroundColor: value }}
                >
                    <input
                        type="color"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="opacity-0 w-full h-full cursor-pointer absolute inset-0 min-h-[44px] min-w-[44px]"
                    />
                </div>
            </div>
            <div className="text-[10px] font-mono text-slate-500">{value}</div>
        </div>
    );
}

interface QuantumTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
}

export function QuantumTextArea({ label, className, ...props }: QuantumTextAreaProps) {
    return (
        <div className="space-y-1.5 group">
            {label && <label className="block text-xs font-medium text-slate-400 group-focus-within:text-blue-400 transition-colors">{label}</label>}
            <textarea
                className={cn(
                    "w-full bg-slate-950 border border-white/10 rounded-md text-slate-200 text-base md:text-sm px-3 py-2 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-700 min-h-[100px] resize-y font-sans",
                    className
                )}
                autoComplete="off"
                {...props}
            />
        </div>
    );
}

interface QuantumButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    isLoading?: boolean;
    icon?: React.ReactNode;
}

export function QuantumButton({ children, variant = 'primary', isLoading, icon, className, ...props }: QuantumButtonProps) {
    const variants = {
        primary: "bg-blue-600 text-white border border-blue-500 hover:bg-blue-500 shadow-sm",
        secondary: "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700",
        danger: "bg-red-900/50 text-red-200 border border-red-500/30 hover:bg-red-900/70",
        ghost: "bg-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
    };

    return (
        <button
            className={cn(
                "relative h-11 md:h-10 px-4 py-2 font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 rounded-md overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed",
                variants[variant],
                className
            )}
            disabled={isLoading || props.disabled}
            {...props}
        >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {!isLoading && icon}
            {children}
        </button>
    );
}
