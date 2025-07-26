// Game-specific types for future websocket implementation
export interface Card {
    suit: 'HEARTS' | 'DIAMONDS' | 'CLUBS' | 'SPADES';
    rank: 'ACE' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'JACK' | 'QUEEN' | 'KING';
    key: string; // For card image lookup
}

export interface GameState {
    matchId: string;
    currentPhase: GamePhase;
    currentPlayer: string | null;
    currentHand: number;
    currentTrick: number;
    playerHands: Record<string, Card[]>;
    playedCards: Card[];
    trump: string | null;
    scores: Record<string, number>;
}

export interface GameEvent {
    type: 'MOVE' | 'TRUMP_CALL' | 'CHALLENGE' | 'GAME_END' | 'PLAYER_JOIN' | 'PLAYER_LEAVE';
    playerId: string;
    data: any;
    timestamp: string;
}

export type GamePhase =
    | 'WAITING_FOR_PLAYERS'
    | 'DEALING'
    | 'TRUMP_CALLING'
    | 'PLAYING'
    | 'CHALLENGING'
    | 'HAND_END'
    | 'GAME_END';

export interface PlayerAction {
    type: 'PLAY_CARD' | 'CALL_TRUMP' | 'CHALLENGE' | 'PASS';
    card?: Card;
    trump?: string;
    target?: string;
}