import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
    size?: 'small' | 'medium' | 'large';
    isLoading?: boolean;
    fullWidth?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
                                                  children,
                                                  variant = 'primary',
                                                  size = 'medium',
                                                  isLoading = false,
                                                  fullWidth = false,
                                                  leftIcon,
                                                  rightIcon,
                                                  disabled,
                                                  className = '',
                                                  ...props
                                              }) => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 border-0 rounded-lg font-semibold cursor-pointer transition-all duration-200 relative';

    const variantClasses = {
        primary: 'btn-primary',
        secondary: 'btn-secondary',
        danger: 'bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed',
        success: 'bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed',
        outline: 'bg-transparent border-2 border-slate-600 text-white hover:bg-slate-800 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed'
    };

    const sizeClasses = {
        small: 'px-4 py-2 text-sm',
        medium: 'px-6 py-3 text-base',
        large: 'px-8 py-4 text-lg'
    };

    const classes = [
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        isLoading && 'opacity-75 cursor-not-allowed',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <button
            className={classes}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin" />
                </div>
            )}
            <div className={`flex items-center gap-2 ${isLoading ? 'opacity-0' : ''}`}>
                {leftIcon && <span>{leftIcon}</span>}
                <span>{children}</span>
                {rightIcon && <span>{rightIcon}</span>}
            </div>
        </button>
    );
};