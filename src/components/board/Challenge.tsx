import { useId, useState } from 'react';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { CHALLENGE_HINT } from '../game/gameView';

export interface ChallengeProps {
    onChallenge: () => void;
    /** Where it sits: the HUD while playing, the hand-result sheet in HAND_COMPLETE. */
    place: 'hud' | 'sheet';
}

/**
 * Challenge (spec §5.3.3, R-18, R-31): the button, and an info button that reveals the hint. The hint
 * (`challenge-hint`) is in the DOM in full while Challenge is offered, visually hidden until revealed.
 */
export function Challenge({ onChallenge, place }: ChallengeProps) {
    const [open, setOpen] = useState(false);
    const hint = useId();
    return (
        <span
            className={place === 'hud' ? 'board-challenge board-challenge--hud' : 'board-challenge'}
            onKeyDown={(event) => {
                if (event.key !== 'Escape' || !open) return;
                event.stopPropagation();
                setOpen(false);
            }}
        >
            <span className="board-challenge__buttons">
                <Button size="sm" variant="secondary" aria-describedby={hint} onClick={onChallenge}>Challenge</Button>
                <IconButton size="sm" icon="info" aria-label="What does Challenge do?" aria-expanded={open} aria-controls={hint} onClick={() => setOpen((shown) => !shown)} />
            </span>
            <span id={hint} data-testid="challenge-hint" className={open ? 'board-challenge__hint notch t-footnote' : 'sr-only'}>{CHALLENGE_HINT}</span>
        </span>
    );
}
