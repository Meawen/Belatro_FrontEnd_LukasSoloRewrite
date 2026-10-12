import type { ReactNode } from 'react';
import { Button } from './Button';
import { cx } from './cx';

export interface PagerProps {
    /** 0-based */
    page: number;
    hasNext: boolean;
    onPage: (page: number) => void;
    /** Shows "Page n of N" when known. */
    pageCount?: number;
    /** e.g. "· 10 matches per page" */
    note?: ReactNode;
    /** While a page loads: both buttons off. */
    disabled?: boolean;
    className?: string;
}

/** Previous / "Page n" / Next (spec §3.7). */
export function Pager({ page, hasNext, onPage, pageCount, note, disabled = false, className }: PagerProps) {
    return (
        <nav aria-label="Pagination" className={cx('flex flex-wrap items-center justify-center gap-3', className)}>
            <Button variant="secondary" size="sm" disabled={disabled || page <= 0} onClick={() => onPage(page - 1)}>
                Previous
            </Button>
            <span className="t-score">{pageCount ? `Page ${page + 1} of ${pageCount}` : `Page ${page + 1}`}</span>
            {note && <span className="t-footnote text-text-2">{note}</span>}
            <Button variant="secondary" size="sm" disabled={disabled || !hasNext} onClick={() => onPage(page + 1)}>
                Next
            </Button>
        </nav>
    );
}
