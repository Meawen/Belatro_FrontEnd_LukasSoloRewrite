import { cx } from '../ui/cx';

export interface WordmarkProps {
    /** Just the "S" (the 72-px sidebar); screen readers still hear "Stiglja". */
    compact?: boolean;
    /** Size and placement, e.g. `t-title` or `t-display`. */
    className?: string;
}

/** "Stiglja" in the pixel face (D-2), in the accent. */
export function Wordmark({ compact = false, className }: WordmarkProps) {
    return (
        <span className={cx('font-pix leading-none text-accent', className)}>
            {compact ? (
                <>
                    <span aria-hidden="true">S</span>
                    <span className="sr-only">Stiglja</span>
                </>
            ) : (
                'Stiglja'
            )}
        </span>
    );
}
