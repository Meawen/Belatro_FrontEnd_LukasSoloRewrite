import { PlayingCard } from '../ui';
import type { GameCard } from '../../types/game';

/** A trick in the middle of the felt, west, north, east and south (AuthFrame's fan, laid on the table). */
const TRICK: { card: GameCard; className: string }[] = [
    { card: { boja: 'HERC', rank: 'AS' }, className: 'left-3 top-1/2 -translate-y-1/2 -rotate-6' },
    { card: { boja: 'PIK', rank: 'KRALJ' }, className: 'left-1/2 top-3 -translate-x-1/2' },
    { card: { boja: 'TREF', rank: 'DESETKA' }, className: 'right-3 top-1/2 -translate-y-1/2 rotate-6' },
    { card: { boja: 'KARA', rank: 'BABA' }, className: 'bottom-3 left-1/2 -translate-x-1/2' },
];

/**
 * The landing page's small pixel table (spec §4, option C): the felt with its wooden rim, as the ranked and lobby
 * tables draw it, and four cards played to the middle. Decorative, so hidden from assistive tech; the four images load
 * on their own, after the headline has painted.
 */
export function PixelTable() {
    return (
        <div
            aria-hidden="true"
            data-testid="landing-table"
            className="felt notch-6 relative h-[132px] w-[200px] shrink-0 self-center md:h-[156px] md:w-[232px]"
        >
            <div className="notch-6 pointer-events-none absolute inset-0 shadow-[inset_0_0_0_6px_var(--rim),inset_0_0_0_9px_var(--rim-hi)]" />
            {TRICK.map(({ card, className }) => (
                // the hard shadow on an unclipped wrapper (index.css "Pixel corners")
                <span key={card.boja} className={`px-shadow absolute ${className}`}>
                    <PlayingCard card={card} size="sheet" alt="" />
                </span>
            ))}
        </div>
    );
}
