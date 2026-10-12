// Wire types of the game's STOMP channels. They mirror the backend records in
// Meawen/stiglja: dtos/PublicGameView, dtos/PrivateGameView, dtos/PlayerPublicInfo,
// dtos/BidDTO, dtos/QueueStatusDTO, pojo/gamelogic/Card and pojo/gamelogic/Trick.
// Player ids are usernames: the backend seats players by username.

export type Boja = 'KARA' | 'HERC' | 'TREF' | 'PIK';

export type Rank = 'SEDMICA' | 'OSMICA' | 'DEVETKA' | 'DECKO' | 'BABA' | 'KRALJ' | 'DESETKA' | 'AS';

export type GamePhase =
    | 'INITIALIZED'
    | 'BIDDING'
    | 'DECLARATIONS'
    | 'PLAYING'
    | 'SCORING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'HAND_COMPLETE';

/** Why a game ended other than by being played out (R-20, R-25): PublicGameView.endReason. */
export type EndReason = 'FORFEIT' | 'ABANDONED' | 'DECLINED' | 'CANCELLED';

export interface GameCard {
    boja: Boja;
    rank: Rank;
}

/** One seat. The backend also sent `username` (equal to `id`) until lane-debt E5. */
export interface PlayerPublicInfo {
    id: string;
    cardsLeft: number;
}

export interface GameBid {
    playerId: string;
    action: 'PASS' | 'CALL_TRUMP';
    selectedTrump: Boja | null;
}

/** The trick on the table; `plays` maps player id to card, and map order means nothing. */
export interface LiveTrick {
    leadPlayerId: string;
    trump: Boja | null;
    plays: Record<string, GameCard>;
    /** The card winning so far (Trick.getWinningCard); on a completed trick, the winner's card. */
    winningCard?: GameCard | null;
}

/** The hand's last completed trick (§6.1 lastTrick): `order` is the play order from `leadPlayerId`. */
export interface LastTrickView {
    leadPlayerId: string;
    plays: Record<string, GameCard>;
    order: string[];
    winnerId: string;
}

export interface DeclarationsView {
    bela: boolean;
    sequencesBySuit: Partial<Record<Boja, number>>;
    fourOfAKindPoints: number | null;
    bestSequencePoints: number | null;
}

export interface PublicGameView {
    gameId: string;
    gameState: GamePhase;
    bids: GameBid[];
    currentTrick: LiveTrick | null;
    teamAScore: number;
    teamBScore: number;
    teamA: PlayerPublicInfo[];
    teamB: PlayerPublicInfo[];
    challengeUsedByPlayer: Record<string, boolean>;
    /** "A" or "B" once COMPLETED, otherwise null. */
    winnerTeamId: 'A' | 'B' | null;
    tieBreaker: boolean;
    seatingOrder: PlayerPublicInfo[];
    declarations: Record<string, DeclarationsView>;
    belaDeclaredByPlayer: Record<string, boolean>;
    challengeWindowExpiresAt: number | null;
    /** The bidder in BIDDING, the player to act in PLAYING, otherwise null (R-27). */
    currentPlayerId: string | null;
    /** Epoch ms when the running turn timer fires, otherwise null (R-27). */
    turnExpiresAt: number | null;
    /** Set when a game ends by forfeit, abandonment, a decline or a cancel; otherwise null. */
    endReason: EndReason | null;
    /** The team that forfeited or left (FORFEIT, ABANDONED); otherwise null. */
    forfeitTeamId: 'A' | 'B' | null;
    // The fields below come from a newer backend (UI redesign spec §6.1); an older one sends none of them.
    /** Per-game counter, increased by every save; frames of one fan-out carry the same value. */
    stateVersion?: number;
    /** The hand's last completed trick; null before the first completes, reset at the deal. */
    lastTrick?: LastTrickView | null;
    /** Completed tricks of the current hand won by each team. */
    tricksWonA?: number;
    tricksWonB?: number;
    /** The current dealer's player id. */
    dealerId?: string | null;
    /** Epoch ms when the server built this view (clock skew for the countdowns). */
    serverNow?: number;
}

export interface PrivateGameView {
    publicPart: PublicGameView;
    hand: GameCard[];
    yourTurn: boolean;
    challengeUsed: boolean;
}

export interface QueueStatusDTO {
    state: 'IN_QUEUE' | 'MATCH_FOUND' | 'CANCELLED' | 'ERROR';
    estWaitSeconds: number;
    queueSize: number;
    mmr: number;
    matchId?: string;
}

/** Frames on /topic/games/{id}/rematch (RematchSocketController, R-45). */
export type RematchFrame =
    | { type: 'VOTE'; accepted: string[] }
    | { type: 'START'; newGameId: string }
    | { type: 'CANCEL'; by: string };
