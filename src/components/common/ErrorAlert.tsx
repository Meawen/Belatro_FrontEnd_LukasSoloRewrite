import React, { type Ref } from 'react';
import { PixelIcon } from '../ui/PixelIcon';

export interface ErrorAlertProps {
    message: string | null;
    className?: string;
    /** Given, the alert can take focus (not in the tab order): a page moves focus to it when the focused control went away. */
    ref?: Ref<HTMLDivElement>;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, className, ref }) => {
    if (!message) return null;

    const classes = [
        'flex items-start gap-2 notch bg-surface text-danger-text t-callout px-3 py-2 shadow-[inset_3px_0_0_var(--danger)]',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div ref={ref} role="alert" tabIndex={ref ? -1 : undefined} className={classes}>
            <PixelIcon name="warning" className="mt-0.5" />
            <span>{message}</span>
        </div>
    );
};
