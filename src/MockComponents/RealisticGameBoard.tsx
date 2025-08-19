import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useCards } from '../hooks/useCards';
import type { Card } from '../hooks/useGameWebSocket';

interface GameState {
    phase: 'DEALING' | 'BIDDING' | 'PLAYING' | 'TRICK_END' | 'GAME_END';
    currentPlayer: number;
    trick: { card: Card; playerId: number }[];
    scores: { teamA: number; teamB: number };
    trumpSuit: string | null;
    dealer: number;
    hands: Card[][];
    playerTalons: Card[][];
    currentBid: { player: number; suit: string; points: number } | null;
    gameHistory: string[];
    chatMessages: { player: string; message: string; timestamp: Date }[];
}

const PLAYER_NAMES = ['You', 'Right', 'Partner', 'Left'];
const SUITS = ['Herc', 'Karo', 'Pik', 'Tref'];
const RANKS = ['7', '8', '9', '10', 'Decko', 'Baba', 'Kralj', 'As'];

const createDeck = (): Card[] => {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank });
        }
    }
    return deck;
};

const LAYOUT = {
    size: { you: 'w-28 h-42', opp: 'w-20 h-32', talon: 'w-16 h-24' },
    spread: { you: 600, top: 500, side: 400 },
    rotateStep: { you: 1.4, top: -1.4, left: 1.1, right: -1.1 },
    arcStep: { you: -2.5, top: 2.5, side: 2.5 },
    talonOverlap: -10
};

