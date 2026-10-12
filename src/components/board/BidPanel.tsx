import { m } from 'motion/react';
import { fade, spring } from '../../motion/tokens';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { Button } from '../ui/Button';
import { SuitIcon } from '../ui/SuitIcon';
import { BOJE, SUIT_LABEL } from '../game/gameView';
import type { BoardModel } from './model/boardModel';
import type { Boja } from '../../types/game';

const SUIT_FILL: Record<Boja, string> = { HERC: 'bg-suit-herc', KARA: 'bg-suit-karo', PIK: 'bg-suit-pik', TREF: 'bg-suit-tref' };

export interface BidPanelProps {
    model: BoardModel;
    onBid: (call: Boja | 'PASS') => void;
}

/**
 * The bid panel (spec §5.3.3, R-23): on my bidding turn, "Pass" and "Call Herc|Karo|Pik|Tref"; with
 * three passes on record the dealer can't pass (`dealer-must-call`). One bid in flight: the buttons
 * wait for the server's answer. Hovering a suit rings my cards of that suit (board.css, D-35).
 */
export function BidPanel({ model, onBid }: BidPanelProps) {
    const reduced = useReducedMotion();
    if (!model.canBid) return null;
    return (
        <m.div
            role="group"
            aria-label="Your bid"
            className="board-bid"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? fade : spring.quick}
        >
            <p className="board-bid__note t-footnote font-semibold">
                {model.dealerMustCall ? <span data-testid="dealer-must-call">The dealer must call trump</span> : 'Your bid'}
            </p>
            <div className="board-bid__buttons">
                <Button variant="secondary" disabled={!model.passEnabled} onClick={() => onBid('PASS')}>Pass</Button>
                {BOJE.map((boja) => (
                    <button
                        key={boja}
                        type="button"
                        data-suit={boja}
                        aria-label={`Call ${SUIT_LABEL[boja]}`}
                        disabled={!model.bidsEnabled}
                        className={`board-bid__suit press focus-inside ${SUIT_FILL[boja]}`}
                        onClick={() => onBid(boja)}
                    >
                        <SuitIcon boja={boja} size={2} />
                    </button>
                ))}
            </div>
        </m.div>
    );
}
