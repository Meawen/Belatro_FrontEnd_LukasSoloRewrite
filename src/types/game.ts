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

/**
 * Why a game ended other than by being played out (R-20, R-25): PublicGameView.endReason. BELOT: a
 * player was dealt all eight of a suit, which wins the game at the trump call (gameplay rules spec §3).
 */
export type EndReason = 'FORFEIT' | 'ABANDONED' | 'DECLINED' | 'CANCELLED' | 'BELOT';

export interface GameCard {
    boja: Boja;
    rank: Rank;
}

/** One seat. The backend also sent `username` (equal to `id`) until lane-debt E5. */
export interface PlayerPublicInfo {
    id: string;
    cardsLeft: number;
    /** A server-side bot (casual bots spec §7); optional: a backend before bots doesn't send it. */
    bot?: boolean;
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

export type ZvanjaKind = 'RUN' | 'FOUR';
export type ZvanjaDecidedBy = 'VALUE' | 'FOUR' | 'HEIGHT' | 'ORDER';

/** One declaration that scored: a run (suit set, top = its top card) or a four (suit null, top = its rank). */
export interface DeclarationView {
    kind: ZvanjaKind;
    points: number;
    suit: Boja | null;
    top: Rank;
}

/** One seat in the declaration moment, in turn order from the player after the dealer. */
export interface ZvanjaSeatView {
    playerId: string;
    /** The seat's best value (20, 50, 100, 150, 200), or null for nothing. */
    said: number | null;
    /** Only when `said` ties the table's top value with another seat: the best's kind and its top card (run) or rank (four). */
    kind: ZvanjaKind | null;
    height: Rank | null;
    /** Every declaration that scored for this seat; empty for the losing team. */
    declarations: DeclarationView[];
    /** The cards of those declarations; empty for the losing team; a belot's eight. */
    cards: GameCard[];
}

/** The declarations said at the trump call (gameplay rules spec §5). */
export interface ZvanjaView {
    seats: ZvanjaSeatView[];
    /** The team whose declarations scored, or the belot holder's team; null when nobody declared. */
    winnerTeam: 'A' | 'B' | null;
    /** The winning team's declaration points, without bela. */
    total: number;
    decidedBy: ZvanjaDecidedBy | null;
    belot: { playerId: string; suit: Boja } | null;
    /** Epoch ms (server clock) when the first card may be played; null when nobody declared. */
    playOpensAt: number | null;
}

/** The game's last challenge (gameplay rules spec §5). */
export interface LastChallengeView {
    /** Counts up from 1 in the game. */
    number: number;
    playerId: string;
    team: 'A' | 'B';
    foulFound: boolean;
    /** True while it belongs to the hand on the table. */
    thisHand: boolean;
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
    /** Per player: their challenge is gone for the rest of the game (gameplay rules spec §1). */
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
    /** Set when a game ends by forfeit, abandonment, a decline, a cancel or a belot; otherwise null. */
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
    // The fields below come from a newer backend (gameplay rules spec §5); an older one sends neither of them.
    /** This hand's declarations, from its trump call to the end of the hand; null before the call. */
    zvanja?: ZvanjaView | null;
    /** The game's last challenge; null until the game's first. */
    lastChallenge?: LastChallengeView | null;
}

export interface PrivateGameView {
    publicPart: PublicGameView;
    hand: GameCard[];
    yourTurn: boolean;
    /** My challenge is gone for the rest of the game (gameplay rules spec §1). */
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
