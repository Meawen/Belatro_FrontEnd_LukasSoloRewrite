import type { ReactNode } from 'react';
import { cx } from './cx';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './icons';

export interface BannerProps {
    tone?: 'info' | 'warn' | 'danger';
    /** The region's accessible name (the shell's banners keep today's labels). */
    label: string;
    icon?: IconName;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}

/** A slim strip at the top of the content (spec §3.7), a labelled region. */
export function Banner({ tone = 'info', label, icon, action, children, className }: BannerProps) {
    return (
        <div role="region" aria-label={label} className={cx('ui-banner', `ui-banner--${tone}`, className)}>
            <PixelIcon name={icon ?? (tone === 'info' ? 'info' : 'warning')} className="shrink-0" />
            <div className="t-callout min-w-0 flex-1">{children}</div>
            {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
    );
}
