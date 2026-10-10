import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { PixelIcon } from '../ui/PixelIcon';
import { Sheet } from '../ui/Sheet';
import type { BoardModel } from './model/boardModel';
import type { RematchState } from '../../hooks/useRematch';

export interface EndSheetProps {
    model: BoardModel;
    open: boolean;
    rematch?: RematchState;
    /** "Back to lobbies". */
    onLeave: () => void;
}

/**
 * The end of the game (spec §5.4, R-20, R-25, R-45, US-38, US-39): a non-modal sheet docked at the
 * bottom of the board. The winner line or why it ended (`end-reason`), the final score (no test ids),
 * then Play again with the votes and Leave after a game a rematch may follow, else Back to lobbies,
 * and Match details.
 */
export function EndSheet({ model, open, rematch, onLeave }: EndSheetProps) {
    const end = model.end;
    const mine = model.myTeam ?? 'A';
    const score = (team: 'A' | 'B') => (team === 'A' ? model.scores.a : model.scores.b);
    return (
        <Sheet open={open && end !== null} onClose={() => {}} title={end?.title ?? 'Game over'} modal={false} dismissible={false} side="bottom" className="board-dock">
            {end && (
                <div className="board-end">
                    {end.winnerLine && <p className="t-headline">{end.winnerLine}</p>}
                    {end.reason && <p data-testid="end-reason" className="t-body text-text-2">{end.reason}</p>}
                    <p className="board-end__score">
                        <span className="t-caption text-text-2">Mi</span>
                        <span className="t-score-xl">{score(mine)}</span>
                        <span className="t-score-xl text-text-3" aria-hidden="true">:</span>
                        <span className="t-score-xl">{score(mine === 'A' ? 'B' : 'A')}</span>
                        <span className="t-caption text-text-2">Vi</span>
                    </p>
                    {rematch && end.rematchOffered ? (
                        // R-45: Play again votes; Leave declines for everyone and goes back to the lobbies
                        <div className="board-end__rematch">
                            <p data-testid="rematch-votes" className="t-callout">{`${rematch.votes}/4 want a rematch`}</p>
                            {rematch.cancelledBy && <p className="t-callout text-danger-text">{`${rematch.cancelledBy} left — no rematch`}</p>}
                            {rematch.expired && !rematch.cancelledBy && <p className="t-callout text-danger-text">Rematch expired</p>}
                            <div className="board-end__actions">
                                <Button onClick={rematch.playAgain} disabled={rematch.cancelledBy !== null || rematch.expired}>Play again</Button>
                                <Button variant="secondary" onClick={rematch.leave}>Leave</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="board-end__actions">
                            <Button onClick={onLeave}>Back to lobbies</Button>
                        </div>
                    )}
                    <Link to={`/matches/${model.gameId}`} className="board-end__details t-callout font-semibold text-accent">
                        Match details
                        <PixelIcon name="chevron" />
                    </Link>
                </div>
            )}
        </Sheet>
    );
}
