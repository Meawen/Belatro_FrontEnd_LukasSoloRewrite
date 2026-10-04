import React, { useState } from 'react';
import { useCards } from '../hooks/useCards';
import type { Card } from '../hooks/useGameWebSocket'

// Display-only shapes for this mock board; the live wire types are in src/types/game.ts.
interface MockPlayer { id: string; username: string; cardCount: number }
interface MockPublicView {
    gameId: string;
    gameState: string;
    bids: unknown[];
    currentTrick: null;
    teamAScore: number;
    teamBScore: number;
    teamA: MockPlayer[];
    teamB: MockPlayer[];
    challengeUsedByPlayer: Record<string, boolean>;
    winnerTeamId?: string;
    tieBreaker: boolean;
}
interface MockPrivateView { publicPart: MockPublicView; hand: Card[]; yourTurn: boolean; challengeUsed: boolean }

// Mock data for testing - using correct suit/rank names
const createMockGameState = (userName: string = 'TestPlayer'): { public: MockPublicView; private: MockPrivateView } => {
    const mockHand: Card[] = [
        { suit: 'Herc', rank: '7' },      // Hearts 7
        { suit: 'Herc', rank: '8' },      // Hearts 8
        { suit: 'Pik', rank: '9' },       // Spades 9
        { suit: 'Pik', rank: '10' },      // Spades 10
        { suit: 'Karo', rank: 'Decko' },  // Diamonds Jack
        { suit: 'Tref', rank: 'Baba' },   // Clubs Queen
        { suit: 'Herc', rank: 'Kralj' },  // Hearts King
        { suit: 'Pik', rank: 'As' }       // Spades Ace
    ];

    const publicState: MockPublicView = {
        gameId: 'mock-game-123',
        gameState: 'PLAYING',
        bids: [],
        currentTrick: null,
        teamAScore: 85,
        teamBScore: 42,
        teamA: [
            { id: '1', username: userName, cardCount: 8 },
            { id: '2', username: 'Partner', cardCount: 8 }
        ],
        teamB: [
            { id: '3', username: 'Opponent1', cardCount: 8 },
            { id: '4', username: 'Opponent2', cardCount: 8 }
        ],
        challengeUsedByPlayer: {},
        winnerTeamId: undefined,
        tieBreaker: false
    };

    const privateState: MockPrivateView = {
        publicPart: publicState,
        hand: mockHand,
        yourTurn: true,
        challengeUsed: false
    };

    return { public: publicState, private: privateState };
};

