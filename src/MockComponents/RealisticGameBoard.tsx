
import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useCards } from '../hooks/useCards';
import type { Card } from '../hooks/useGameWebSocket';

interface GameState {
    phase: 'DEALING' | 'BIDDING' | 'PLAYING' | 'TRICK_END' | 'GAME_END';
    currentPlayer: number; // 0-3, where 0 is the user
    trick: { card: Card; playerId: number }[];
    scores: { teamA: number; teamB: number };
    trumpSuit: string | null;
    dealer: number;
    hands: Card[][];
    talon: Card[]; // Remaining cards after initial dealing
    currentBid: { player: number; suit: string; points: number } | null;
}

const PLAYER_NAMES = ['You', 'Right', 'Partner', 'Left'];
const SUITS = ['Herc', 'Karo', 'Pik', 'Tref'];
const RANKS = ['7', '8', '9', '10', 'Decko', 'Baba', 'Kralj', 'As'];

// Create a full deck of cards
const createDeck = (): Card[] => {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank });
        }
    }
    return deck;
};

// Shuffle array using Fisher-Yates algorithm
const shuffleDeck = (deck: Card[]): Card[] => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

export const RealisticGameBoard: React.FC = () => {
    const { getCardImage, getCardBackImage } = useCards();
    const [gameState, setGameState] = useState<GameState>({
        phase: 'DEALING',
        currentPlayer: 0,
        trick: [],
        scores: { teamA: 0, teamB: 0 },
        trumpSuit: null,
        dealer: 0,
        hands: [[], [], [], []],
        talon: [],
        currentBid: null
    });

    // Refs for GSAP animations
    const containerRef = useRef<HTMLDivElement>(null);
    const deckRef = useRef<HTMLDivElement>(null);
    const trickRef = useRef<HTMLDivElement>(null);
    const talonRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);

    // Initialize hands with dealt cards (3+3 dealing pattern)
    const dealCards = () => {
        const deck = shuffleDeck(createDeck());
        const hands: Card[][] = [[], [], [], []];
        let cardIndex = 0;

        // First circle: 3 cards to each player
        for (let round = 0; round < 2; round++) {
            for (let player = 0; player < 4; player++) {
                for (let card = 0; card < 3; card++) {
                    hands[player].push(deck[cardIndex++]);
                }
            }
        }

        // Remaining 8 cards go to talon
        const talon = deck.slice(cardIndex);

        return { hands, talon };
    };

    // Start a new game
    const startNewGame = () => {
        console.log('Starting new game');
        const { hands, talon } = dealCards();

        setGameState({
            phase: 'DEALING',
            currentPlayer: 0,
            trick: [],
            scores: { teamA: 0, teamB: 0 },
            trumpSuit: null,
            dealer: Math.floor(Math.random() * 4),
            hands,
            talon,
            currentBid: null
        });
    };

    // Simulate bidding (when someone picks trump, they get 2 cards from talon)
    const simulateBid = (suit: string, points: number) => {
        // Give 2 cards from talon to the bidder
        const newHands = [...gameState.hands];
        const newTalon = [...gameState.talon];

        if (newTalon.length >= 2) {
            newHands[gameState.currentPlayer].push(newTalon.pop()!);
            newHands[gameState.currentPlayer].push(newTalon.pop()!);
        }

        setGameState(prev => ({
            ...prev,
            currentBid: { player: prev.currentPlayer, suit, points },
            trumpSuit: suit,
            phase: 'PLAYING',
            currentPlayer: (prev.dealer + 1) % 4,
            hands: newHands,
            talon: newTalon
        }));
    };

    // Pass bid (move to next player)
    const passBid = () => {
        const nextPlayer = (gameState.currentPlayer + 1) % 4;

        // If everyone passes, restart bidding or end game
        if (nextPlayer === (gameState.dealer + 1) % 4) {
            // Full circle, everyone passed - restart game for simplicity
            startNewGame();
            return;
        }

        setGameState(prev => ({
            ...prev,
            currentPlayer: nextPlayer
        }));
    };

    // Play a card with animation
    const playCard = (card: Card, playerIndex: number) => {
        if (gameState.phase !== 'PLAYING') return;
        if (playerIndex === 0 && gameState.currentPlayer !== 0) return; // Not player's turn

        console.log(`Player ${playerIndex} playing card:`, card);

        // Find the card element and animate it
        const cardElement = containerRef.current?.querySelector(
            `[data-card-id="player-${playerIndex}-card"][data-suit="${card.suit}"][data-rank="${card.rank}"]`
        );

        if (cardElement && trickRef.current) {
            // Calculate position in trick area
            const trickRect = trickRef.current.getBoundingClientRect();
            const cardRect = cardElement.getBoundingClientRect();

            const positions = [
                { x: 0, y: 40 },    // Bottom (You)
                { x: 40, y: 0 },    // Right
                { x: 0, y: -40 },   // Top (Partner)
                { x: -40, y: 0 }    // Left
            ];
            const targetPos = positions[playerIndex];

            gsap.to(cardElement, {
                x: trickRect.left - cardRect.left + targetPos.x,
                y: trickRect.top - cardRect.top + targetPos.y,
                scale: 0.9,
                zIndex: 100 + gameState.trick.length,
                duration: 0.6,
                ease: "power2.out"
            });
        }

        // Update game state
        setGameState(prev => {
            const newHands = [...prev.hands];
            newHands[playerIndex] = newHands[playerIndex].filter(c =>
                !(c.suit === card.suit && c.rank === card.rank)
            );

            const newTrick = [...prev.trick, { card, playerId: playerIndex }];
            const nextPlayer = (prev.currentPlayer + 1) % 4;
            const trickComplete = newTrick.length === 4;

            return {
                ...prev,
                hands: newHands,
                trick: newTrick,
                currentPlayer: trickComplete ? prev.currentPlayer : nextPlayer,
                phase: trickComplete ? 'TRICK_END' : 'PLAYING'
            };
        });

        // If trick is complete, clear it after a delay
        if (gameState.trick.length === 3) { // This will be 4 after state update
            setTimeout(() => {
                // Animate cards being collected
                const trickCards = containerRef.current?.querySelectorAll('[data-trick-card]');
                if (trickCards) {
                    gsap.to(trickCards, {
                        x: 200,
                        y: -200,
                        scale: 0,
                        rotation: 360,
                        duration: 0.8,
                        stagger: 0.1,
                        ease: "power2.in",
                        onComplete: () => {
                            setGameState(prev => ({
                                ...prev,
                                trick: [],
                                phase: prev.hands[0].length === 0 ? 'GAME_END' : 'PLAYING'
                            }));
                        }
                    });
                }
            }, 2000);
        }
    };

    // Auto-play for AI players
    useEffect(() => {
        if (gameState.phase === 'PLAYING' && gameState.currentPlayer !== 0) {
            const timer = setTimeout(() => {
                const playerHand = gameState.hands[gameState.currentPlayer];
                if (playerHand.length > 0) {
                    // Simple AI: play random valid card
                    const randomCard = playerHand[Math.floor(Math.random() * playerHand.length)];
                    playCard(randomCard, gameState.currentPlayer);
                }
            }, 1500 + Math.random() * 1000); // 1.5-2.5s delay

            return () => clearTimeout(timer);
        }

        // Auto-bidding for AI players
        if (gameState.phase === 'BIDDING' && gameState.currentPlayer !== 0) {
            const timer = setTimeout(() => {
                // Simple AI: 30% chance to bid, 70% pass
                if (Math.random() < 0.3) {
                    const randomSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
                    simulateBid(randomSuit, 80);
                } else {
                    passBid();
                }
            }, 1000 + Math.random() * 1500); // 1-2.5s delay

            return () => clearTimeout(timer);
        }
    }, [gameState.currentPlayer, gameState.phase]);

    // Initialize game
    useEffect(() => {
        if (gameState.hands.every(hand => hand.length === 0)) {
            startNewGame();
        }
    }, []);

    // Start to bidding after dealing
    useEffect(() => {
        if (gameState.phase === 'DEALING' && gameState.hands.some(hand => hand.length > 0)) {
            const timer = setTimeout(() => {
                setGameState(prev => ({
                    ...prev,
                    phase: 'BIDDING',
                    currentPlayer: (prev.dealer + 1) % 4
                }));
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [gameState.phase, gameState.hands]);

    return (
        <div
            ref={containerRef}
            className="max-w-7xl mx-auto p-4 space-y-4 bg-gradient-to-b from-emerald-950 to-emerald-900 min-h-screen"
        >
            {/* Game Controls */}
            <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-4">
                <h2 className="text-yellow-800 font-bold mb-2">🎮 Realistic Belot Game</h2>
                <div className="flex gap-2 flex-wrap items-center">
                    <button
                        onClick={startNewGame}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
                    >
                        New Game
                    </button>
                    <div className="text-yellow-700">
                        Phase: <strong>{gameState.phase.replace('_', ' ')}</strong>
                        {gameState.trumpSuit && (
                            <span className="ml-4">
                                Trump: <strong>{gameState.trumpSuit}</strong>
                            </span>
                        )}
                        {gameState.phase !== 'DEALING' && (
                            <span className="ml-4">
                                Current: <strong>{PLAYER_NAMES[gameState.currentPlayer]}</strong>
                            </span>
                        )}
                        <span className="ml-4">
                            Talon: <strong>{gameState.talon.length} cards</strong>
                        </span>
                    </div>
                </div>
            </div>

            {/* Game Table */}
            <div className="relative bg-green-800 rounded-3xl p-8 shadow-2xl border-8 border-amber-900 min-h-[600px]">
                {/* Scores */}
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-emerald-900 rounded-lg px-6 py-2 border border-amber-600">
                        <div className="text-center">
                            <span className="text-blue-400 font-bold">Team A: {gameState.scores.teamA}</span>
                            <span className="mx-4 text-amber-400">vs</span>
                            <span className="text-red-400 font-bold">Team B: {gameState.scores.teamB}</span>
                        </div>
                    </div>
                </div>

                {/* Deck Position */}
                <div
                    ref={deckRef}
                    className="absolute top-1/2 left-8 transform -translate-y-1/2"
                >
                    <div className="relative">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute"
                                style={{ top: `-${i}px`, left: `-${i}px` }}
                            >
                                {getCardBackImage(1, 'w-16 h-24 rounded shadow-lg')}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Current Trick */}
                <div
                    ref={trickRef}
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-32 z-20"
                >
                    {gameState.trick.map((play, index) => {
                        const positions = [
                            { x: 0, y: 40 },    // Bottom (You)
                            { x: 40, y: 0 },    // Right
                            { x: 0, y: -40 },   // Top (Partner)
                            { x: -40, y: 0 }    // Left
                        ];
                        const pos = positions[play.playerId];

                        return (
                            <div
                                key={`trick-${index}`}
                                data-trick-card
                                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                                style={{
                                    transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`
                                }}
                            >
                                {getCardImage(play.card.suit, play.card.rank, 'w-16 h-24 rounded shadow-lg')}
                            </div>
                        );
                    })}
                </div>

                {/* Player Hands */}

                {/* Bottom Player (You) - Fan layout */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                    <div className="text-center mb-2">
                        <span className={`text-sm font-medium px-2 py-1 rounded ${
                            gameState.currentPlayer === 0
                                ? 'bg-amber-600 text-emerald-900'
                                : 'text-emerald-300'
                        }`}>
                            {PLAYER_NAMES[0]} ({gameState.hands[0]?.length || 0})
                        </span>
                    </div>
                    <div className="flex justify-center items-end" style={{ minHeight: '120px' }}>
                        {gameState.hands[0]?.map((card, index) => {
                            const totalCards = gameState.hands[0].length;
                            const centerIndex = (totalCards - 1) / 2;
                            const angleStep = Math.min(8, 30 / totalCards); // Max 8 degrees per card
                            const rotation = (index - centerIndex) * angleStep;
                            const xOffset = (index - centerIndex) * Math.min(12, 60 / totalCards); // Adjust spacing
                            const yOffset = Math.abs(index - centerIndex) * -3; // Slight arc

                            return (
                                <div
                                    key={`${card.suit}-${card.rank}-${index}`}
                                    className="absolute"
                                    style={{
                                        transform: `translate(${xOffset}px, ${yOffset}px) rotate(${rotation}deg)`,
                                        transformOrigin: 'center bottom',
                                        zIndex: index
                                    }}
                                >
                                    <button
                                        data-card-id="player-0-card"
                                        data-suit={card.suit}
                                        data-rank={card.rank}
                                        className={`transition-all hover:scale-105 hover:-translate-y-4 hover:z-30 ${
                                            gameState.currentPlayer === 0 && gameState.phase === 'PLAYING'
                                                ? 'cursor-pointer'
                                                : 'cursor-not-allowed opacity-60'
                                        }`}
                                        onClick={() => playCard(card, 0)}
                                        disabled={gameState.currentPlayer !== 0 || gameState.phase !== 'PLAYING'}
                                    >
                                        {getCardImage(card.suit, card.rank, 'w-16 h-24 rounded shadow-lg')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Player */}
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <div className="text-center mb-2">
                        <span className={`text-sm font-medium px-2 py-1 rounded ${
                            gameState.currentPlayer === 1
                                ? 'bg-amber-600 text-emerald-900'
                                : 'text-emerald-300'
                        }`}>
                            {PLAYER_NAMES[1]} ({gameState.hands[1]?.length || 0})
                        </span>
                    </div>
                    <div className="flex flex-col items-center" style={{ minWidth: '80px', minHeight: '200px' }}>
                        {gameState.hands[1]?.map((card, index) => {
                            const totalCards = gameState.hands[1].length;
                            const centerIndex = (totalCards - 1) / 2;
                            const angleStep = Math.min(6, 25 / totalCards);
                            const rotation = (index - centerIndex) * angleStep;
                            const yOffset = (index - centerIndex) * Math.min(8, 40 / totalCards);
                            const xOffset = Math.abs(index - centerIndex) * -2;

                            return (
                                <div
                                    key={`right-${index}`}
                                    data-card-id="player-1-card"
                                    data-suit={card.suit}
                                    data-rank={card.rank}
                                    className="absolute"
                                    style={{
                                        transform: `translate(${xOffset}px, ${yOffset}px) rotate(${rotation}deg)`,
                                        transformOrigin: 'center right',
                                        zIndex: index
                                    }}
                                >
                                    {getCardBackImage(1, 'w-12 h-18 rounded shadow')}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Top Player (Partner) */}
                <div className="absolute top-16 left-1/2 transform -translate-x-1/2">
                    <div className="text-center mb-2">
                        <span className={`text-sm font-medium px-2 py-1 rounded ${
                            gameState.currentPlayer === 2
                                ? 'bg-amber-600 text-emerald-900'
                                : 'text-emerald-300'
                        }`}>
                            {PLAYER_NAMES[2]} ({gameState.hands[2]?.length || 0})
                        </span>
                    </div>
                    <div className="flex justify-center items-start" style={{ minHeight: '120px' }}>
                        {gameState.hands[2]?.map((card, index) => {
                            const totalCards = gameState.hands[2].length;
                            const centerIndex = (totalCards - 1) / 2;
                            const angleStep = Math.min(-8, -30 / totalCards); // Negative for downward fan
                            const rotation = (index - centerIndex) * angleStep;
                            const xOffset = (index - centerIndex) * Math.min(12, 60 / totalCards);
                            const yOffset = Math.abs(index - centerIndex) * 3;

                            return (
                                <div
                                    key={`partner-${index}`}
                                    data-card-id="player-2-card"
                                    data-suit={card.suit}
                                    data-rank={card.rank}
                                    className="absolute"
                                    style={{
                                        transform: `translate(${xOffset}px, ${yOffset}px) rotate(${rotation}deg)`,
                                        transformOrigin: 'center top',
                                        zIndex: index
                                    }}
                                >
                                    {getCardBackImage(1, 'w-12 h-18 rounded shadow')}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Left Player */}
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                    <div className="text-center mb-2">
                        <span className={`text-sm font-medium px-2 py-1 rounded ${
                            gameState.currentPlayer === 3
                                ? 'bg-amber-600 text-emerald-900'
                                : 'text-emerald-300'
                        }`}>
                            {PLAYER_NAMES[3]} ({gameState.hands[3]?.length || 0})
                        </span>
                    </div>
                    <div className="flex flex-col items-center" style={{ minWidth: '80px', minHeight: '200px' }}>
                        {gameState.hands[3]?.map((card, index) => {
                            const totalCards = gameState.hands[3].length;
                            const centerIndex = (totalCards - 1) / 2;
                            const angleStep = Math.min(-6, -25 / totalCards);
                            const rotation = (index - centerIndex) * angleStep;
                            const yOffset = (index - centerIndex) * Math.min(8, 40 / totalCards);
                            const xOffset = Math.abs(index - centerIndex) * 2;

                            return (
                                <div
                                    key={`left-${index}`}
                                    data-card-id="player-3-card"
                                    data-suit={card.suit}
                                    data-rank={card.rank}
                                    className="absolute"
                                    style={{
                                        transform: `translate(${xOffset}px, ${yOffset}px) rotate(${rotation}deg)`,
                                        transformOrigin: 'center left',
                                        zIndex: index
                                    }}
                                >
                                    {getCardBackImage(1, 'w-12 h-18 rounded shadow')}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Bidding Interface */}
            {gameState.phase === 'BIDDING' && (
                <div className="bg-emerald-900 rounded-lg p-6 border border-emerald-700">
                    <h3 className="text-xl font-bold text-amber-400 mb-4">
                        Bidding Phase - {PLAYER_NAMES[gameState.currentPlayer]}'s turn
                    </h3>
                    {gameState.currentPlayer === 0 ? (
                        <div>
                            <div className="grid grid-cols-4 gap-3 mb-4">
                                {SUITS.map(suit => (
                                    <button
                                        key={suit}
                                        onClick={() => simulateBid(suit, 80)}
                                        className="bg-emerald-700 hover:bg-emerald-600 text-white p-3 rounded-lg border border-emerald-500 transition-colors"
                                    >
                                        <div className="text-center">
                                            <div className="font-medium">{suit}</div>
                                            <div className="text-sm text-emerald-300">80 pts</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={passBid}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
                            >
                                Pass
                            </button>
                        </div>
                    ) : (
                        <div className="text-emerald-300">
                            Waiting for {PLAYER_NAMES[gameState.currentPlayer]} to bid...
                        </div>
                    )}
                </div>
            )}

            {/* Game Status */}
            <div className="text-center text-emerald-300">
                {gameState.phase === 'DEALING' && "Dealing cards..."}
                {gameState.phase === 'BIDDING' && "Bidding phase - choose trump suit or pass"}
                {gameState.phase === 'PLAYING' && (
                    gameState.currentPlayer === 0
                        ? "Your turn - click a card to play"
                        : `Waiting for ${PLAYER_NAMES[gameState.currentPlayer]}...`
                )}
                {gameState.phase === 'TRICK_END' && "Trick complete - collecting cards..."}
                {gameState.phase === 'GAME_END' && "Game finished!"}
            </div>
        </div>
    );
};