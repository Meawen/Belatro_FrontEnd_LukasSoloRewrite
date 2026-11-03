import { useRef } from 'react';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { whyLine, type Why } from '../../guide/hand2';
import { useT } from '../../i18n/t';

export interface FoulWarningProps {
    open: boolean;
    /** The rule the card breaks: the hint's sentence for the marked cards. */
    why: Why | null;
    /** "Odigraj svejedno": the card goes (the real game lets it, D-24). */
    onPlay: () => void;
    /** "Odaberi drugu", Escape or the scrim: nothing goes. */
    onChoose: () => void;
}

/**
 * Hand 2's warning before a card outside the marked ones (open beta §7.3, D-24): the rule it breaks, that people could
 * challenge it and bots never do, then the choice. Choosing another card is the main button and has focus, so the risky
 * one is never a stray Enter away.
 */
export function FoulWarning({ open, why, onPlay, onChoose }: FoulWarningProps) {
    const t = useT();
    const choose = useRef<HTMLButtonElement>(null);
    const lines = t.guide.hand2.warning;
    return (
        <Sheet open={open} title={lines.title} onClose={onChoose} initialFocus={choose} data-testid="foul-warning">
            {why && why.kind !== 'other' && <p className="t-body">{whyLine(why, t)}</p>}
            <p className="t-body mt-2 text-text-2">{lines.body}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button ref={choose} onClick={onChoose}>{lines.other}</Button>
                <Button variant="secondary" onClick={onPlay}>{lines.anyway}</Button>
            </div>
        </Sheet>
    );
}
