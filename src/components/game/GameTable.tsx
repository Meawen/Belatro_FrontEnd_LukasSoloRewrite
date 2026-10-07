import React, { useEffect, useState } from 'react';
import { Button } from '../common/Button';
import { ErrorAlert } from '../common/ErrorAlert';
import { PlayingCard } from '../common/PlayingCard';
import type { Boja, GameCard, PrivateGameView, PublicGameView } from '../../types/game';
import { BOJE, CHALLENGE_HINT, PHASE_LABEL, SUIT_LABEL, cardLabel, declarationLines, endSentence, seatsFromMe, teamOf, trumpOf } from './gameView';

export interface GameTableProps {
    publicView: PublicGameView;
    privateView: PrivateGameView | null;
    /** The signed-in player's username (the backend's player id). */
    me: string;
    error: string | null;
    onPass: () => void;
    onCallTrump: (trump: Boja) => void;
    onPlayCard: (card: GameCard) => void;
    onChallenge: () => void;
    onLeave: () => void;
}

// Grid cells for seatsFromMe order: you (bottom), next player (right), partner (top), left.
const SEAT_CELL = [
    'col-start-2 row-start-3',
    'col-start-3 row-start-2',
    'col-start-2 row-start-1',
    'col-start-1 row-start-2',
];

/** Seconds left on the running turn timer (R-31), ticking once a second; never below 0. */
function TurnCountdown({ expiresAt }: { expiresAt: number }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    return <span data-testid="turn-countdown" className="font-mono text-amber-300">{seconds} s</span>;
}

