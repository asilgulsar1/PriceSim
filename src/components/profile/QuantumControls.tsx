import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Check } from 'lucide-react';

interface QuantumInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export function QuantumInput({ label, className, ...props }: QuantumInputProps) {
    return (
        <div className="space-y-1 group">
            {label && <label className="text-[10px] uppercase tracking-widest text-slate-500 font-mono group-focus-within:text-blue-400 transition-colors">{label}</label>}
            <input
                className={cn(
                    "w-full bg-transparent border-b border-slate-800 text-slate-200 font-mono text-sm py-2 px-0 focus:outline-none focus:border-blue-500 focus:shadow-[0_4px_12px_-4px_rgba(59,130,246,0.5)] transition-all placeholder:text-slate-700",
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
        <div className="space-y-1 group">
            {label && <label className="text-[10px] uppercase tracking-widest text-slate-500 font-mono group-focus-within:text-blue-400 transition-colors">{label}</label>}
            <div className="relative">
                <select
                    className={cn(
                        "w-full bg-transparent border-b border-slate-800 text-slate-200 font-mono text-sm py-2 px-0 focus:outline-none focus:border-blue-500 appearance-none rounded-none cursor-pointer hover:text-blue-300 transition-colors",
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
                <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
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
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-mono text-center">{label}</label>
            <div className="relative group">
                <div
                    className="w-10 h-10 rounded-full cursor-pointer shadow-lg transition-transform group-hover:scale-110 border border-white/10"
                    style={{
                        backgroundColor: value,
                        boxShadow: `0 0 20px ${value}40`
                    }}
                >
                    <input
                        type="color"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                    />
                </div>
            </div>
            <div className="text-[10px] font-mono text-slate-600">{value}</div>
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
        primary: "bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-600/40 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]",
        secondary: "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200",
        danger: "bg-red-900/20 text-red-400 border border-red-500/30 hover:bg-red-900/40",
        ghost: "bg-transparent text-slate-500 hover:text-slate-300"
    };

    return (
        <button
            className={cn(
                "relative h-10 px-4 py-2 font-mono text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 group overflow-hidden",
                variants[variant],
                className
            )}
            disabled={isLoading || props.disabled}
            {...props}
        >
            {/* Scanline Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />

            {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            {!isLoading && icon}
            {children}
        </button>
    );
}
