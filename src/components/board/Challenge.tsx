import { useId, useState } from 'react';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { CHALLENGE_HINT, CHALLENGE_USED_INFO } from '../game/gameView';

export interface ChallengeProps {
    onChallenge: () => void;
    /** Where it sits: the HUD while playing, the hand-result sheet in HAND_COMPLETE. */
    place: 'hud' | 'sheet';
    /** 'used': my challenge is gone for the game; it stays here, greyed, reading "Challenge used" (D-7). */
    state: 'available' | 'used';
    /** A press waits for the server's answer: disabled, so a double tap sends once (gameplay rules §6). */
    pending: boolean;
    /** The step before a challenge, shown while its banner says who: disabled, as it was labelled (the board ignores a press). */
    frozen?: boolean;
}

/**
 * Challenge (spec §5.3.3, R-18, R-31; gameplay rules §6): the button, one tap with no confirm (D-4), and an info
 * button that reveals the hint. The hint (`challenge-hint`) is in the DOM in full while Challenge shows, visually
 * hidden until revealed; once my challenge is gone it says why the button is greyed.
 */
export function Challenge({ onChallenge, place, state, pending, frozen = false }: ChallengeProps) {
    const [open, setOpen] = useState(false);
    const hint = useId();
    const used = state === 'used';
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
                {/* its own panel on a portrait phone, where the two stack (board.css): opaque behind a greyed button */}
                <span className="board-challenge__main">
                    <Button size="sm" variant="secondary" aria-describedby={hint} disabled={used || frozen} loading={pending} onClick={onChallenge}>
                        {used ? 'Challenge used' : 'Challenge'}
                    </Button>
                </span>
                <IconButton size="sm" icon="info" aria-label="What does Challenge do?" aria-expanded={open} aria-controls={hint} onClick={() => setOpen((shown) => !shown)} />
            </span>
            <span id={hint} data-testid="challenge-hint" className={open ? 'board-challenge__hint notch t-footnote' : 'sr-only'}>
                {used ? CHALLENGE_USED_INFO : CHALLENGE_HINT}
            </span>
        </span>
    );
}
