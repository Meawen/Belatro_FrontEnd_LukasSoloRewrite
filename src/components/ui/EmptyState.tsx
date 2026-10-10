import type { ReactNode } from 'react';
import { cx } from './cx';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './icons';

export interface EmptyStateProps {
    icon?: IconName;
    title: string;
    body?: ReactNode;
    action?: ReactNode;
    className?: string;
}

function StateBody({ icon, title, body, action, className, role }: EmptyStateProps & { role?: 'alert' }) {
    return (
        <div role={role} className={cx('flex flex-col items-center gap-3 px-4 py-10 text-center', className)}>
            {icon && <PixelIcon name={icon} scale={3} className="text-text-3" />}
            <p className="t-headline">{title}</p>
            {body && <p className="t-body max-w-prose text-text-2">{body}</p>}
            {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
        </div>
    );
}

/** Nothing to show yet (spec §3.7): a title, a line of help and the way forward. */
export function EmptyState(props: EmptyStateProps) {
    return <StateBody {...props} />;
}

/** A failed load (spec §3.7): an alert with the way to retry. */
export function ErrorState({ icon = 'warning', ...rest }: EmptyStateProps) {
    return <StateBody role="alert" icon={icon} {...rest} />;
}
