import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { PixelIcon } from '../ui/PixelIcon';
import { Sheet } from '../ui/Sheet';
import type { BoardModel } from './model/boardModel';
import type { RematchState } from '../../hooks/useRematch';
import { useT } from '../../i18n/t';

export interface EndSheetProps {
    model: BoardModel;
    open: boolean;
    rematch?: RematchState;
    /** The way out (open beta §6): Doma for a member, Natrag (the landing page) for a guest. */
    onLeave: () => void;
    /** A guest (spec §3.3): no Match details, a member-only page. */
    guest?: boolean;
    /** A guest's "Igraj s ljudima" (open beta §6): sign up. */
    onSignUp?: () => void;
}

/**
 * The end of the game (spec §5.4, R-20, R-25, R-45, US-38, US-39): a non-modal sheet docked at the
 * bottom of the board. The winner line or why it ended (`end-reason`), the final score (no test ids),
 * then Play again with the votes after a game a rematch may follow, and the ways out: Doma for a member, Igraj s
 * ljudima and Natrag for a guest; and Match details (not for a guest).
 */
export function EndSheet({ model, open, rematch, onLeave, guest, onSignUp }: EndSheetProps) {
    const t = useT();
    const end = model.end;
    const mine = model.myTeam ?? 'A';
    const score = (team: 'A' | 'B') => (team === 'A' ? model.scores.a : model.scores.b);
    // open beta §6: a member goes Doma, a guest back to the landing page; a guest may also sign up
    const away = guest ? t.common.back : t.titles.home;
    const signUp = guest && onSignUp && <Button variant="secondary" onClick={onSignUp}>{t.board.end.withPeople}</Button>;
    return (
        <Sheet open={open && end !== null} onClose={() => {}} title={end?.title ?? t.game.end.over} modal={false} dismissible={false} side="bottom" className="board-dock">
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
                        // R-45: Play again votes; going away declines it for everyone (GamePageConnected)
                        <div className="board-end__rematch">
                            <p data-testid="rematch-votes" className="t-callout">{t.board.end.votes(rematch.votes)}</p>
                            {rematch.cancelledBy && <p className="t-callout text-danger-text">{t.board.end.left(rematch.cancelledBy)}</p>}
                            {rematch.expired && !rematch.cancelledBy && <p className="t-callout text-danger-text">{t.board.end.expired}</p>}
                            <div className="board-end__actions">
                                {/* one vote: off once mine went out, until the rematch starts, is declined or expires (R29) */}
                                <Button onClick={rematch.playAgain} disabled={rematch.voted || rematch.cancelledBy !== null || rematch.expired}>
                                    {t.board.end.playAgain}
                                </Button>
                                {signUp}
                                <Button variant="secondary" onClick={onLeave}>{away}</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="board-end__actions">
                            <Button onClick={onLeave}>{away}</Button>
                            {signUp}
                        </div>
                    )}
                    {!guest && (
                        <Link to={`/matches/${model.gameId}`} className="board-end__details t-callout font-semibold text-accent">
                            {t.titles.matchDetails}
                            <PixelIcon name="chevron" />
                        </Link>
                    )}
                </div>
            )}
        </Sheet>
    );
}
