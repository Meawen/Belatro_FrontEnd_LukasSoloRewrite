import type { ReactNode } from 'react';
import type { Boja } from '../../types/game';
import { cx } from './cx';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './icons';
import { SuitIcon } from './SuitIcon';

export type ChipTone = 'neutral' | 'mode' | 'team-a' | 'team-b' | 'you' | 'win' | 'bad' | 'warn' | 'trump';

export interface ChipProps {
    tone?: ChipTone;
    /** The suit of a 'trump' chip. */
    suit?: Boja;
    icon?: IconName;
    children: ReactNode;
    className?: string;
    title?: string;
}

// Every pair is in the token test (src/test/tokens.test.ts)
const TONE: Record<Exclude<ChipTone, 'trump'>, string> = {
    neutral: 'bg-surface-2 text-text-2',
    mode: 'bg-surface-2 text-accent',
    'team-a': 'bg-team-a text-ink',
    'team-b': 'bg-team-b text-ink',
    you: 'bg-accent text-ink',
    win: 'bg-success text-ink',
    bad: 'bg-danger-fill text-text',
    warn: 'bg-warn-fill text-text',
};

// --text on herc and pik, --ink on karo and tref (spec §3.2)
const TRUMP: Record<Boja, string> = {
    HERC: 'bg-suit-herc text-text',
    KARA: 'bg-suit-karo text-ink',
    PIK: 'bg-suit-pik text-text',
    TREF: 'bg-suit-tref text-ink',
};

function toneClasses(tone: ChipTone, suit: Boja | undefined): string {
    return tone === 'trump' && suit ? TRUMP[suit] : TONE[tone === 'trump' ? 'neutral' : tone];
}

function Content({ tone, suit, icon, children }: ChipProps) {
    return (
        <>
            {tone === 'trump' && suit && <SuitIcon boja={suit} />}
            {icon && <PixelIcon name={icon} />}
            <span>{children}</span>
        </>
    );
}

/** A static 28-px notched label in caption type (spec §3.7). */
export function Chip({ tone = 'neutral', className, title, ...rest }: ChipProps) {
    return (
        <span title={title} className={cx('ui-chip inline-flex h-7 items-center gap-1.5 px-2.5 notch t-caption', toneClasses(tone, rest.suit), className)}>
            <Content tone={tone} {...rest} />
        </span>
    );
}

/** A compact 20-px notched tag in caption type (spec §3.7): ILLEGAL, PADANJE, CAPOT, YOU, TRUMP. */
export function Tag({ tone = 'neutral', className, title, ...rest }: ChipProps) {
    return (
        <span title={title} className={cx('ui-tag inline-flex h-5 items-center gap-1 px-1.5 notch t-caption', toneClasses(tone, rest.suit), className)}>
            <Content tone={tone} {...rest} />
        </span>
    );
}
