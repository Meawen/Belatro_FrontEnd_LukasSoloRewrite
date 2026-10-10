import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx } from './cx';
import { PixelIcon } from './PixelIcon';

interface ListRowBase {
    leading?: ReactNode;
    title: ReactNode;
    meta?: ReactNode;
    trailing?: ReactNode;
    /** Shown by default on button and link rows. */
    chevron?: boolean;
    /** A 4-px stripe on the left, e.g. a match's result. */
    stripe?: 'success' | 'danger' | 'accent';
    /** The accent edge, e.g. your own leaderboard row. */
    highlight?: boolean;
    className?: string;
    /** The accessible name of a button or link row, when its text alone would read badly. */
    'aria-label'?: string;
    /** A link row in a navigation list: the page it leads to is the one shown (spec §4.1). */
    'aria-current'?: 'page';
}

export type ListRowProps = ListRowBase &
    (
        | { as: 'button'; onClick: () => void; disabled?: boolean }
        | { as: 'link'; to: string; state?: unknown }
        | { as?: 'div' }
    );

/**
 * A list row (spec §3.7). A button or link row is one whole-row target with press feedback; a plain
 * row is static and keeps its own buttons in `trailing`. The notch sits on ::before (focus ring visible).
 */
export function ListRow(props: ListRowProps) {
    const { leading, title, meta, trailing, stripe, highlight, className } = props;
    const target = props.as === 'button' || props.as === 'link';
    const chevron = props.chevron ?? target;
    const classes = cx(
        'ui-row',
        target && 'ui-row--target',
        stripe && `ui-row--stripe-${stripe}`,
        highlight && 'ui-row--highlight',
        className,
    );
    const content = (
        <>
            {leading && <span className="flex shrink-0 items-center">{leading}</span>}
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="t-headline truncate">{title}</span>
                {meta && <span className="t-footnote text-text-2 truncate">{meta}</span>}
            </span>
            {trailing && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
            {chevron && <PixelIcon name="chevron" className="text-text-3" />}
        </>
    );
    if (props.as === 'button') {
        return (
            <button type="button" className={classes} onClick={props.onClick} disabled={props.disabled} aria-label={props['aria-label']}>
                {content}
            </button>
        );
    }
    if (props.as === 'link') {
        return (
            <Link to={props.to} state={props.state} className={classes} aria-label={props['aria-label']} aria-current={props['aria-current']}>
                {content}
            </Link>
        );
    }
    return <div className={classes}>{content}</div>;
}
