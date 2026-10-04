import React from 'react';

export interface ErrorAlertProps {
    message: string | null;
    className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, className }) => {
    if (!message) return null;

    const classes = [
        'text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div role="alert" className={classes}>
            {message}
        </div>
    );
};