function fanTransformHorizontal(index: number, total: number, spread: number, rotateStep: number, arcStep: number) {
    if (total <= 1) return { x: 0, y: 0, rot: 0, z: 10 };
    const center = (total - 1) / 2;

    // Dynamically adjust spread based on card count - tighter when fewer cards
    const maxSpread = spread;
    const minSpread = spread * 0.3; // Minimum 30% of original spread
    const spreadMultiplier = Math.min(1, total / 8); // Scale down when less than 8 cards
    const adjustedSpread = minSpread + (maxSpread - minSpread) * spreadMultiplier;

    const spacing = adjustedSpread / Math.max(1, total - 1);
    const x = (index - center) + 0.0001;
    return {
        x: x * spacing,
        y: Math.abs(x) * arcStep,
        rot: x * rotateStep,
        z: 10 + index
    };
}

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
    const [chatInput, setChatInput] = useState('');
    const [gameState, setGameState] = useState<GameState>({
        phase: 'DEALING',
        currentPlayer: 0,
        trick: [],
        scores: { teamA: 0, teamB: 0 },
        trumpSuit: null,
        dealer: 0,
        hands: [[], [], [], []],
        playerTalons: [[], [], [], []],
        currentBid: null,
        gameHistory: [],
        chatMessages: []
    });

    const [hoveredSuit, setHoveredSuit] = useState<string | null>(null);


    const containerRef = useRef<HTMLDivElement>(null);
    const trickRef = useRef<HTMLDivElement>(null);

    const getSuitColor = (suit: string) => {
        switch (suit.toLowerCase()) {
            case 'pik': return 'rgba(34, 197, 94, 0.6)'; // Green
            case 'karo': return 'rgba(245, 158, 11, 0.6)'; // Gold
            case 'herc': return 'rgba(239, 68, 68, 0.6)'; // Red
            case 'tref': return 'rgba(139, 69, 19, 0.6)'; // Brown
            default: return 'rgba(156, 163, 175, 0.6)'; // Gray fallback
        }
    };

    const [biddingState, setBiddingState] = useState({
        passedPlayers: [] as number[],
        bidsReceived: 0
    });

    const canPass = () => {
        if (gameState.phase !== 'BIDDING' || gameState.currentPlayer !== 0) return false;

        // Check if this is the last player who hasn't passed yet
        const totalPlayers = 4;
        const playersWhoHaveBid = biddingState.passedPlayers.length + biddingState.bidsReceived;

        // If 3 players have already acted and no one bid, the last player must bid
        if (playersWhoHaveBid === totalPlayers - 1 && biddingState.bidsReceived === 0) {
            return false;
        }

        return true;
    };

    const handleSuitBid = (suit: string) => {
        if (gameState.phase !== 'BIDDING' || gameState.currentPlayer !== 0) return;

        try {
            simulateBid(suit, 80);
            setBiddingState(prev => ({
                ...prev,
                bidsReceived: prev.bidsReceived + 1
            }));
        } catch (error) {
            console.error('Error making bid:', error);
            addToHistory(`Error: Could not place bid for ${suit}`);
        }
    };

    const handlePass = () => {
        if (gameState.phase !== 'BIDDING' || gameState.currentPlayer !== 0) return;

        if (!canPass()) {
            addToHistory('Error: You must bid - you are the last player!');
            return;
        }

        try {
            setBiddingState(prev => ({
                ...prev,
                passedPlayers: [...prev.passedPlayers, gameState.currentPlayer]
            }));
            passBid();
        } catch (error) {
            console.error('Error passing bid:', error);
            addToHistory('Error: Could not pass bid');
        }
    };

    const startBiddingPhase = () => {
        setGameState(prev => ({
            ...prev,
            phase: 'BIDDING',
            currentPlayer: (prev.dealer + 1) % 4
        }));
        setBiddingState({
            passedPlayers: [],
            bidsReceived: 0
        });
        addToHistory('Bidding phase started');
    };






    const addToHistory = (message: string) => {
        setGameState(prev => ({
            ...prev,
            gameHistory: [message, ...prev.gameHistory].slice(0, 50) // Keep last 50 entries
        }));
    };

    const addChatMessage = (player: string, message: string) => {
        setGameState(prev => ({
            ...prev,
            chatMessages: [...prev.chatMessages, { player, message, timestamp: new Date() }].slice(-20) // Keep last 20 messages
        }));
    };

    const dealCards = async () => {
        const deck = shuffleDeck(createDeck());
        const hands: Card[][] = [[], [], [], []];
        const playerTalons: Card[][] = [[], [], [], []];
        let cardIndex = 0;

        addToHistory('New game started - dealing cards...');

        setGameState(prev => ({
            ...prev,
            hands: [[], [], [], []],
            playerTalons: [[], [], [], []],
            phase: 'DEALING'
        }));

        for (let round = 0; round < 2; round++) {
            for (let player = 0; player < 4; player++) {
                for (let cardNum = 0; cardNum < 3; cardNum++) {
                    if (cardIndex < deck.length) {
                        hands[player].push(deck[cardIndex++]);
                        await new Promise(resolve => {
                            setTimeout(() => {
                                setGameState(prev => {
                                    const newHands = [...prev.hands];
                                    newHands[player] = [...hands[player]];
                                    return { ...prev, hands: newHands };
                                });
                                resolve(void 0);
                            }, 150);
                        });
                    }
                }
            }
        }

        for (let player = 0; player < 4; player++) {
            for (let cardNum = 0; cardNum < 2; cardNum++) {
                if (cardIndex < deck.length) {
                    playerTalons[player].push(deck[cardIndex++]);
                }
            }
        }

        setGameState(prev => ({
            ...prev,
            playerTalons,
            phase: 'DEALING'
        }));

        addToHistory('Cards dealt - bidding phase will begin');

        // Start bidding phase after a short delay
        setTimeout(() => {
            startBiddingPhase();
        }, 1000);
    };


    const startNewGame = () => {
        setGameState(prev => ({
            ...prev,
            phase: 'DEALING',
            currentPlayer: 0,
            trick: [],
            scores: { teamA: 0, teamB: 0 },
            trumpSuit: null,
            dealer: Math.floor(Math.random() * 4),
            hands: [[], [], [], []],
            playerTalons: [[], [], [], []],
            currentBid: null
        }));

        setTimeout(() => {
            dealCards();
        }, 500);
    };

    const simulateBid = (suit: string, points: number) => {
        const newHands = [...gameState.hands];
        const newPlayerTalons = [...gameState.playerTalons];

        for (let player = 0; player < 4; player++) {
            if (newPlayerTalons[player].length >= 2) {
                newHands[player].push(...newPlayerTalons[player]);
                newPlayerTalons[player] = [];
            }
        }

        addToHistory(`${PLAYER_NAMES[gameState.currentPlayer]} bid ${points} points in ${suit}`);

        setGameState(prev => ({
            ...prev,
            currentBid: { player: prev.currentPlayer, suit, points },
            trumpSuit: suit,
            phase: 'PLAYING',
            currentPlayer: (prev.dealer + 1) % 4,
            hands: newHands,
            playerTalons: newPlayerTalons
        }));
    };
    const handleCardClick = (card: Card) => {
        if (gameState.phase === 'BIDDING' && gameState.currentPlayer === 0) {
            // Bid on this suit
            handleSuitBid(card.suit);
        } else if (gameState.phase === 'PLAYING' && gameState.currentPlayer === 0) {
            playCard(card, 0);
        }
    };

    const handleCardHover = (card: Card | null) => {
        if (gameState.phase === 'BIDDING' && gameState.currentPlayer === 0) {
            setHoveredSuit(card ? card.suit : null);
        }
    };




    const getSuitOutlineColor = (suit: string) => {
        switch (suit.toLowerCase()) {
            case 'pik': return 'outline-green-400';
            case 'karo': return 'outline-amber-400';
            case 'herc': return 'outline-red-400';
            case 'tref': return 'outline-yellow-700';
            default: return 'outline-gray-400';
        }
    };


    const renderPlayerCard = (card: Card, index: number, playerIndex: number) => {
        const isPlayerTurn = gameState.currentPlayer === playerIndex;
        const isBiddingPhase = gameState.phase === 'BIDDING';
        const isHoveredSuit = hoveredSuit === card.suit;
        const transform = fanTransformHorizontal(
            index,
            gameState.hands[playerIndex].length,
            LAYOUT.spread.you,
            LAYOUT.rotateStep.you,
            LAYOUT.arcStep.you
        );

        return (
            <div
                key={`${card.suit}-${card.rank}`}
                data-card-id={`player-${playerIndex}-card`}
                data-suit={card.suit}
                data-rank={card.rank}
                className={`
                    absolute ${LAYOUT.size.you} cursor-pointer transition-all duration-300
                    ${isBiddingPhase && isPlayerTurn && isHoveredSuit ? 'z-50' : ''}
                `}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rot}deg)`,
                    zIndex: transform.z + (isHoveredSuit ? 100 : 0),
                    filter: isBiddingPhase && isPlayerTurn && isHoveredSuit ?
                        `drop-shadow(0 0 15px ${getSuitColor(card.suit)}) brightness(1.3)` :
                        'none',
                }}
                onClick={() => {
                    if (gameState.phase === 'PLAYING' && isPlayerTurn) {
                        playCard(card, playerIndex);
                    }
                }}
            >
                {/* Shine effect for hovered suit during bidding */}
                {isBiddingPhase && isPlayerTurn && isHoveredSuit && (
                    <div
                        className="absolute inset-0 rounded-lg animate-pulse"
                        style={{
                            background: `linear-gradient(45deg, transparent 30%, ${getSuitColor(card.suit)}, transparent 70%)`,
                            animation: 'shimmer 1.5s infinite'
                        }}
                    />
                )}
                {getCardImage(card.suit, card.rank, 'w-full h-full rounded-lg shadow-lg')}
            </div>
        );
    };




    const passBid = () => {
        const nextPlayer = (gameState.currentPlayer + 1) % 4;
        addToHistory(`${PLAYER_NAMES[gameState.currentPlayer]} passed`);

        if (nextPlayer === (gameState.dealer + 1) % 4) {
            addToHistory('All players passed - restarting game');
            startNewGame();
            return;
        }

        setGameState(prev => ({
            ...prev,
            currentPlayer: nextPlayer
        }));
    };

    const playCard = (card: Card, playerIndex: number) => {
        if (gameState.phase !== 'PLAYING') return;
        if (playerIndex === 0 && gameState.currentPlayer !== 0) return;

        addToHistory(`${PLAYER_NAMES[playerIndex]} played ${card.rank} of ${card.suit}`);

        const cardElement = containerRef.current?.querySelector(
            `[data-card-id="player-${playerIndex}-card"][data-suit="${card.suit}"][data-rank="${card.rank}"]`
        ) as HTMLElement;

        if (cardElement && trickRef.current) {
            const trickRect = trickRef.current.getBoundingClientRect();
            const cardRect = cardElement.getBoundingClientRect();

            const positions = [
                { x: 0, y: 80 },
                { x: 80, y: 0 },
                { x: 0, y: -80 },
                { x: -80, y: 0 }
            ];
            const finalPos = positions[playerIndex];

            const cardClone = cardElement.cloneNode(true) as HTMLElement;
            cardClone.style.position = 'fixed';
            cardClone.style.left = `${cardRect.left}px`;
            cardClone.style.top = `${cardRect.top}px`;
            cardClone.style.zIndex = '1000';
            cardClone.style.pointerEvents = 'none';

            cardClone.removeAttribute('data-card-id');
            cardClone.removeAttribute('data-suit');
            cardClone.removeAttribute('data-rank');

            document.body.appendChild(cardClone);
            cardElement.style.opacity = '0';

            gsap.to(cardClone, {
                left: trickRect.left + finalPos.x,
                top: trickRect.top + finalPos.y,
                rotation: Math.random() * 30 - 15,
                scale: 1.1,
                duration: 0.6,
                ease: "power2.out",
                onComplete: () => {
                    cardClone.remove();
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
                }
            });
        } else {
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
        }

        setTimeout(() => {
            if (gameState.trick.length === 3) {
                setTimeout(() => {
                    const trickCards = containerRef.current?.querySelectorAll('[data-trick-card]');
                    if (trickCards) {
                        addToHistory('Trick completed - collecting cards');
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
                }, 1000);
            }
        }, 700);
    };

    const sendChatMessage = () => {
        if (chatInput.trim()) {
            addChatMessage('You', chatInput.trim());
            setChatInput('');
        }
    };

    useEffect(() => {
        if (gameState.phase === 'PLAYING' && gameState.currentPlayer !== 0) {
            const timer = setTimeout(() => {
                const playerHand = gameState.hands[gameState.currentPlayer];
                if (playerHand.length > 0) {
                    const randomCard = playerHand[Math.floor(Math.random() * playerHand.length)];
                    playCard(randomCard, gameState.currentPlayer);
                }
            }, 1500 + Math.random() * 1000);
            return () => clearTimeout(timer);
        }

        if (gameState.phase === 'BIDDING' && gameState.currentPlayer !== 0) {
            const timer = setTimeout(() => {
                if (Math.random() < 0.3) {
                    const randomSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
                    simulateBid(randomSuit, 80);
                } else {
                    passBid();
                }
            }, 1000 + Math.random() * 1500);
            return () => clearTimeout(timer);
        }
    }, [gameState.currentPlayer, gameState.phase]);

    useEffect(() => {
        if (gameState.hands.every(hand => hand.length === 0) && gameState.playerTalons.every(talon => talon.length === 0)) {
            startNewGame();
        }
    }, []);

    useEffect(() => {
        if (gameState.phase === 'DEALING' && gameState.hands.some(hand => hand.length === 6)) {
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
        <div className="flex min-h-screen bg-gradient-to-b from-emerald-950 to-emerald-900">
            {/* Game Area - 75% */}
            <div className="flex-grow w-3/4 p-4">
                <div ref={containerRef} className="space-y-4">
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

                            {/* Pass button for bidding phase */}
                            {gameState.phase === 'BIDDING' && gameState.currentPlayer === 0 && (
                                <button
                                    onClick={handlePass}
                                    disabled={!canPass()}
                                    className={`px-4 py-2 rounded font-medium transition-colors ${
                                        canPass()
                                            ? 'bg-gray-600 hover:bg-gray-500 text-white cursor-pointer'
                                            : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                    }`}
                                    title={!canPass() ? 'You must bid - you are the last player!' : 'Pass this round'}
                                >
                                    {canPass() ? 'Pass' : 'Must Bid!'}
                                </button>
                            )}

                            <div className="text-yellow-700">
                                Phase: <strong>{gameState.phase.replace('_', ' ')}</strong>
                                {gameState.trumpSuit && (
                                    <span className="ml-4">Trump: <strong>{gameState.trumpSuit}</strong></span>
                                )}
                                {gameState.phase !== 'DEALING' && (
                                    <span className="ml-4">Current: <strong>{PLAYER_NAMES[gameState.currentPlayer]}</strong></span>
                                )}
                            </div>
                        </div>

                        {/* Bidding status */}
                        {gameState.phase === 'BIDDING' && (
                            <div className="mt-2 text-sm text-yellow-600">
                                Passed: {biddingState.passedPlayers.length} players •
                                Bids: {biddingState.bidsReceived}
                                {gameState.currentPlayer === 0 && !canPass() && (
                                    <span className="ml-2 text-red-700 font-bold">⚠ You must bid!</span>
                                )}
                            </div>
                        )}
                    </div>


                    {/* Game Table */}
                    <div
                        className="relative rounded-[28px] p-10 border-[10px] border-amber-800/90 shadow-[0_14px_40px_rgba(0,0,0,0.35)] bg-gradient-to-b from-emerald-800 to-emerald-900"
                        style={{ minHeight: 800 }}
                    >
                        {/* Trick area (center) */}
                        <div ref={trickRef} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-48 z-10">
                            {gameState.trick.map((play, i) => {
                                const pos = [{x:0,y:80},{x:80,y:0},{x:0,y:-80},{x:-80,y:0}][play.playerId];
                                return (
                                    <div key={i} data-trick-card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                                         style={{ transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }}>
                                        {getCardImage(play.card.suit, play.card.rank, `${LAYOUT.size.opp} rounded shadow-lg`)}
                                    </div>
                                );
                            })}
                        </div>

                        {/* You (bottom) */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                            <div className="text-center mb-2">
                                <span className={`px-2 py-1 rounded text-sm ${gameState.currentPlayer===0 ? 'bg-amber-500 text-emerald-900' : 'text-emerald-200'}`}>
                                    You ({gameState.hands[0]?.length || 0})
                                </span>
                                {gameState.phase === 'BIDDING' && gameState.currentPlayer === 0 && (
                                    <div className="text-emerald-300 text-xs mt-1">
                                        {canPass()
                                            ? "Hover over cards to see suits, click to bid"
                                            : "⚠ You must bid - you are the last player!"
                                        }
                                    </div>
                                )}
                            </div>



                            {gameState.playerTalons[0].length>0 && (
                                <div className="absolute -top-24 left-1/2 -translate-x-1/2 z-30">
                                    <div className="text-center text-emerald-200 text-xs mb-1">Talon</div>
                                    <div className="flex justify-center">
                                        {gameState.playerTalons[0].map((_,i)=>(
                                            <div key={i} style={{ marginLeft: i ? LAYOUT.talonOverlap : 0 }}>
                                                {getCardBackImage(1, LAYOUT.size.talon + ' rounded-md shadow-md')}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}


                            <div className="relative" style={{ minWidth: LAYOUT.spread.you + 160, minHeight: 220 }}>
                                {/* Your cards */}
                                {gameState.hands[0]?.map((card, i) => {
                                    const t = fanTransformHorizontal(i, gameState.hands[0].length, LAYOUT.spread.you, LAYOUT.rotateStep.you, LAYOUT.arcStep.you);
                                    const isHoveredSuit = hoveredSuit === card.suit;
                                    const isBiddingPhase = gameState.phase === 'BIDDING';
                                    const isPlayerTurn = gameState.currentPlayer === 0;
                                    const isPlayingPhase = gameState.phase === 'PLAYING';

                                    return (
                                        <div key={`${card.suit}-${card.rank}-${i}`} className="absolute bottom-0 left-1/2"
                                             style={{
                                                 transform: `translate(${t.x}px, ${t.y}px) rotate(${t.rot}deg)`,
                                                 transformOrigin: 'center bottom',
                                                 zIndex: t.z + (isBiddingPhase && isHoveredSuit ? 100 : 0),
                                             }}>

                                            <button
                                                data-card-id="player-0-card" data-suit={card.suit} data-rank={card.rank}
                                                className={`transition-all duration-300 ${
                                                    isPlayerTurn && isPlayingPhase
                                                        ? 'hover:-translate-y-6 hover:scale-[1.06] cursor-pointer'
                                                        : isBiddingPhase && isPlayerTurn
                                                            ? 'cursor-pointer hover:-translate-y-2'
                                                            : 'opacity-60 cursor-not-allowed'
                                                } ${
                                                    isBiddingPhase && isPlayerTurn && isHoveredSuit
                                                        ? `outline outline-4 outline-offset-2 ${getSuitOutlineColor(card.suit)} shadow-lg`
                                                        : ''
                                                }`}
                                                onClick={() => {
                                                    if (isBiddingPhase && isPlayerTurn) {
                                                        handleSuitBid(card.suit);
                                                    } else if (isPlayingPhase && isPlayerTurn) {
                                                        playCard(card, 0);
                                                    }
                                                }}
                                                onMouseEnter={() => handleCardHover(card)}
                                                onMouseLeave={() => handleCardHover(null)}
                                                disabled={!isPlayerTurn || (gameState.phase !== 'PLAYING' && gameState.phase !== 'BIDDING')}
                                            >
                                                {getCardImage(card.suit, card.rank, `${LAYOUT.size.you} rounded-lg shadow-xl`)}
                                            </button>
                                        </div>
                                    );
                                })}

                                {/* Subtle Pass button - positioned to the side of cards */}
                                {gameState.phase === 'BIDDING' && gameState.currentPlayer === 0 && canPass() && (
                                    <div className="absolute bottom-12 -right-20 z-30">
                                        <button
                                            onClick={handlePass}
                                            className="
                                                w-16 h-16 rounded-full
                                                bg-emerald-800/80 hover:bg-emerald-700/90
                                                border-2 border-emerald-600/50 hover:border-emerald-500/70
                                                text-emerald-200 hover:text-emerald-100
                                                transition-all duration-300
                                                hover:scale-110 active:scale-95
                                                shadow-lg hover:shadow-xl
                                                backdrop-blur-sm
                                                flex items-center justify-center
                                            "
                                            title="Pass this round"
                                        >
                                            <span className="text-sm font-medium">Pass</span>
                                        </button>
                                    </div>
                                )}

                                {/* Warning message when can't pass */}
                                {gameState.phase === 'BIDDING' && gameState.currentPlayer === 0 && !canPass() && (
                                    <div className="absolute bottom-12 -right-24 z-30">
                                        <div className="
                                            px-3 py-2 rounded-lg
                                            bg-red-900/80 border border-red-600/50
                                            text-red-200 text-xs font-medium
                                            shadow-lg backdrop-blur-sm
                                            animate-pulse
                                        ">
                                            Must bid!
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>




                        {/* Right opponent */}
                        <div className="absolute right-8 top-1/3 -translate-y-1/2 z-10">
                            <div className="text-right mb-2">
                                <span className={`px-2 py-1 rounded text-sm ${gameState.currentPlayer===1?'bg-amber-500 text-emerald-900':'text-emerald-200'}`}>
                                    Right ({gameState.hands[1]?.length||0})
                                </span>
                            </div>

                            {gameState.playerTalons[1].length>0 && (
                                <div className="absolute -left-28 top-1/2 -translate-y-1/2 z-20">
                                    <div className="text-center text-emerald-200 text-xs mb-1">Talon</div>
                                    <div className="flex">
                                        {gameState.playerTalons[1].map((_,i)=>(
                                            <div key={i} style={{ marginLeft: i ? LAYOUT.talonOverlap : 0 }}>
                                                {getCardBackImage(1, LAYOUT.size.talon + ' rounded-md shadow-md')}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}


                            <div className="relative" style={{ minWidth: 220, minHeight: 380 }}>
                                {gameState.hands[1]?.map((_, i) => {
                                    const t = fanTransformHorizontal(i, gameState.hands[1].length, LAYOUT.spread.side, LAYOUT.rotateStep.right, LAYOUT.arcStep.side);
                                    return (
                                        <div key={`r-${i}`} className="absolute top-1/2 right-0"
                                             style={{ transform: `translate(${t.y}px, ${t.x}px) rotate(${90 + t.rot}deg)`, transformOrigin: 'center center', zIndex: t.z }}>
                                            {getCardBackImage(1, LAYOUT.size.opp + ' rounded-md shadow')}
                                        </div>
                                    );
                                })}
                            </div>

                        </div>

                        {/* Top partner */}
                        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
                            <div className="text-center mb-2">
                                <span className={`px-2 py-1 rounded text-sm ${gameState.currentPlayer===2?'bg-amber-500 text-emerald-900':'text-emerald-200'}`}>
                                    Partner ({gameState.hands[2]?.length||0})
                                </span>
                            </div>

                            {gameState.playerTalons[2].length>0 && (
                                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
                                    <div className="text-center text-emerald-200 text-xs mb-1">Talon</div>
                                    <div className="flex justify-center">
                                        {gameState.playerTalons[2].map((_,i)=>(
                                            <div key={i} style={{ marginLeft: i ? LAYOUT.talonOverlap : 0 }}>
                                                {getCardBackImage(1, LAYOUT.size.talon + ' rounded-md shadow-md')}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}


                            <div className="relative" style={{ minWidth: LAYOUT.spread.top + 200, minHeight: 220 }}>
                                {gameState.hands[2]?.map((_, i) => {
                                    const t = fanTransformHorizontal(i, gameState.hands[2].length, LAYOUT.spread.top, LAYOUT.rotateStep.top, LAYOUT.arcStep.top);
                                    return (
                                        <div key={`t-${i}`} className="absolute top-0 left-1/2"
                                             style={{ transform: `translate(${t.x}px, ${t.y}px) rotate(${180 + t.rot}deg)`, transformOrigin: 'center top', zIndex: t.z }}>
                                            {getCardBackImage(1, LAYOUT.size.opp + ' rounded-md shadow')}
                                        </div>
                                    );
                                })}
                            </div>

                        </div>

                        {/* Left opponent */}
                        <div className="absolute left-8 top-1/3 -translate-y-1/2 z-10">
                            <div className="text-left mb-2">
                                <span className={`px-2 py-1 rounded text-sm ${gameState.currentPlayer===3?'bg-amber-500 text-emerald-900':'text-emerald-200'}`}>
                                    Left ({gameState.hands[3]?.length||0})
                                </span>
                            </div>

                            {gameState.playerTalons[3].length>0 && (
                                <div className="absolute -right-28 top-1/2 -translate-y-1/2 z-20">
                                    <div className="text-center text-emerald-200 text-xs mb-1">Talon</div>
                                    <div className="flex">
                                        {gameState.playerTalons[3].map((_,i)=>(
                                            <div key={i} style={{ marginLeft: i ? LAYOUT.talonOverlap : 0 }}>
                                                {getCardBackImage(1, LAYOUT.size.talon + ' rounded-md shadow-md')}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="relative" style={{ minWidth: 220, minHeight: 380 }}>
                                {gameState.hands[3]?.map((_, i) => {
                                    const t = fanTransformHorizontal(i, gameState.hands[3].length, LAYOUT.spread.side, LAYOUT.rotateStep.left, LAYOUT.arcStep.side);
                                    return (
                                        <div key={`l-${i}`} className="absolute top-1/2 left-0"
                                             style={{ transform: `translate(${-t.y}px, ${t.x}px) rotate(${-90 + t.rot}deg)`, transformOrigin: 'center center', zIndex: t.z }}>
                                            {getCardBackImage(1, LAYOUT.size.opp + ' rounded-md shadow')}
                                        </div>
                                    );
                                })}
                            </div>

                        </div>
                    </div>

                    {/* Game Status */}
                    <div className="text-center text-emerald-300">
                        {gameState.phase === 'DEALING' && "Dealing cards..."}
                        {gameState.phase === 'BIDDING' && (
                            gameState.currentPlayer === 0 ? (
                                canPass() ?
                                    "Your turn - hover over cards to highlight suits, click to bid or use Pass button" :
                                    "⚠ You must bid - you are the last player! Click on a card suit."
                            ) : `Waiting for ${PLAYER_NAMES[gameState.currentPlayer]} to bid...`
                        )}
                        {gameState.phase === 'PLAYING' && (
                            gameState.currentPlayer === 0 ? "Your turn - click a card to play" : `Waiting for ${PLAYER_NAMES[gameState.currentPlayer]}...`
                        )}
                        {gameState.phase === 'TRICK_END' && "Trick complete - collecting cards..."}
                        {gameState.phase === 'GAME_END' && "Game finished!"}
                    </div>
                </div>
            </div>



            {/* Sidebar - 25% */}
            <div className="w-1/4 min-h-screen bg-emerald-900/95 backdrop-blur-sm border-l border-emerald-700 shadow-2xl">
                <div className="sticky top-0 p-4 space-y-4">
                    {/* Game History Card - Reduced height */}
                    <div className="bg-emerald-800/40 backdrop-blur-md rounded-xl border border-emerald-600/30 shadow-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-4 py-3 border-b border-emerald-600/30">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                                <h3 className="text-base font-semibold text-amber-300">Game History</h3>
                            </div>
                        </div>
                        <div className="h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-600 scrollbar-track-transparent">
                            <div className="p-3 space-y-2">
                                {gameState.gameHistory.map((entry, index) => (
                                    <div key={index} className="group">
                                        <div className="bg-emerald-800/60 hover:bg-emerald-700/60 transition-all duration-200 p-2 rounded-lg border border-emerald-600/50 hover:border-emerald-500">
                                            <p className="text-emerald-100 text-xs leading-relaxed">{entry}</p>
                                        </div>
                                    </div>
                                ))}
                                {gameState.gameHistory.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-6 text-emerald-400">
                                        <div className="w-8 h-8 bg-emerald-700/50 rounded-full flex items-center justify-center mb-2">
                                            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                                        </div>
                                        <p className="text-xs">No moves yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Enhanced Score Card - Compact */}
                    <div className="bg-emerald-800/40 backdrop-blur-md rounded-xl border border-emerald-600/30 shadow-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-500/30 to-yellow-500/30 px-4 py-3 border-b border-emerald-600/30 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/10 to-transparent animate-pulse"></div>
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"></div>
                                    <h3 className="text-base font-bold text-amber-200">Bela Blok</h3>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="space-y-3">
                                {/* Team A Score */}
                                <div className="relative">
                                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-lg border border-blue-500/30 shadow-lg">
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                                                {gameState.scores.teamA > gameState.scores.teamB && (
                                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full"></div>
                                                )}
                                            </div>
                                            <div>
                                                <span className="text-blue-200 font-bold text-sm">Team A</span>
                                                <div className="text-xs text-blue-300/70">You & Partner</div>
                                            </div>
                                        </div>
                                        <div className="text-blue-100 font-bold text-xl tabular-nums">
                                            {gameState.scores.teamA}
                                        </div>
                                    </div>
                                </div>

                                {/* VS Divider */}
                                <div className="flex items-center justify-center">
                                    <div className="bg-emerald-800 px-3 py-1 rounded-full border border-amber-400/50">
                                        <span className="text-amber-300 font-bold text-xs">VS</span>
                                    </div>
                                </div>

                                {/* Team B Score */}
                                <div className="relative">
                                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-600/20 to-rose-600/20 rounded-lg border border-red-500/30 shadow-lg">
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                                                {gameState.scores.teamB > gameState.scores.teamA && (
                                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full"></div>
                                                )}
                                            </div>
                                            <div>
                                                <span className="text-red-200 font-bold text-sm">Team B</span>
                                                <div className="text-xs text-red-300/70">Left & Right</div>
                                            </div>
                                        </div>
                                        <div className="text-red-100 font-bold text-xl tabular-nums">
                                            {gameState.scores.teamB}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {gameState.currentBid && (
                                <div className="mt-3 pt-3 border-t border-emerald-600/50">
                                    <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-lg p-3 border border-amber-400/30">
                                        <div className="text-amber-200 text-xs font-bold mb-1">CURRENT CONTRACT</div>
                                        <div className="text-amber-100 font-bold text-sm">
                                            {gameState.currentBid.points} points in {gameState.currentBid.suit}
                                        </div>
                                        <div className="text-amber-300/80 text-xs mt-1">
                                            by {PLAYER_NAMES[gameState.currentBid.player]}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chat Card - Compact */}
                    <div className="bg-emerald-800/40 backdrop-blur-md rounded-xl border border-emerald-600/30 shadow-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-green-500/20 to-teal-500/20 px-4 py-3 border-b border-emerald-600/30">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <h3 className="text-base font-semibold text-green-300">Chat</h3>
                            </div>
                        </div>
                        <div className="h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-600 scrollbar-track-transparent">
                            <div className="p-3 space-y-1">
                                {gameState.chatMessages.map((msg, index) => (
                                    <div key={index} className="bg-emerald-800/40 hover:bg-emerald-700/40 transition-all duration-200 p-2 rounded text-xs">
                                        <span className="text-amber-300 font-medium">{msg.player}:</span>
                                        <span className="text-emerald-100 ml-1">{msg.message}</span>
                                    </div>
                                ))}
                                {gameState.chatMessages.length === 0 && (
                                    <div className="flex items-center justify-center py-4 text-emerald-400">
                                        <p className="text-xs">No messages</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-3 bg-emerald-800/30 border-t border-emerald-600/30">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                                    placeholder="Type message..."
                                    className="flex-1 px-2 py-1 bg-emerald-800/60 text-emerald-100 placeholder-emerald-400 rounded border border-emerald-600/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50 text-xs"
                                />
                                <button
                                    onClick={sendChatMessage}
                                    className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-emerald-900 rounded text-xs font-medium transition-all duration-200"
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


        </div>
    );
};
