import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            label,
            error,
            helperText,
            leftIcon,
            rightIcon,
            fullWidth = false,
            className = '',
            id,
            ...props
        },
        ref
    ) => {
        const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

        const inputClasses = [
            'input-field',
            leftIcon && 'pl-12',
            rightIcon && 'pr-12',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
            fullWidth && 'w-full',
            className,
        ]
            .filter(Boolean)
            .join(' ');

        return (
            <div className={`flex flex-col gap-2 ${fullWidth ? 'w-full' : ''}`}>
                {label && (
                    <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
                        {label}
                    </label>
                )}
                <div className="relative flex items-center">
                    {leftIcon && (
                        <span className="absolute left-4 flex items-center justify-center text-slate-400 pointer-events-none">
              {leftIcon}
            </span>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        className={inputClasses}
                        {...props}
                    />
                    {rightIcon && (
                        <span className="absolute right-4 flex items-center justify-center text-slate-400 pointer-events-none">
              {rightIcon}
            </span>
                    )}
                </div>
                {error && <span className="text-sm text-red-500">{error}</span>}
                {helperText && !error && <span className="text-sm text-slate-400">{helperText}</span>}
            </div>
        );
    }
);

Input.displayName = 'Input';