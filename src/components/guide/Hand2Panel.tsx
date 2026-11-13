import { useId, useState } from 'react';
import { Button } from '../ui/Button';
import { whyLine, type Why } from '../../guide/hand2';
import { useT } from '../../i18n/t';

export interface Hand2PanelProps {
    /** My bid; my play (legal cards known); the hand's result; or anything else (another seat's turn, an older backend). */
    phase: 'bid' | 'play' | 'wait' | 'done';
    /** The dealer after three passes: the tip says I call. */
    mustCall: boolean;
    /** Why the marked cards (the hint); null when nothing is marked. */
    why: Why | null;
    /** The accepted state's key (its stateVersion): a new one closes the hint, so each turn starts with it closed. */
    turn: number;
    /** Where Exit goes (spec §7.1). */
    exitLine: string;
    onExit: () => void;
}

/**
 * Škola bele's hand 2 (open beta §7.3) in the board's coach slot, kept short (the slot scrolls, and stops above the bid
 * panel): the title with Exit and where it goes, then what to do now, the hint on my play, and the Rules section. One
 * live region for the whole guide says the line and the hint's reason when it opens.
 */
export function Hand2Panel({ phase, mustCall, why, turn, exitLine, onExit }: Hand2PanelProps) {
    const t = useT();
    const id = useId();
    const lines = t.guide.hand2;
    // the hint is open for the turn it was opened on only
    const [openedOn, setOpenedOn] = useState<number | null>(null);
    const open = why !== null && openedOn === turn;
    const line = phase === 'bid' ? (mustCall ? lines.tipMust : lines.tip) : lines[phase];
    return (
        <div data-testid="hand2-panel" data-phase={phase} className="flex flex-col gap-1">
            <div className="flex items-start gap-1">
                <h2 className="t-callout min-w-0 flex-1 font-semibold">{lines.title}</h2>
                {/* Exit's 44-px hit area overlaps the row above instead of adding height, as hand 1's panel does */}
                <div className="flex shrink-0 flex-col items-end">
                    <Button size="sm" variant="quiet" className="-mt-3 -mr-2" aria-describedby={`${id}-exit`} onClick={onExit}>
                        {t.guide.exit.label}
                    </Button>
                    <span id={`${id}-exit`} className="t-footnote text-right text-text-2">{exitLine}</span>
                </div>
            </div>
            <div aria-live="polite" data-testid="hand2-said">
                <p className="t-footnote">{line}</p>
                {why && <p id={`${id}-why`} hidden={!open} className="t-footnote mt-1 font-semibold">{whyLine(why, t)}</p>}
            </div>
            {phase === 'play' && why && (
                <div>
                    <Button size="sm" variant="secondary" aria-expanded={open} aria-controls={`${id}-why`} onClick={() => setOpenedOn(open ? null : turn)}>
                        {lines.hint}
                    </Button>
                </div>
            )}
            <a href={`/rules#${phase === 'bid' ? 'rules-bidding' : phase === 'done' ? 'rules-scoring' : 'rules-playing'}`} target="_blank" rel="noopener noreferrer" className="t-footnote inline-flex min-h-11 items-center self-start font-semibold text-accent">
                {t.guide.rules}
            </a>
        </div>
    );
}
