import React from 'react';
import { Button } from '../common/Button';
import { ErrorAlert } from '../common/ErrorAlert';
import { PlayingCard } from '../common/PlayingCard';
import type { Boja, GameCard, PrivateGameView, PublicGameView } from '../../types/game';
import { BOJE, SUIT_LABEL, cardLabel, seatsFromMe, trumpOf } from './gameView';

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
    const plays = publicView.currentTrick?.plays ?? {};
    const trump = trumpOf(publicView);
    const finished = phase === 'COMPLETED' || phase === 'CANCELLED';
    const canBid = phase === 'BIDDING' && yourTurn;
    const canPlay = phase === 'PLAYING' && yourTurn;
    const canChallenge = (phase === 'PLAYING' || phase === 'HAND_COMPLETE')
        && privateView !== null && !privateView.challengeUsed;

    return (
        <div className="max-w-5xl mx-auto px-4 space-y-6">
            <div className="card flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6 text-lg font-semibold">
                    <span className="text-blue-300">Team A: <span data-testid="score-a">{publicView.teamAScore}</span></span>
                    <span className="text-red-300">Team B: <span data-testid="score-b">{publicView.teamBScore}</span></span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-emerald-200">
                    <span>Phase: <span data-testid="game-phase" className="font-medium text-white">{phase}</span></span>
                    {trump && (
                        <span>Trump: <span data-testid="trump" className="font-medium text-amber-300">{SUIT_LABEL[trump]}</span></span>
                    )}
                    {yourTurn && !finished && (
                        <span data-testid="your-turn" className="font-bold text-amber-400">Your turn</span>
                    )}
                </div>
            </div>

            <ErrorAlert message={error} />

            {finished ? (
                <div className="card text-center space-y-4">
                    <h2 className="text-2xl font-bold text-white">
                        {phase === 'CANCELLED' ? 'Match cancelled' : 'Game over'}
                    </h2>
                    {phase === 'COMPLETED' && (
                        <p className="text-emerald-200">
                            {publicView.winnerTeamId ? `Team ${publicView.winnerTeamId} wins` : 'Draw'}
                        </p>
                    )}
                    <Button onClick={onLeave} variant="primary">Back to lobbies</Button>
                </div>
            ) : (
                <>
                    <div className="card grid grid-cols-3 grid-rows-3 gap-2 min-h-[22rem] items-center justify-items-center">
                        {seats.map((seat, index) => {
                            const played = plays[seat.id];
                            return (
                                <div
                                    key={seat.id}
                                    data-testid={`seat-${seat.id}`}
                                    className={`${SEAT_CELL[index]} flex flex-col items-center gap-2`}
                                >
                                    <div className="text-sm text-emerald-200">
                                        <span className="font-medium text-white">{seat.id === me ? 'You' : seat.id}</span>
                                        {' · '}
                                        <span data-testid={`cards-left-${seat.id}`}>{seat.cardsLeft}</span> cards
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
                        {!yourTurn && (
                            <p className="text-center text-emerald-300 text-sm mt-2">Waiting for other players...</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