export const MockGameBoard: React.FC = () => {
    const { getCardImage, getCardBackImage, preloadAllImages, isPreloading, preloadProgress } = useCards();
    const [gameState, setGameState] = useState(createMockGameState());
    const [selectedCard, setSelectedCard] = useState<Card | null>(null);
    const [showCardBacks, setShowCardBacks] = useState(false);
    const [cardBackNumber, setCardBackNumber] = useState(1);

    const handleCardPlay = (card: Card) => {
        if (!gameState.private.yourTurn) return;

        console.log('Playing card (MOCK):', card);
        setSelectedCard(card);

        // Simulate playing the card by removing it from hand
        const newHand = gameState.private.hand.filter(c =>
            !(c.suit === card.suit && c.rank === card.rank)
        );

        setGameState(prev => ({
            public: {
                ...prev.public,
                teamAScore: prev.public.teamAScore + Math.floor(Math.random() * 20)
            },
            private: {
                ...prev.private,
                hand: newHand,
                yourTurn: false // Simulate turn ending
            }
        }));

        // Simulate next turn after 2 seconds
        setTimeout(() => {
            setGameState(prev => ({
                ...prev,
                private: {
                    ...prev.private,
                    yourTurn: true
                }
            }));
        }, 2000);
    };

    const resetGame = () => {
        setGameState(createMockGameState());
        setSelectedCard(null);
    };

    const simulateBiddingPhase = () => {
        setGameState(prev => ({
            public: {
                ...prev.public,
                gameState: 'BIDDING'
            },
            private: prev.private
        }));
    };

    const simulatePlayingPhase = () => {
        setGameState(prev => ({
            public: {
                ...prev.public,
                gameState: 'PLAYING'
            },
            private: prev.private
        }));
    };

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-6 bg-emerald-950 min-h-screen">
            {/* Development Controls */}
            <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-4 mb-6">
                <h2 className="text-yellow-800 font-bold mb-2">🚧 Development Mode - Mock Game Board</h2>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={resetGame}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                    >
                        Reset Game
                    </button>
                    <button
                        onClick={simulateBiddingPhase}
                        className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                    >
                        Bidding Phase
                    </button>
                    <button
                        onClick={simulatePlayingPhase}
                        className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
                    >
                        Playing Phase
                    </button>
                    <button
                        onClick={() => setShowCardBacks(!showCardBacks)}
                        className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600"
                    >
                        {showCardBacks ? 'Show Card Faces' : 'Show Card Backs'}
                    </button>
                    <select
                        value={cardBackNumber}
                        onChange={(e) => setCardBackNumber(Number(e.target.value))}
                        className="px-2 py-1 rounded text-sm bg-gray-700 text-white"
                    >
                        <option value={1}>Card Back 1</option>
                        <option value={2}>Card Back 2</option>
                        <option value={3}>Card Back 3</option>
                    </select>
                    <button
                        onClick={() => preloadAllImages()}
                        disabled={isPreloading}
                        className={`px-3 py-1 rounded text-sm ${
                            isPreloading
                                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                : 'bg-indigo-500 text-white hover:bg-indigo-600'
                        }`}
                    >
                        {isPreloading ? `Preloading... ${Math.round(preloadProgress)}%` : 'Preload All Images'}
                    </button>
                </div>
                {selectedCard && (
                    <p className="text-yellow-700 text-sm mt-2">
                        Last played: {selectedCard.rank} of {selectedCard.suit}
                    </p>
                )}
            </div>

            {/* Game Header */}
            <div className="bg-emerald-900 rounded-lg shadow p-4 border border-emerald-700">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-amber-400">Belot Game (Mock)</h1>
                    <div className="text-lg font-semibold">
                        <span className="text-blue-400">Team A: {gameState.public.teamAScore}</span>
                        <span className="mx-4 text-emerald-300">-</span>
                        <span className="text-red-400">Team B: {gameState.public.teamBScore}</span>
                    </div>
                </div>
                <div className="mt-2 text-sm text-emerald-300">
                    Phase: <span className="font-medium text-amber-300">{gameState.public.gameState}</span>
                    {gameState.private.yourTurn && (
                        <span className="ml-4 text-green-400 font-medium animate-pulse">Your Turn!</span>
                    )}
                </div>
            </div>

            {/* Teams Display */}
            <div className="grid grid-cols-2 gap-6">
                <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700/30">
                    <h3 className="font-semibold text-blue-300 mb-3">Team A</h3>
                    <div className="space-y-2">
                        {gameState.public.teamA.map(player => (
                            <div key={player.id} className="flex justify-between text-emerald-200">
                                <span className={player.username === 'TestPlayer' ? 'text-amber-300 font-medium' : ''}>
                                    {player.username}
                                </span>
                                <span className="text-sm text-emerald-400">
                                    {player.cardCount} cards
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-red-900/30 rounded-lg p-4 border border-red-700/30">
                    <h3 className="font-semibold text-red-300 mb-3">Team B</h3>
                    <div className="space-y-2">
                        {gameState.public.teamB.map(player => (
                            <div key={player.id} className="flex justify-between text-emerald-200">
                                <span>{player.username}</span>
                                <span className="text-sm text-emerald-400">
                                    {player.cardCount} cards
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Current Trick */}
            <div className="bg-emerald-800/50 rounded-lg p-4 border border-emerald-600/30">
                <h3 className="font-semibold mb-3 text-emerald-200">Current Trick</h3>
                <div className="flex gap-4 justify-center">
                    {selectedCard ? (
                        <div className="text-center">
                            <div className="mb-2">
                                {getCardImage(selectedCard.suit, selectedCard.rank, 'w-20 h-28 rounded-lg shadow-lg')}
                            </div>
                            <p className="text-emerald-400 text-sm">
                                Last played: {selectedCard.rank} of {selectedCard.suit}
                            </p>
                        </div>
                    ) : (
                        <div className="text-center text-emerald-400">
                            No cards played yet
                        </div>
                    )}
                </div>
            </div>

            {/* Opponent's Hand (Hidden Cards) */}
            <div className="bg-emerald-800/30 rounded-lg p-4 border border-emerald-600/30">
                <h3 className="font-semibold mb-3 text-emerald-200">Opponent's Hand (Hidden)</h3>
                <div className="flex gap-1 justify-center">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <div key={index}>
                            {getCardBackImage(cardBackNumber, 'w-12 h-18 rounded shadow')}
                        </div>
                    ))}
                </div>
            </div>

            {/* Player's Hand */}
            <div className="bg-emerald-900 rounded-lg shadow p-4 border border-emerald-700">
                <h3 className="font-semibold mb-3 text-emerald-200">
                    Your Hand ({gameState.private.hand.length} cards)
                </h3>
                <div className="flex gap-2 justify-center flex-wrap">
                    {gameState.private.hand.map((card, index) => (
                        <button
                            key={`${card.suit}-${card.rank}-${index}`}
                            onClick={() => handleCardPlay(card)}
                            disabled={!gameState.private.yourTurn}
                            className={`
                                relative transition-all rounded-lg shadow-lg
                                ${gameState.private.yourTurn
                                ? 'hover:shadow-xl hover:-translate-y-2 cursor-pointer hover:scale-105'
                                : 'opacity-50 cursor-not-allowed'
                            }
                            `}
                        >
                            {showCardBacks ?
                                getCardBackImage(cardBackNumber, 'w-20 h-28 rounded-lg') :
                                getCardImage(card.suit, card.rank, 'w-20 h-28 rounded-lg')
                            }
                        </button>
                    ))}
                </div>
                {!gameState.private.yourTurn && (
                    <p className="text-center text-emerald-400 text-sm mt-2">
                        Waiting for other players...
                    </p>
                )}
            </div>

            {/* Card Testing Section */}
            <div className="bg-emerald-800/50 rounded-lg p-4 border border-emerald-600/30">
                <h3 className="font-semibold mb-3 text-emerald-200">Card Image Testing</h3>
                <div className="grid grid-cols-4 gap-4">
                    {/* Sample cards from each suit */}
                    <div className="text-center">
                        <h4 className="text-sm text-emerald-300 mb-2">Hearts (Herc)</h4>
                        <div className="flex gap-1 flex-wrap justify-center">
                            {getCardImage('Herc', '7', 'w-12 h-18 rounded')}
                            {getCardImage('Herc', 'As', 'w-12 h-18 rounded')}
                        </div>
                    </div>

                    <div className="text-center">
                        <h4 className="text-sm text-emerald-300 mb-2">Diamonds (Karo)</h4>
                        <div className="flex gap-1 flex-wrap justify-center">
                            {getCardImage('Karo', '10', 'w-12 h-18 rounded')}
                            {getCardImage('Karo', 'Baba', 'w-12 h-18 rounded')}
                        </div>
                    </div>

                    <div className="text-center">
                        <h4 className="text-sm text-emerald-300 mb-2">Spades (Pik)</h4>
                        <div className="flex gap-1 flex-wrap justify-center">
                            {getCardImage('Pik', '9', 'w-12 h-18 rounded')}
                            {getCardImage('Pik', 'Kralj', 'w-12 h-18 rounded')}
                        </div>
                    </div>

                    <div className="text-center">
                        <h4 className="text-sm text-emerald-300 mb-2">Clubs (Tref)</h4>
                        <div className="flex gap-1 flex-wrap justify-center">
                            {getCardImage('Tref', '8', 'w-12 h-18 rounded')}
                            {getCardImage('Tref', 'Decko', 'w-12 h-18 rounded')}
                        </div>
                    </div>
                </div>

                <div className="mt-4 text-center">
                    <h4 className="text-sm text-emerald-300 mb-2">Card Backs</h4>
                    <div className="flex gap-2 justify-center">
                        {getCardBackImage(1, 'w-12 h-18 rounded')}
                        {getCardBackImage(2, 'w-12 h-18 rounded')}
                        {getCardBackImage(3, 'w-12 h-18 rounded')}
                    </div>
                </div>
            </div>
        </div>
    );
};