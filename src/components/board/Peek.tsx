import { Loader } from '../ui/Loader';
import { PixelIcon } from '../ui/PixelIcon';
import { PlayingCard } from '../ui/PlayingCard';
import { Sheet } from '../ui/Sheet';
import { peekTricks } from './model/hands';
import type { BoardModel, Team } from './model/boardModel';
import type { MatchHands } from '../../hooks/useMatchHands';

export interface PeekProps {
    model: BoardModel;
    hands: MatchHands | null | undefined;
    open: boolean;
    onClose: () => void;
}

/** The won-trick peek (spec §5.4, D-11, US-32): my team's tricks of this hand, four thumbnails each, the winner crowned. */
export function Peek({ model, hands, open, onClose }: PeekProps) {
    const teamOf = (id: string): Team | null => model.seats.find((seat) => seat.id === id)?.team ?? null;
    const tricks = peekTricks(hands?.hands ?? null, model.phase, model.myTeam, teamOf);
    return (
        <Sheet open={open} onClose={onClose} title="Your team's tricks" showClose data-testid="peek-sheet">
            {hands?.error && <p role="alert" className="t-callout text-danger-text">{hands.error}</p>}
            {!hands?.hands && hands?.loading ? (
                <Loader text="Loading the tricks…" />
            ) : tricks.length === 0 ? (
                <p className="t-body text-text-2">No tricks won yet this hand.</p>
            ) : (
                <ol className="board-peek">
                    {tricks.map((trick) => (
                        <li key={trick.trickNo} className="board-peek__trick">
                            <span className="t-footnote text-text-3">{`Trick ${trick.trickNo}`}</span>
                            {trick.plays.map((play) => (
                                <span key={play.id} className="board-peek__card">
                                    <PlayingCard card={play.card} size="sheet" />
                                    {play.playerId === trick.winnerId && <span className="board-peek__crown"><PixelIcon name="crown" label="won the trick" /></span>}
                                </span>
                            ))}
                        </li>
                    ))}
                </ol>
            )}
        </Sheet>
    );
}
