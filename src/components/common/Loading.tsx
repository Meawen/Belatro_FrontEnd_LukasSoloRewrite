import React from 'react';

export interface LoadingProps {
    size?: 'small' | 'medium' | 'large';
    color?: 'primary' | 'secondary' | 'white';
    text?: string;
    fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
                                                    size = 'medium',
                                                    color = 'primary',
                                                    text,
                                                    fullScreen = false,
                                                }) => {
    const sizeClasses = {
        small: 'w-4 h-4 border-2',
        medium: 'w-8 h-8 border-3',
        large: 'w-12 h-12 border-4'
    };

    const colorClasses = {
        primary: 'border-yellow-500',
        secondary: 'border-blue-500',
        white: 'border-white'
    };

    const spinnerClasses = [
        'rounded-full border-transparent border-t-current animate-spin',
        sizeClasses[size],
        colorClasses[color]
    ].join(' ');

    const containerClasses = [
        'flex flex-col items-center justify-center gap-4',
        fullScreen && 'fixed inset-0 bg-slate-900/80 z-50'
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={containerClasses}>
            <div className={spinnerClasses} />
            {text && <p className="text-sm text-slate-400 text-center">{text}</p>}
        </div>
    );
};