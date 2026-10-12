import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PixelIcon } from '../ui';
import { cx } from '../ui/cx';
import { usePageTitle } from '../../routing/usePageTitle';

export interface PageProps {
    /** The document title ("{title} · Stiglja", X-16) and, unless `heading` says otherwise, the h1. */
    title: string;
    /** The h1's text when it differs from `title` (Home's greeting); `null`: the content renders its own h1. */
    heading?: ReactNode;
    /** "‹ {label}" above the title, e.g. { to: '/lobbies', label: 'Lobbies' }. */
    back?: { to: string; label: string; state?: unknown };
    /** A line under the title: a count, chips. */
    meta?: ReactNode;
    /** Controls at the title's right: the page's primary action, a refresh icon button. */
    actions?: ReactNode;
    /** 'list' (default): 880 px for lists and details; 'read': 680 px for prose and forms (spec §3.4). */
    width?: 'list' | 'read';
    children: ReactNode;
}

/** The content frame of every page in the shell (spec §4.1): its width, its back link and its title. */
export function Page({ title, heading, back, meta, actions, width = 'list', children }: PageProps) {
    usePageTitle(title);
    const h1 = heading === undefined ? title : heading;
    return (
        <div className={cx('mx-auto pt-6 pb-10', width === 'read' ? 'max-w-[680px]' : 'max-w-[880px]')}>
            {back && (
                <Link
                    to={back.to}
                    state={back.state}
                    className="notch focus-inside press t-callout -ml-2 mb-2 inline-flex min-h-11 items-center gap-2 px-2 text-text-2 hover:text-text"
                >
                    <PixelIcon name="back" />
                    {back.label}
                </Link>
            )}
            {(h1 !== null || meta || actions) && (
                <header className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0">
                        {h1 !== null && <h1 className="t-display break-words">{h1}</h1>}
                        {meta && <div className="t-footnote mt-2 text-text-2">{meta}</div>}
                    </div>
                    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
                </header>
            )}
            {children}
        </div>
    );
}
