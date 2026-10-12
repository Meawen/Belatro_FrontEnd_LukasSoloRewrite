import { cx } from './cx';

export interface AvatarProps {
    /** A name or initial; the first character is shown, upper-cased. */
    initial: string;
    tone?: 'team-a' | 'team-b' | 'accent' | 'neutral';
    /** sm 28, md 36 (default), lg 52 (lobby seats), xl 64 (profile header) */
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const TONE = {
    'team-a': 'bg-team-a text-ink',
    'team-b': 'bg-team-b text-ink',
    accent: 'bg-accent text-ink',
    neutral: 'bg-surface-3 text-text',
} as const;

const SIZE = {
    sm: 'size-7 text-xs',
    md: 'size-9 text-sm',
    lg: 'size-13 text-xl',
    xl: 'size-16 text-2xl',
} as const;

/** The player's initial on a notched tile (spec §3.7, X-12); the name always sits beside it. */
export function Avatar({ initial, tone = 'neutral', size = 'md', className }: AvatarProps) {
    return (
        <span
            aria-hidden="true"
            className={cx('ui-avatar inline-flex shrink-0 items-center justify-center notch font-sys font-bold leading-none', TONE[tone], SIZE[size], className)}
        >
            {initial.trim().charAt(0).toUpperCase()}
        </span>
    );
}
