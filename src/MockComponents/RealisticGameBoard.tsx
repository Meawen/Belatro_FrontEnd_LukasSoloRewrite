import React, { useState, useEffect, useRef, useMemo } from 'react';
import { gsap } from 'gsap';
import { useCards } from '../hooks/useCards';
import type { Card } from '../hooks/useGameWebSocket';
import { cardService } from '../services/cardService';

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
    teamTricks: { teamA: number; teamB: number }; // Add this
    challengeUsedByPlayer: Record<number, boolean>; // Track challenge usage by player
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
    spread: { you: 600, top: 180, side: 140 },
    rotateStep: { you: 1.4, top: -1.4, left: 1.1, right: -1.1 },
    arcStep: { you: -2.5, top: 2.5, side: 2.5 },
    talonOverlap: -10
};

function fanTransformHorizontal(index: number, total: number, spread: number, rotateStep: number, arcStep: number) {
    if (total <= 1) return { x: 0, y: 0, rot: 0, z: 10 };
    const center = (total - 1) / 2;

    // Enhanced dynamic spread adjustment with smoother curves
    const maxSpread = spread;
    const minSpread = spread * 0.35; // Slightly increased minimum spread
    const spreadMultiplier = Math.min(1, total / 8); // Scale down when less than 8 cards
    const adjustedSpread = minSpread + (maxSpread - minSpread) * spreadMultiplier;

    const spacing = adjustedSpread / Math.max(1, total - 1);
    const relativePosition = (index - center) + 0.0001;
    
    // Enhanced arc calculation for more natural fan spread
    const arcIntensity = Math.pow(Math.abs(relativePosition) / center, 1.2); // Exponential curve
    const arcDirection = Math.sign(relativePosition);
    
    return {
        x: relativePosition * spacing,
        y: arcIntensity * Math.abs(arcStep) * arcDirection * arcDirection, // Always positive for natural arc
        rot: relativePosition * rotateStep * (1 + arcIntensity * 0.1), // Slight rotation increase at edges
        z: 10 + index + (Math.abs(relativePosition) * 2) // Higher z-index for edge cards
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

    // Add seasonal animation styles
    React.useEffect(() => {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            @keyframes fallDown {
                0% { transform: translateY(-20px) rotateZ(0deg); opacity: 0; }
                10% { opacity: 0.7; }
                90% { opacity: 0.7; }
                100% { transform: translateY(100vh) rotateZ(360deg); opacity: 0; }
            }
            
            @keyframes floatUp {
                0% { transform: translateY(100vh) rotateZ(0deg); opacity: 0; }
                10% { opacity: 0.6; }
                50% { opacity: 0.8; }
                90% { opacity: 0.6; }
                100% { transform: translateY(-20px) rotateZ(180deg); opacity: 0; }
            }
            
            @keyframes snowfall {
                0% { transform: translateY(-20px) translateX(0px) rotateZ(0deg); opacity: 0; }
                10% { opacity: 0.8; }
                90% { opacity: 0.8; }
                100% { transform: translateY(100vh) translateX(50px) rotateZ(360deg); opacity: 0; }
            }
            
            @keyframes wheatSway {
                0%, 100% { transform: translateX(0px) rotate(0deg) scaleY(1); }
                25% { transform: translateX(3px) rotate(2deg) scaleY(1.05); }
                50% { transform: translateX(-2px) rotate(-1.5deg) scaleY(1.02); }
                75% { transform: translateX(4px) rotate(1deg) scaleY(1.03); }
            }
            
            @keyframes wheatHeadSway {
                0%, 100% { transform: rotate(0deg) translateX(0px); }
                25% { transform: rotate(3deg) translateX(2px); }
                50% { transform: rotate(-2deg) translateX(-1px); }
                75% { transform: rotate(2deg) translateX(3px); }
            }
            
            /* Realistic Wheat Stalk Styles */
            .wheat-stalk {
                position: relative;
                height: 40px;
                width: 3px;
                transform-origin: bottom center;
            }
            
            .wheat-stem {
                position: absolute;
                bottom: 0;
                left: 0;
                width: 3px;
                height: 35px;
                background: linear-gradient(to top, #8B7355 0%, #A0915C 50%, #B8A972 100%);
                border-radius: 1.5px;
                box-shadow: inset 0 0 2px rgba(0,0,0,0.3);
            }
            
            .wheat-head {
                position: absolute;
                top: -3px;
                left: -2px;
                width: 7px;
                height: 8px;
                background: linear-gradient(45deg, #D4AF37 0%, #DAA520 30%, #B8860B 70%, #CD853F 100%);
                border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
                animation: wheatHeadSway infinite ease-in-out;
                animation-duration: inherit;
                animation-delay: inherit;
                box-shadow: 
                    0 1px 2px rgba(0,0,0,0.2),
                    inset 0 0 3px rgba(255,255,255,0.3);
            }
            
            .wheat-head::before {
                content: '';
                position: absolute;
                top: 1px;
                left: 1px;
                width: 5px;
                height: 6px;
                background: linear-gradient(135deg, #F4E4BC 0%, #E6D690 100%);
                border-radius: 40%;
                opacity: 0.7;
            }
            
            .wheat-head::after {
                content: '';
                position: absolute;
                top: -1px;
                left: 2px;
                width: 1px;
                height: 3px;
                background: #8B4513;
                border-radius: 1px;
                opacity: 0.6;
            }
            
            /* Arena transition animations */
            @keyframes gradientShift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            
            @keyframes fadeInScale {
                0% { 
                    opacity: 0; 
                    transform: translateX(-20px) scale(0.8); 
                }
                50% { 
                    opacity: 0.7; 
                    transform: translateX(-5px) scale(0.95); 
                }
                100% { 
                    opacity: 1; 
                    transform: translateX(0px) scale(1); 
                }
            }
            
            @keyframes fadeInOverlay {
                0% { 
                    opacity: 0; 
                    transform: scale(1.1); 
                    filter: blur(2px); 
                }
                30% { 
                    opacity: 0.3; 
                    filter: blur(1px); 
                }
                100% { 
                    opacity: 1; 
                    transform: scale(1); 
                    filter: blur(0px); 
                }
            }
            
            .fall-pik-icons > div { animation: fallDown infinite linear; }
            .spring-petals > div { animation: floatUp infinite linear; }
            .winter-snow > div { animation: snowfall infinite linear; }
            .summer-wheat > div { animation: wheatSway infinite ease-in-out; }
        `;
        document.head.appendChild(styleElement);
        
        return () => {
            document.head.removeChild(styleElement);
        };
    }, []);
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
        chatMessages: [],
        teamTricks: { teamA: 0, teamB: 0 }, // Add this
        challengeUsedByPlayer: { 0: false, 1: false, 2: false, 3: false } // Initialize challenge usage
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

    const getArenaTheme = (trumpSuit: string | null) => {
        if (!trumpSuit) {
            return {
                background: 'bg-gradient-to-b from-emerald-800 to-emerald-900',
                border: 'border-amber-800/90'
            };
        }

        switch (trumpSuit.toLowerCase()) {
            case 'pik': // Fall theme
                return {
                    background: 'bg-gradient-to-b from-orange-800 to-amber-900',
                    border: 'border-orange-800/90'
                };
            case 'herc': // Spring theme
                return {
                    background: 'bg-gradient-to-b from-green-700 to-emerald-800',
                    border: 'border-green-700/90'
                };
            case 'tref': // Winter theme
                return {
                    background: 'bg-gradient-to-b from-slate-900 to-blue-950',
                    border: 'border-slate-800/90'
                };
            case 'karo': // Late summer theme
                return {
                    background: 'bg-gradient-to-b from-yellow-700 to-orange-800',
                    border: 'border-yellow-700/90'
                };
            default:
                return {
                    background: 'bg-gradient-to-b from-emerald-800 to-emerald-900',
                    border: 'border-amber-800/90'
                };
        }
    };

    const [biddingState, setBiddingState] = useState({
        passedPlayers: [] as number[],
        bidsReceived: 0
    });

    // Memoized stable positioning for trick piles to prevent jumping on rerenders
    const teamATrickPositions = useMemo(() => {
        return Array.from({ length: gameState.teamTricks.teamA }, (_, i) => ({
            randomX: (Math.random() - 0.5) * 8 + i * 3,
            randomY: (Math.random() - 0.5) * 8 - i * 2,
            randomRotation: (Math.random() - 0.5) * 30
        }));
    }, [gameState.teamTricks.teamA]);

    const teamBTrickPositions = useMemo(() => {
        return Array.from({ length: gameState.teamTricks.teamB }, (_, i) => ({
            randomX: (Math.random() - 0.5) * 8 - i * 3,
            randomY: (Math.random() - 0.5) * 8 + i * 2,
            randomRotation: (Math.random() - 0.5) * 30
        }));
    }, [gameState.teamTricks.teamB]);

    // Memoized seasonal animations to prevent rerender issues
    const pikFallingItems = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => ({
            id: `pik-${i}`,
            left: Math.random() * 100,
            animationDelay: Math.random() * 5,
            animationDuration: 3 + Math.random() * 4
        }));
    }, [gameState.trumpSuit]);

    const hercSpringPetals = useMemo(() => {
        return Array.from({ length: 10 }, (_, i) => ({
            id: `petal-${i}`,
            left: Math.random() * 100,
            animationDelay: Math.random() * 4,
            animationDuration: 4 + Math.random() * 3
        }));
    }, [gameState.trumpSuit]);

    const trefSnowflakes = useMemo(() => {
        return Array.from({ length: 15 }, (_, i) => ({
            id: `snow-${i}`,
            left: Math.random() * 100,
            animationDelay: Math.random() * 6,
            animationDuration: 2 + Math.random() * 3
        }));
    }, [gameState.trumpSuit]);

    // Memoized wheat animation arrays to prevent rerender issues
    const wheatLeftStalks = useMemo(() => {
        return Array.from({ length: 300 }, (_, i) => {
            const layer = Math.floor(i / 100); // 3 layers of 100 each
            const indexInLayer = i % 100;
            return {
                id: `wheat-left-${i}`,
                layer,
                indexInLayer,
                leftPosition: 0.2 + layer * 2 + Math.random() * 4, // Wider spread: 0.2% to 10.2%
                topPosition: 2 + indexInLayer * 0.9, // Denser vertical packing
                animationDelay: (i * 0.025) % 10, // Extended delay range
                animationDuration: 1.8 + Math.random() * 2.4
            };
        });
    }, [gameState.trumpSuit]);

    const wheatRightStalks = useMemo(() => {
        return Array.from({ length: 300 }, (_, i) => {
            const layer = Math.floor(i / 100); // 3 layers of 100 each
            const indexInLayer = i % 100;
            return {
                id: `wheat-right-${i}`,
                layer,
                indexInLayer,
                rightPosition: 0.2 + layer * 2 + Math.random() * 4, // Wider spread: 0.2% to 10.2%
                topPosition: 3 + indexInLayer * 0.9, // Denser vertical packing
                animationDelay: (i * 0.02 + 4) % 10, // Extended delay range with offset
                animationDuration: 2 + Math.random() * 2.2
            };
        });
    }, [gameState.trumpSuit]);

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

    const handleChallenge = () => {
        const playerIndex = 0; // Player "You"
        
        if (gameState.challengeUsedByPlayer[playerIndex]) {
            addToHistory('Error: You have already used your challenge!');
            return;
        }

        if (gameState.phase !== 'PLAYING') {
            addToHistory('Error: Can only challenge during the playing phase!');
            return;
        }

        // Mark challenge as used for this player
        setGameState(prev => ({
            ...prev,
            challengeUsedByPlayer: {
                ...prev.challengeUsedByPlayer,
                [playerIndex]: true
            }
        }));

        addToHistory(`${PLAYER_NAMES[playerIndex]} issued a challenge!`);
        
        // Mock challenge outcome (in real game, this would be determined by the backend)
        const challengeSuccess = Math.random() > 0.5;
        if (challengeSuccess) {
            addToHistory('Challenge successful! Opponent team loses points.');
            // In a real game, points would be adjusted here
        } else {
            addToHistory('Challenge failed! No penalty applied.');
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
                    absolute ${LAYOUT.size.you} cursor-pointer transition-all duration-500 ease-out
                    hover:scale-105 transform-gpu
                    ${isBiddingPhase && isPlayerTurn && isHoveredSuit ? 'z-50 scale-110' : ''}
                `}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rot}deg)`,
                    zIndex: transform.z + (isHoveredSuit ? 100 : 0),
                    filter: isBiddingPhase && isPlayerTurn && isHoveredSuit ?
                        `drop-shadow(0 0 8px ${getSuitColor(card.suit)})` :
                        'none',
                }}
                onClick={() => {
                    if (gameState.phase === 'PLAYING' && isPlayerTurn) {
                        playCard(card, playerIndex);
                    }
                }}
            >
                {/* Subtle glow effect for hovered suit during bidding */}
                {isBiddingPhase && isPlayerTurn && isHoveredSuit && (
                    <div
                        className="absolute inset-0 rounded-lg pointer-events-none"
                        style={{
                            background: `linear-gradient(45deg, transparent 40%, ${getSuitColor(card.suit).replace('0.6', '0.2')}, transparent 60%)`,
                            transition: 'all 0.3s ease-in-out'
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

        // Get the card element to animate
        const cardSelector = playerIndex === 0
            ? `[data-card-id="player-${playerIndex}-card"][data-suit="${card.suit}"][data-rank="${card.rank}"]`
            : `.player-${playerIndex}-hand .card-${card.suit}-${card.rank}`;

        const cardElement = containerRef.current?.querySelector(cardSelector) as HTMLElement;

        if (cardElement && trickRef.current) {
            const trickRect = trickRef.current.getBoundingClientRect();
            const cardRect = cardElement.getBoundingClientRect();

            // Trick positions for each player
            const positions = [
                { x: 0,   y: 100 },   // You (bottom)
                { x: 120, y: 0 },     // Right
                { x: 0,   y: -100 },  // Partner (top)
                { x: -120,y: 0 }      // Left
            ];
            const finalPos = positions[playerIndex];

            // Create animated card clone
            const cardClone = cardElement.cloneNode(true) as HTMLElement;
            cardClone.style.position = 'fixed';
            cardClone.style.left = `${cardRect.left}px`;
            cardClone.style.top = `${cardRect.top}px`;
            cardClone.style.zIndex = '1000';
            cardClone.style.pointerEvents = 'none';
            cardClone.style.transformOrigin = 'center center';

            // Clean up attributes
            cardClone.removeAttribute('data-card-id');
            cardClone.removeAttribute('data-suit');
            cardClone.removeAttribute('data-rank');

            document.body.appendChild(cardClone);

            // Hide original card
            if (cardElement) {
                cardElement.style.opacity = '0';
            }

            // Enhanced smooth animation to trick area with arc motion
            const tl = gsap.timeline();
            
            // Create arc motion by animating to intermediate position first
            const midX = (cardRect.left + trickRect.left + trickRect.width/2 + finalPos.x - cardRect.width/2) / 2;
            const midY = Math.min(cardRect.top, trickRect.top + trickRect.height/2 + finalPos.y - cardRect.height/2) - 50;
            
            tl.to(cardClone, {
                left: midX,
                top: midY,
                rotation: (Math.random() * 30 - 15) * 0.5, // Gentle rotation during flight
                scale: 1.05,
                duration: 0.4,
                ease: "power2.out"
            })
            .to(cardClone, {
                left: trickRect.left + trickRect.width/2 + finalPos.x - cardRect.width/2,
                top: trickRect.top + trickRect.height/2 + finalPos.y - cardRect.height/2,
                rotation: Math.random() * 15 - 7.5, // Final subtle rotation
                scale: 0.95,
                duration: 0.5,
                ease: "bounce.out",
                onComplete: () => {
                    // Add a subtle landing effect
                    gsap.to(cardClone, {
                        scale: 0.9,
                        duration: 0.1,
                        ease: "power1.out",
                        onComplete: () => {
                            cardClone.remove();
                            updateGameStateAfterPlay(card, playerIndex);
                        }
                    });
                }
            });
        } else {
            // Fallback without animation
            updateGameStateAfterPlay(card, playerIndex);
        }
    };

// Separate function to handle game state updates
    const updateGameStateAfterPlay = (card: Card, playerIndex: number) => {
        setGameState(prev => {
            const newHands = [...prev.hands];
            newHands[playerIndex] = newHands[playerIndex].filter(c =>
                !(c.suit === card.suit && c.rank === card.rank)
            );

            const newTrick = [...prev.trick, { card, playerId: playerIndex }];
            const trickComplete = newTrick.length === 4;

            if (trickComplete) {
                // Determine trick winner (simplified - just use first player for now)
                const winnerId = newTrick[0].playerId;
                const winnerTeam = (winnerId === 0 || winnerId === 2) ? 'teamA' : 'teamB';

                // Schedule trick collection animation
                setTimeout(() => collectTrick(winnerTeam), 1500);

                return {
                    ...prev,
                    hands: newHands,
                    trick: newTrick,
                    phase: 'TRICK_END'
                };
            } else {
                const nextPlayer = (prev.currentPlayer + 1) % 4;
                return {
                    ...prev,
                    hands: newHands,
                    trick: newTrick,
                    currentPlayer: nextPlayer
                };
            }
        });
    };

    const collectTrick = (winnerTeam: 'teamA' | 'teamB') => {
        const trickCards = containerRef.current?.querySelectorAll('[data-trick-card]');
        const teamPile = containerRef.current?.querySelector(`.${winnerTeam}-tricks`);

        if (trickCards && teamPile) {
            const pileRect = teamPile.getBoundingClientRect();

            // Animate all trick cards to the winning team's pile
            gsap.to(trickCards, {
                left: pileRect.left + pileRect.width/2,
                top: pileRect.top + pileRect.height/2,
                scale: 0.3,
                rotation: Math.random() * 360,
                duration: 1.2,
                stagger: 0.1,
                ease: "power2.in",
                onComplete: () => {
                    // Update game state - React will handle re-rendering and removing trick cards
                    setGameState(prev => {
                        const newTeamTricks = { ...prev.teamTricks };
                        newTeamTricks[winnerTeam]++;

                        const allHandsEmpty = prev.hands.every(hand => hand.length === 0);

                        return {
                            ...prev,
                            trick: [],
                            teamTricks: newTeamTricks,
                            phase: allHandsEmpty ? 'GAME_END' : 'PLAYING',
                            currentPlayer: prev.trick[0]?.playerId || 0 // Winner leads next trick
                        };
                    });

                    // Remove manual DOM manipulation - let React handle the cleanup
                    // The trick cards will be removed naturally when React re-renders with empty trick array
                }
            });
        }

        addToHistory(`${winnerTeam === 'teamA' ? 'Team A' : 'Team B'} wins the trick!`);
    };

    const renderTeamTrickPiles = () => {
        return (
            <>
                {/* Team A tricks (bottom left) */}
                <div className="absolute bottom-20 left-20 teamA-tricks z-5">
                    <div className="text-emerald-300 text-xs mb-1 text-center">Team A Tricks</div>
                    <div className="relative">
                        {teamATrickPositions.map((position, i) => (
                            <div
                                key={`teamA-trick-${i}`}
                                className="absolute w-16 h-20 rounded shadow-lg"
                                style={{
                                    transform: `translate(${position.randomX}px, ${position.randomY}px) rotate(${position.randomRotation}deg)`,
                                    zIndex: i
                                }}
                            >
                                {getCardBackImage(1, 'w-full h-full rounded')}
                            </div>
                        ))}
                        <div className="w-16 h-20 bg-blue-900/30 border-2 border-blue-600/30 border-dashed rounded flex items-center justify-center">
                            <span className="text-blue-400 text-lg font-bold">{gameState.teamTricks.teamA}</span>
                        </div>
                    </div>
                </div>

                {/* Team B tricks (top right) */}
                <div className="absolute top-20 right-8 teamB-tricks z-5">
                    <div className="text-emerald-300 text-xs mb-1 text-center">Team B Tricks</div>
                    <div className="relative">
                        {teamBTrickPositions.map((position, i) => (
                            <div
                                key={`teamB-trick-${i}`}
                                className="absolute w-16 h-20 rounded shadow-lg"
                                style={{
                                    transform: `translate(${position.randomX}px, ${position.randomY}px) rotate(${position.randomRotation}deg)`,
                                    zIndex: i
                                }}
                            >
                                {getCardBackImage(1, 'w-full h-full rounded')}
                            </div>
                        ))}
                        <div className="w-16 h-20 bg-red-900/30 border-2 border-red-600/30 border-dashed rounded flex items-center justify-center">
                            <span className="text-red-400 text-lg font-bold">{gameState.teamTricks.teamB}</span>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    const renderPlayerHand = (playerIndex: number) => {
        const hand = gameState.hands[playerIndex];
        if (!hand || hand.length === 0) return null;

        const positions = [
            {
                containerClass: "absolute bottom-6 left-1/2 -translate-x-1/2 z-20",
                cardClass: "absolute bottom-0 left-1/2",
                layout: { spread: LAYOUT.spread.you, rotateStep: LAYOUT.rotateStep.you, arcStep: LAYOUT.arcStep.you },
                size: LAYOUT.size.you,
                showFace: true
            },
            {
                containerClass: "absolute right-12 top-1/3 -translate-y-1/2 z-10",
                cardClass: "absolute top-1/2 right-0",
                layout: { spread: LAYOUT.spread.side, rotateStep: LAYOUT.rotateStep.right, arcStep: LAYOUT.arcStep.side },
                size: LAYOUT.size.opp,
                showFace: false
            },
            {
                containerClass: "absolute z-20",
                cardClass: "absolute top-0 left-1/2",
                layout: { spread: LAYOUT.spread.top, rotateStep: LAYOUT.rotateStep.top, arcStep: LAYOUT.arcStep.top },
                size: LAYOUT.size.opp,
                showFace: false,
                customStyle: { top: '8px', left: '50%', transform: 'translateX(-50%)' }
            },
            {
                containerClass: "absolute left-12 top-1/3 -translate-y-1/2 z-10",
                cardClass: "absolute top-1/2 left-0",
                layout: { spread: LAYOUT.spread.side, rotateStep: LAYOUT.rotateStep.left, arcStep: LAYOUT.arcStep.side },
                size: LAYOUT.size.opp,
                showFace: false
            }
        ];

        const config = positions[playerIndex];

        return (
            <div className={config.containerClass} style={config.customStyle || {}}>
                {/* Name above cards for You (0) and Partner (2) */}
                {(playerIndex === 0 || playerIndex === 2) && (
                    <div className={`mb-2 flex items-center gap-2 ${playerIndex === 0 ? 'justify-start pl-8' : 'text-center justify-center'}`}>
                    <span className={`px-2 py-1 rounded text-sm ${
                        gameState.currentPlayer === playerIndex ? 'bg-amber-500 text-emerald-900' : 'text-emerald-200'
                    }`}>
                        {PLAYER_NAMES[playerIndex]} ({hand.length})
                    </span>
                    {/* Challenge button next to main player's name */}
                    {playerIndex === 0 && gameState.phase === 'PLAYING' && (
                        <button
                            onClick={handleChallenge}
                            disabled={gameState.challengeUsedByPlayer[0]}
                            className={`px-3 py-1 rounded text-xs font-medium border-2 transition-all duration-300 ${
                                gameState.challengeUsedByPlayer[0]
                                    ? 'bg-gray-600/60 border-gray-500/50 text-gray-400 cursor-not-allowed opacity-50'
                                    : 'bg-red-600 hover:bg-red-700 border-red-500 hover:border-red-400 text-white hover:scale-105'
                            }`}
                            title={gameState.challengeUsedByPlayer[0] ? "Challenge already used" : "Issue a challenge"}
                        >
                            Challenge
                        </button>
                    )}
                    </div>
                )}

                {/* Player hand container */}
                <div className={`relative player-${playerIndex}-hand`} style={{
                    minWidth: playerIndex === 0 ? LAYOUT.spread.you + 160 : 220,
                    minHeight: playerIndex === 0 ? 220 : 380
                }}>
                    {hand.map((card, cardIndex) => {
                        const t = fanTransformHorizontal(
                            cardIndex,
                            hand.length,
                            config.layout.spread,
                            config.layout.rotateStep,
                            config.layout.arcStep
                        );

                        const isHoveredSuit = hoveredSuit === card.suit;
                        const isBiddingPhase = gameState.phase === 'BIDDING';
                        const isPlayerTurn = gameState.currentPlayer === playerIndex;

                        // Calculate rotation for different player positions
                        let rotation = t.rot;
                        let translateX = t.x;
                        let translateY = t.y;

                        if (playerIndex === 1) { // Right player
                            rotation += 90;
                            [translateX, translateY] = [translateY, translateX];
                        } else if (playerIndex === 2) { // Top player
                            rotation += 180;
                        } else if (playerIndex === 3) { // Left player
                            rotation -= 90;
                            [translateX, translateY] = [-translateY, translateX];
                        }

                        return (
                            <div
                                key={`${card.suit}-${card.rank}-${cardIndex}`}
                                className={`${config.cardClass} card-${card.suit}-${card.rank} transition-all duration-500 ease-out transform-gpu`}
                                style={{
                                    transform: `translate(${translateX}px, ${translateY}px) rotate(${rotation}deg)`,
                                    transformOrigin: 'center center',
                                    zIndex: t.z + (isBiddingPhase && isHoveredSuit ? 100 : 0)
                                }}
                            >
                                {playerIndex === 0 ? (
                                    // Your cards (interactive)
                                    <button
                                        data-card-id={`player-${playerIndex}-card`}
                                        data-suit={card.suit}
                                        data-rank={card.rank}
                                        className={`transition-all duration-500 ease-out transform-gpu ${
                                            isPlayerTurn && gameState.phase === 'PLAYING'
                                                ? 'hover:-translate-y-6 hover:scale-[1.08] cursor-pointer hover:shadow-2xl'
                                                : isBiddingPhase && isPlayerTurn
                                                    ? 'cursor-pointer hover:-translate-y-3 hover:scale-105'
                                                    : 'cursor-not-allowed'
                                        } ${
                                            isBiddingPhase && isPlayerTurn && isHoveredSuit
                                                ? `outline outline-4 outline-offset-2 ${getSuitOutlineColor(card.suit)} shadow-lg`
                                                : ''
                                        }`}
                                        onClick={() => handleCardClick(card)}
                                        onMouseEnter={() => handleCardHover(card)}
                                        onMouseLeave={() => handleCardHover(null)}
                                        disabled={!isPlayerTurn || (gameState.phase !== 'PLAYING' && gameState.phase !== 'BIDDING')}
                                    >
                                        {getCardImage(card.suit, card.rank, `${config.size} rounded-lg shadow-xl`)}
                                    </button>
                                ) : (
                                    // Other players' cards (card backs)
                                    <div className={`${config.size} rounded-lg shadow-lg transition-all duration-500 ease-out transform-gpu hover:scale-[1.02] hover:shadow-xl`}>
                                        {getCardBackImage(1, 'w-full h-full rounded-lg')}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Name below cards for Right (1) and Left (3) players */}
                {(playerIndex === 1 || playerIndex === 3) && (
                    <div className="text-center mt-2">
                    <span className={`px-2 py-1 rounded text-sm ${
                        gameState.currentPlayer === playerIndex ? 'bg-amber-500 text-emerald-900' : 'text-emerald-200'
                    }`}>
                        {PLAYER_NAMES[playerIndex]} ({hand.length})
                    </span>
                    </div>
                )}

                {/* Pass button for your hand during bidding */}
                {playerIndex === 0 && gameState.phase === 'BIDDING' && gameState.currentPlayer === 0 && canPass() && (
                    <div className="absolute bottom-12 -right-20 z-30">
                        <button
                            onClick={handlePass}
                            className="w-16 h-16 rounded-full bg-emerald-800/80 hover:bg-emerald-700/90 border-2 border-emerald-600/50 hover:border-emerald-500/70 text-emerald-200 hover:text-emerald-100 transition-all duration-300 hover:scale-110 active:scale-95 shadow-lg hover:shadow-xl backdrop-blur-sm flex items-center justify-center"
                            title="Pass this round"
                        >
                            <span className="text-sm font-medium">Pass</span>
                        </button>
                    </div>
                )}


                {playerIndex === 0 && gameState.phase === 'BIDDING' && gameState.currentPlayer === 0 && !canPass() && (
                    <div className="absolute bottom-12 -right-24 z-30">
                        <div className="px-3 py-2 rounded-lg bg-red-900/80 border border-red-600/50 text-red-200 text-xs font-medium shadow-lg backdrop-blur-sm animate-pulse">
                            Must bid!
                        </div>
                    </div>
                )}
            </div>
        );
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
        <>
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
                        className={`relative rounded-[28px] p-10 border-[10px] ${getArenaTheme(gameState.trumpSuit).border} shadow-[0_14px_40px_rgba(0,0,0,0.35)] ${getArenaTheme(gameState.trumpSuit).background} transition-all duration-1500 ease-in-out overflow-hidden`}
                        style={{ 
                            minHeight: 800,
                            backgroundSize: '400% 400%',
                            animation: gameState.trumpSuit ? 'gradientShift 3s ease-in-out' : 'none'
                        }}
                    >
                        {/* Trump Suit Icon - Top Left with enhanced transition */}
                        {gameState.trumpSuit && (
                            <div 
                                className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20 transform transition-all duration-1000 ease-out animate-slideInFromLeft"
                                style={{
                                    animation: 'fadeInScale 1.2s ease-out 0.3s both'
                                }}
                            >
                                <img 
                                    src={cardService.getSuitIconUrl(gameState.trumpSuit)}
                                    alt={`${gameState.trumpSuit} trump`}
                                    className="w-8 h-8 object-contain transform transition-transform duration-500 hover:scale-110"
                                />
                                <div className="text-white/90 text-sm font-medium">
                                    Trump: {gameState.trumpSuit}
                                </div>
                            </div>
                        )}

                        {/* Seasonal Animation Overlay with enhanced transitions */}
                        {gameState.trumpSuit && (
                            <div 
                                className="absolute inset-0 pointer-events-none z-5 overflow-hidden"
                                style={{
                                    animation: 'fadeInOverlay 2s ease-out 0.5s both'
                                }}
                            >
                                {gameState.trumpSuit.toLowerCase() === 'pik' && (
                                    /* Fall - Falling Pik Icons */
                                    <div className="seasonal-animation fall-pik-icons">
                                        {pikFallingItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="absolute opacity-70 falling-pik-item"
                                                style={{
                                                    left: `${item.left}%`,
                                                    animationDelay: `${item.animationDelay}s`,
                                                    animationDuration: `${item.animationDuration * 1.5}s`, // Slower movement for consistency
                                                    zIndex: 6
                                                }}
                                            >
                                                <img 
                                                    src={cardService.getSuitIconUrl('Pik')}
                                                    alt="Falling Pik"
                                                    className="w-8 h-8 object-contain filter drop-shadow-lg"
                                                    onError={(e) => {
                                                        // Fallback to Pik emoji if image fails to load
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                        const fallback = target.parentElement?.querySelector('.pik-fallback');
                                                        if (fallback) {
                                                            (fallback as HTMLElement).style.display = 'block';
                                                        }
                                                    }}
                                                    onLoad={(e) => {
                                                        // Hide fallback if image loads successfully
                                                        const target = e.target as HTMLImageElement;
                                                        const fallback = target.parentElement?.querySelector('.pik-fallback');
                                                        if (fallback) {
                                                            (fallback as HTMLElement).style.display = 'none';
                                                        }
                                                    }}
                                                />
                                                <div 
                                                    className="pik-fallback w-8 h-8 flex items-center justify-center text-2xl" 
                                                    style={{ display: 'none' }}
                                                >
                                                    ♠️
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {gameState.trumpSuit.toLowerCase() === 'herc' && (
                                    /* Spring - Floating Flowers & Herc Icons */
                                    <div className="seasonal-animation spring-petals">
                                        {/* Floating flower emojis */}
                                        {hercSpringPetals.map((item) => (
                                            <div
                                                key={`flower-${item.id}`}
                                                className="absolute w-6 h-6 opacity-70 floating-flower-item"
                                                style={{
                                                    left: `${item.left}%`,
                                                    animationDelay: `${item.animationDelay}s`,
                                                    animationDuration: `${item.animationDuration * 1.5}s`, // Slower movement
                                                    zIndex: 5
                                                }}
                                            >
                                                <div className="text-2xl">🌸</div>
                                            </div>
                                        ))}
                                        
                                        {/* Floating Herc suit icons */}
                                        {hercSpringPetals.map((item) => (
                                            <div
                                                key={`herc-${item.id}`}
                                                className="absolute w-8 h-8 opacity-60 floating-herc-item"
                                                style={{
                                                    left: `${(item.left + 10) % 100}%`, // Offset positioning
                                                    animationDelay: `${item.animationDelay + 1}s`, // Staggered timing
                                                    animationDuration: `${item.animationDuration * 1.8}s`, // Slower movement
                                                    zIndex: 6
                                                }}
                                            >
                                                <img 
                                                    src={cardService.getSuitIconUrl('Herc')}
                                                    alt="Floating Herc"
                                                    className="w-8 h-8 object-contain filter drop-shadow-lg"
                                                    onError={(e) => {
                                                        // Fallback to heart emoji if image fails to load
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                        const fallback = target.parentElement?.querySelector('.herc-fallback');
                                                        if (fallback) {
                                                            (fallback as HTMLElement).style.display = 'block';
                                                        }
                                                    }}
                                                    onLoad={(e) => {
                                                        // Hide fallback if image loads successfully
                                                        const target = e.target as HTMLImageElement;
                                                        const fallback = target.parentElement?.querySelector('.herc-fallback');
                                                        if (fallback) {
                                                            (fallback as HTMLElement).style.display = 'none';
                                                        }
                                                    }}
                                                />
                                                <div 
                                                    className="herc-fallback w-8 h-8 flex items-center justify-center text-2xl" 
                                                    style={{ display: 'none' }}
                                                >
                                                    ♥️
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {gameState.trumpSuit.toLowerCase() === 'tref' && (
                                    /* Winter - Falling Snowflakes & Tref Icons */
                                    <div className="seasonal-animation winter-snow">
                                        {/* Falling snowflake emojis */}
                                        {trefSnowflakes.map((item) => (
                                            <div
                                                key={`snow-${item.id}`}
                                                className="absolute w-6 h-6 opacity-85 falling-snow-item"
                                                style={{
                                                    left: `${item.left}%`,
                                                    animationDelay: `${item.animationDelay}s`,
                                                    animationDuration: `${item.animationDuration * 1.5}s`, // Slower movement
                                                    zIndex: 5
                                                }}
                                            >
                                                <div className="text-2xl">❄️</div>
                                            </div>
                                        ))}
                                        
                                        {/* Falling Tref suit icons */}
                                        {trefSnowflakes.map((item) => (
                                            <div
                                                key={`tref-${item.id}`}
                                                className="absolute w-8 h-8 opacity-80 falling-tref-item"
                                                style={{
                                                    left: `${(item.left + 15) % 100}%`, // Offset positioning
                                                    animationDelay: `${item.animationDelay + 0.8}s`, // Staggered timing
                                                    animationDuration: `${item.animationDuration * 1.8}s`, // Slower movement
                                                    zIndex: 6
                                                }}
                                            >
                                                <img 
                                                    src={cardService.getSuitIconUrl('Tref')}
                                                    alt="Falling Tref"
                                                    className="w-8 h-8 object-contain filter drop-shadow-lg"
                                                    onError={(e) => {
                                                        // Fallback to club emoji if image fails to load
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                        const fallback = target.parentElement?.querySelector('.tref-fallback');
                                                        if (fallback) {
                                                            (fallback as HTMLElement).style.display = 'block';
                                                        }
                                                    }}
                                                    onLoad={(e) => {
                                                        // Hide fallback if image loads successfully
                                                        const target = e.target as HTMLImageElement;
                                                        const fallback = target.parentElement?.querySelector('.tref-fallback');
                                                        if (fallback) {
                                                            (fallback as HTMLElement).style.display = 'none';
                                                        }
                                                    }}
                                                />
                                                <div 
                                                    className="tref-fallback w-8 h-8 flex items-center justify-center text-2xl" 
                                                    style={{ display: 'none' }}
                                                >
                                                    ♣️
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {gameState.trumpSuit.toLowerCase() === 'karo' && (
                                    /* Late Summer - Massive Wheat Fields Swaying in Wind */
                                    <div className="seasonal-animation summer-wheat">
                                        {/* Left side wheat field - Using memoized array for stable positioning */}
                                        {wheatLeftStalks.map((stalk) => (
                                            <div
                                                key={stalk.id}
                                                className="absolute"
                                                style={{
                                                    left: `${stalk.leftPosition}%`, // Stable positioning from memoized value
                                                    top: `${stalk.topPosition}%`, // Stable positioning from memoized value
                                                    opacity: 0.75 - stalk.layer * 0.12, // Slightly better visibility
                                                    transform: `scale(${1 - stalk.layer * 0.08})`, // Gentler scaling for depth
                                                    animationDelay: `${stalk.animationDelay}s`, // Stable timing from memoized value
                                                    animationDuration: `${stalk.animationDuration}s`, // Stable duration from memoized value
                                                    zIndex: 6 - stalk.layer
                                                }}
                                            >
                                                <div className="wheat-stalk">
                                                    <div className="wheat-stem"></div>
                                                    <div className="wheat-head"></div>
                                                </div>
                                            </div>
                                        ))}
                                        
                                        {/* Right side wheat field - Using memoized array for stable positioning */}
                                        {wheatRightStalks.map((stalk) => (
                                            <div
                                                key={stalk.id}
                                                className="absolute"
                                                style={{
                                                    right: `${stalk.rightPosition}%`, // Stable positioning from memoized value
                                                    top: `${stalk.topPosition}%`, // Stable positioning from memoized value
                                                    opacity: 0.75 - stalk.layer * 0.12, // Slightly better visibility
                                                    transform: `scale(${1 - stalk.layer * 0.08})`, // Gentler scaling for depth
                                                    animationDelay: `${stalk.animationDelay}s`, // Stable timing from memoized value
                                                    animationDuration: `${stalk.animationDuration}s`, // Stable duration from memoized value
                                                    zIndex: 6 - stalk.layer
                                                }}
                                            >
                                                <div className="wheat-stalk">
                                                    <div className="wheat-stem"></div>
                                                    <div className="wheat-head"></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Trick area (center) */}
                        <div ref={trickRef} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-72 z-10">
                            {gameState.trick.map((play, i) => {
                                const pos = [{x:0,y:80},{x:80,y:0},{x:0,y:-85},{x:-80,y:0}][play.playerId];
                                return (
                                    <div
                                        key={`trick-${play.playerId}-${i}`}
                                        data-trick-card
                                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                                        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
                                    >
                                        {getCardImage(play.card.suit, play.card.rank, `${LAYOUT.size.you} rounded shadow-lg`)}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Trump bidding buttons (center) */}
                        {gameState.phase === 'BIDDING' && gameState.currentPlayer === 0 && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="text-sm text-emerald-200 text-center font-medium">
                                        Trump Bid:
                                    </div>
                                    <div className="flex gap-4">
                                        {SUITS.map(suit => (
                                            <button
                                                key={suit}
                                                onClick={() => handleSuitBid(suit)}
                                                className={`
                                                    w-20 h-20 rounded-xl transition-all duration-300 
                                                    hover:scale-110 active:scale-95 shadow-lg hover:shadow-xl 
                                                    backdrop-blur-sm flex items-center justify-center
                                                    border-2 hover:border-opacity-70
                                                    ${suit === 'Pik' ? 'bg-green-800/80 hover:bg-green-700/90 border-green-600/50 hover:border-green-500/70' :
                                                      suit === 'Karo' ? 'bg-amber-800/80 hover:bg-amber-700/90 border-amber-600/50 hover:border-amber-500/70' :
                                                      suit === 'Herc' ? 'bg-red-800/80 hover:bg-red-700/90 border-red-600/50 hover:border-red-500/70' :
                                                      'bg-yellow-800/80 hover:bg-yellow-700/90 border-yellow-600/50 hover:border-yellow-500/70'}
                                                `}
                                                title={`Bid ${suit} as trump`}
                                            >
                                                <img 
                                                    src={cardService.getSuitIconUrl(suit)}
                                                    alt={`${suit} icon`}
                                                    className="w-12 h-12 object-contain"
                                                    onError={(e) => {
                                                        // Fallback to text if icon fails to load
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                        target.nextElementSibling!.textContent = suit[0];
                                                    }}
                                                />
                                                <span className="text-sm font-bold text-white hidden">{suit[0]}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Render all player hands */}
                        {[0, 1, 2, 3].map(playerIndex =>
                            <div key={`player-${playerIndex}`}>
                                {renderPlayerHand(playerIndex)}
                            </div>
                        )}

                        {/* Team trick piles */}
                        {renderTeamTrickPiles()}
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
                                    <div key={`history-${gameState.gameHistory.length - index}-${entry.slice(0, 20)}`} className="group">
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
                                    <div key={`chat-${index}-${msg.timestamp.getTime()}`} className="bg-emerald-800/40 hover:bg-emerald-700/40 transition-all duration-200 p-2 rounded text-xs">
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
        </>
    );
};
