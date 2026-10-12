import { Button } from '../ui/Button';
import type { HandCardModel } from './model/boardModel';
import type { Target } from './model/cardTargets';

export interface BelaPromptProps {
    card: HandCardModel;
    /** The card's place: the prompt sits just above it. */
    target: Target;
    onAnswer: (declareBela: boolean) => void;
    onDismiss: () => void;
}

/**
 * The bela prompt (spec §5.3.3, R-32): the trump K or Q with the other in hand asks "Play" or
 * "Play + Bela", anchored above the card. Escape closes it without playing.
 */
export function BelaPrompt({ card, target, onAnswer, onDismiss }: BelaPromptProps) {
    return (
        <div
            data-testid="bela-prompt"
            role="group"
            aria-label={`Declare bela with ${card.label}?`}
            className="board-bela"
            style={{ left: target.left + target.width / 2, top: target.top - 12 }}
            onKeyDown={(event) => {
                if (event.key !== 'Escape') return;
                event.stopPropagation();
                onDismiss();
            }}
        >
            <span className="t-footnote">{`Declare bela with ${card.label}?`}</span>
            <span className="board-bela__buttons">
                {/* the prompt opens from a press: focus follows it, so the keyboard can answer */}
                <Button size="sm" variant="secondary" autoFocus onClick={() => onAnswer(false)}>Play</Button>
                <Button size="sm" onClick={() => onAnswer(true)}>Play + Bela</Button>
            </span>
        </div>
    );
}
