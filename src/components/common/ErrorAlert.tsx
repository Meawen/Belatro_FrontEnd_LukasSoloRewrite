import React from 'react';
import { PixelIcon } from '../ui/PixelIcon';

export interface ErrorAlertProps {
    message: string | null;
    className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, className }) => {
    if (!message) return null;

    const classes = [
        'flex items-start gap-2 notch bg-surface text-danger-text t-callout px-3 py-2 shadow-[inset_3px_0_0_var(--danger)]',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div role="alert" className={classes}>
            <PixelIcon name="warning" className="mt-0.5" />
            <span>{message}</span>
        </div>
    );
};
