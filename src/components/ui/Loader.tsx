import { cx } from './cx';

export interface LoaderProps {
    /** Today's loading strings, kept exactly ("Loading lobby...", "Checking authentication..."). */
    text?: string;
    /** 'page': the full-height guard screen; 'block' (default): a list or panel; 'inline': within a line. */
    layout?: 'inline' | 'block' | 'page';
    className?: string;
}

/**
 * A blinking 12-px accent square (spec §3.7), a status indicator that may animate (§3.1); static under
 * reduced motion. No live-region role: the page's own status lines keep theirs.
 */
export function Loader({ text, layout = 'block', className }: LoaderProps) {
    return (
        <div className={cx('ui-loader', `ui-loader--${layout}`, className)}>
            <span className="ui-loader__square" aria-hidden="true" />
            {text && <span className="t-callout text-text-2">{text}</span>}
        </div>
    );
}
