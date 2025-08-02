import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGameWebSocket, type PublicGameView, type PrivateGameView, type Card } from '../../hooks/useGameWebSocket';
import { useCards } from '../../hooks/useCards';

export const GameBoard: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const [publicGameState, setPublicGameState] = useState<PublicGameView | null>(null);
    const [privateGameState, setPrivateGameState] = useState<PrivateGameView | null>(null);
    const { getCardImageUrl } = useCards();

    const { subscribeToGame, playCard, isConnected } = useGameWebSocket({
        onPublicGameUpdate: (gameView: PublicGameView) => {
            setPublicGameState(gameView);
        },
        onPrivateGameUpdate: (gameView: PrivateGameView) => {
            setPrivateGameState(gameView);
            setPublicGameState(gameView.publicPart);
        },
        onGameDisconnect: () => {
            // Handle game disconnect
            console.log('Game disconnected');
        }
    });

    useEffect(() => {
        if (gameId && isConnected) {
            subscribeToGame(gameId);
        }
    }, [gameId, isConnected, subscribeToGame]);

    const handleCardPlay = (card: Card) => {
        if (!gameId || !privateGameState?.yourTurn) return;
        
        // For now, declareBela is always false - could be enhanced with UI
        playCard(gameId, card, false);
    };

    if (!isConnected) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p>Connecting to game...</p>
                </div>
            </div>
        );
    }

    if (!publicGameState || !privateGameState) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-center">
                    <div className="animate-pulse">
                        <div className="h-4 bg-gray-300 rounded w-48 mb-2"></div>
                        <div className="h-4 bg-gray-300 rounded w-32"></div>
                    </div>
                    <p className="mt-4">Loading game state...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-6">
            {/* Game Header */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Belatro Game</h1>
                    <div className="text-lg font-semibold">
                        <span className="text-blue-600">Team A: {publicGameState.teamAScore}</span>
                        <span className="mx-4">-</span>
                        <span className="text-red-600">Team B: {publicGameState.teamBScore}</span>
                    </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                    Phase: <span className="font-medium">{publicGameState.gameState}</span>
                    {privateGameState.yourTurn && (
                        <span className="ml-4 text-green-600 font-medium">Your Turn!</span>
                    )}
                </div>
            </div>

            {/* Teams Display */}
            <div className="grid grid-cols-2 gap-6">
                <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 mb-3">Team A</h3>
                    <div className="space-y-2">
                        {publicGameState.teamA.map(player => (
                            <div key={player.id} className="flex justify-between">
                                <span>{player.username}</span>
                                <span className="text-sm text-gray-600">
                                    {player.cardCount} cards
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="bg-red-50 rounded-lg p-4">
                    <h3 className="font-semibold text-red-800 mb-3">Team B</h3>
                    <div className="space-y-2">
                        {publicGameState.teamB.map(player => (
                            <div key={player.id} className="flex justify-between">
                                <span>{player.username}</span>
                                <span className="text-sm text-gray-600">
                                    {player.cardCount} cards
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Current Trick */}
            {publicGameState.currentTrick && (
                <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Current Trick</h3>
                    <div className="flex gap-4 justify-center">
                        {/* This would display cards in the current trick */}
                        <div className="text-center text-gray-600">
                            Current trick display would go here
                        </div>
                    </div>
                </div>
            )}

            {/* Player's Hand */}
            <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3">Your Hand</h3>
                <div className="flex gap-2 justify-center flex-wrap">
                    {privateGameState.hand.map((card, index) => (
                        <button
                            key={`${card.suit}-${card.rank}-${index}`}
                            onClick={() => handleCardPlay(card)}
                            disabled={!privateGameState.yourTurn}
                            className={`
                                w-16 h-24 bg-white border-2 rounded-lg shadow transition-all
                                ${privateGameState.yourTurn 
                                    ? 'hover:shadow-lg hover:-translate-y-1 border-blue-300 hover:border-blue-500' 
                                    : 'opacity-50 cursor-not-allowed border-gray-200'
                                }
                            `}
                        >
                            <img
                                src={getCardImageUrl(`${card.suit}_${card.rank}`)}
                                alt={`${card.rank} of ${card.suit}`}
                                className="w-full h-full object-cover rounded"
                                onError={(e) => {
                                    // Fallback to text display if image fails
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                            />
                            <div className="hidden text-xs p-1">
                                <div>{card.rank}</div>
                                <div>{card.suit}</div>
                            </div>
                        </button>
                    ))}
                </div>
                {!privateGameState.yourTurn && (
                    <p className="text-center text-gray-500 text-sm mt-2">
                        Waiting for other players...
                    </p>
                )}
            </div>
        </div>
    );
};