export const GameTable: React.FC<GameTableProps> = ({
    publicView,
    privateView,
    me,
    error,
    onPass,
    onCallTrump,
    onPlayCard,
    onChallenge,
    onLeave,
}) => {
    const phase = publicView.gameState;
    const yourTurn = privateView?.yourTurn === true;
    const hand = privateView?.hand ?? [];
    const seats = seatsFromMe(publicView.seatingOrder ?? [], me);
    // While bidding the view still carries the previous hand's last trick: show none.
    const plays = phase === 'BIDDING' ? {} : publicView.currentTrick?.plays ?? {};
    const trump = trumpOf(publicView);
    const finished = phase === 'COMPLETED' || phase === 'CANCELLED';
    const canBid = phase === 'BIDDING' && yourTurn;
    const canPlay = phase === 'PLAYING' && yourTurn;
    // yourTurn alone is not enough: it stays set after a hand's last play.
    const myMove = canBid || canPlay;
    const canChallenge = (phase === 'PLAYING' || phase === 'HAND_COMPLETE')
        && privateView !== null && !privateView.challengeUsed;
    const myTeam = teamOf(publicView, me);
    const declarations = declarationLines(publicView);
    const ending = endSentence(publicView);

    return (
        <div className="max-w-5xl mx-auto px-4 space-y-6">
            <div className="card flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6 text-lg font-semibold">
                    <span className="text-blue-300">Team A: <span data-testid="score-a">{publicView.teamAScore}</span></span>
                    <span className="text-red-300">Team B: <span data-testid="score-b">{publicView.teamBScore}</span></span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-emerald-200">
                    {myTeam && <span data-testid="your-team" className="font-medium text-white">{`Your team: ${myTeam}`}</span>}
                    {/* R-31: the phase in words; data-phase keeps the raw state for scripts (e2e) */}
                    <span>Phase: <span data-testid="game-phase" data-phase={phase} className="font-medium text-white">{PHASE_LABEL[phase] ?? phase}</span></span>
                    {trump && (
                        <span>Trump: <span data-testid="trump" className="font-medium text-amber-300">{SUIT_LABEL[trump]}</span></span>
                    )}
                    {myMove && (
                        <span data-testid="your-turn" className="font-bold text-amber-400">Your turn</span>
                    )}
                </div>
            </div>

            <ErrorAlert message={error} />

            {finished ? (
                <div className="card text-center space-y-4">
                    <h2 className="text-2xl font-bold text-white">
                        {phase === 'CANCELLED' && publicView.endReason !== 'FORFEIT' ? 'Match cancelled' : 'Game over'}
                    </h2>
                    {phase === 'COMPLETED' && (
                        <p className="text-emerald-200">
                            {publicView.winnerTeamId ? `Team ${publicView.winnerTeamId} wins` : 'Draw'}
                        </p>
                    )}
                    {ending && <p data-testid="end-reason" className="text-emerald-200">{ending}</p>}
                    <Button onClick={onLeave} variant="primary">Back to lobbies</Button>
                </div>
            ) : (
                <>
                    <div className="card grid grid-cols-3 grid-rows-3 gap-2 min-h-[22rem] items-center justify-items-center">
                        {seats.map((seat, index) => {
                            const played = plays[seat.id];
                            // R-31: the seat to act, with the seconds left on its turn timer
                            const current = seat.id === publicView.currentPlayerId;
                            return (
                                <div
                                    key={seat.id}
                                    data-testid={`seat-${seat.id}`}
                                    data-current={current ? 'true' : undefined}
                                    className={`${SEAT_CELL[index]} flex flex-col items-center gap-2 rounded-lg p-2 ${
                                        current ? 'ring-2 ring-amber-400' : ''
                                    }`}
                                >
                                    <div className="text-sm text-emerald-200">
                                        <span className="font-medium text-white">{seat.id === me ? 'You' : seat.id}</span>
                                        {' · '}
                                        <span data-testid={`cards-left-${seat.id}`}>{seat.cardsLeft}</span> cards
                                        {current && publicView.turnExpiresAt != null && (
                                            <>{' · '}<TurnCountdown expiresAt={publicView.turnExpiresAt} /></>
                                        )}
                                    </div>
                                    {played && (
                                        <div data-testid="trick-card" data-card={`${played.boja}-${played.rank}`}>
                                            <PlayingCard suit={played.boja} rank={played.rank} className="w-16 h-24" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {publicView.bids.length > 0 && (
                        <div className="card">
                            <h3 className="text-sm font-semibold text-emerald-200 mb-2">Bids</h3>
                            <ol className="flex flex-wrap gap-3 text-sm text-white">
                                {publicView.bids.map((bid, index) => (
                                    <li key={index} data-testid="bid">
                                        {bid.playerId}: {bid.action === 'CALL_TRUMP' && bid.selectedTrump ? SUIT_LABEL[bid.selectedTrump] : 'Pass'}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {declarations.length > 0 && (
                        <div className="card">
                            <h3 className="text-sm font-semibold text-emerald-200 mb-2">Declarations</h3>
                            <ul className="flex flex-wrap gap-3 text-sm text-white">
                                {declarations.map((line) => (
                                    <li key={line} data-testid="declaration">{line}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {canBid && (
                        <div className="card flex flex-wrap items-center gap-3">
                            <span className="text-emerald-200 text-sm mr-2">Your bid:</span>
                            <Button variant="outline" onClick={onPass}>Pass</Button>
                            {BOJE.map((boja) => (
                                <Button key={boja} variant="primary" onClick={() => onCallTrump(boja)}>
                                    Call {SUIT_LABEL[boja]}
                                </Button>
                            ))}
                        </div>
                    )}

                    <div className="card">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-white">Your hand</h3>
                            {canChallenge && (
                                <Button variant="outline" size="small" onClick={onChallenge}>Challenge</Button>
                            )}
                        </div>
                        {canChallenge && (
                            <p data-testid="challenge-hint" className="text-xs text-emerald-300 mb-3">{CHALLENGE_HINT}</p>
                        )}
                        <div data-testid="hand" className="flex flex-wrap justify-center gap-2">
                            {hand.map((card) => (
                                <button
                                    key={`${card.boja}-${card.rank}`}
                                    type="button"
                                    data-testid="hand-card"
                                    data-card={`${card.boja}-${card.rank}`}
                                    aria-label={cardLabel(card)}
                                    disabled={!canPlay}
                                    onClick={() => onPlayCard(card)}
                                    className={`w-16 h-24 rounded-lg transition-transform ${
                                        canPlay ? 'hover:-translate-y-1 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                                    }`}
                                >
                                    <PlayingCard suit={card.boja} rank={card.rank} className="w-full h-full" />
                                </button>
                            ))}
                        </div>
                        {!myMove && (
                            <p className="text-center text-emerald-300 text-sm mt-2">Waiting for other players...</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
