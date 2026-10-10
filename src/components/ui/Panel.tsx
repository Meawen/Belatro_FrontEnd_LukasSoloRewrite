import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export interface PanelProps extends HTMLAttributes<HTMLElement> {
    as?: 'div' | 'section' | 'article';
    /** none 0, md 16 px (default), lg 24 px */
    padding?: 'none' | 'md' | 'lg';
    /** 'accent' draws the edge in the accent (e.g. Home's "Return to your game" card). */
    edge?: 'default' | 'accent';
    children?: ReactNode;
}

const PADDING = { none: '', md: 'p-4', lg: 'p-6' } as const;

/** A panel (spec §3.7): --surface, a 3-px inset edge, notched. Not focusable. */
export function Panel({ as: Element = 'div', padding = 'md', edge = 'default', className, children, ...rest }: PanelProps) {
    return (
        <Element className={cx('ui-panel notch bg-surface', edge === 'accent' ? 'ui-panel--accent' : 'px-edge', PADDING[padding], className)} {...rest}>
            {children}
        </Element>
    );
}
