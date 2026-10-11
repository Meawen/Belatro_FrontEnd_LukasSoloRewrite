import type {Role, Instant} from './common';

/** A player's rank (UserSummaryDto.rank; ranks spec §4.1). The backend owns the names and the breakpoints. */
export type RankKey = 'CUCEK' | 'DECEC' | 'FAKIN' | 'PAJDAS' | 'GOSPON' | 'MAJSTER' | 'KAJKAVAC';

export interface PlayerRank {
    key: RankKey;
    /** "Pajdaš": print this, never derive it from the key. */
    name: string;
    tagline: string;
    /** Where this rank starts (shown Elo); null for Cucek and Dečec. */
    minRating: number | null;
    /** Where the next rank starts; null for Cucek and Kajkavac. */
    nextMinRating: number | null;
}

export interface User {
    id: string | null;
    username: string | null;
    eloRating: number | null;
    level: number | null;
    gamesPlayed: number | null;
    /** Optional: a backend before team Elo doesn't send it (ranks spec §4.2). */
    rankedGamesPlayed?: number;
    /** Optional: a backend before team Elo doesn't send it; without it no rank shows (ranks spec §4.2). */
    rank?: PlayerRank | null;
}

/** GET /user/ladder: the placed players per binSize points (non-empty bins, lowest first) and per rank. */
export interface Ladder {
    players: number;
    binSize: number;
    bins: { from: number; count: number }[];
    /** All seven, in rank order; Cucek counts the players still placing. */
    ranks: { key: RankKey; name: string; minRating: number | null; count: number }[];
}

/** GET /user/{id}/rating-history: the rating after each of the last ≤ 100 ranked games, oldest first. */
export interface RatingHistory {
    rating: number;
    rankedGamesPlayed: number;
    /** The rating before the first point; null with no points. */
    startRating: number | null;
    points: { game: number; rating: number }[];
    /** What one even game moves the rating now (K / 2). */
    step: number;
    /** Points per game at the recent form, at today's step size; null during placement. */
    pace: number | null;
    paceGames: number;
}

export interface UserSimpleDTO {
    id: string | null;
    username: string | null;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface UserDto {
    id: string | null;
    username: string | null;
    /** The confirmed (or legacy, unconfirmed) address; null when the account has none. */
    email: string | null;
    /** An address waiting for its confirmation link (signup or change of address). */
    pendingEmail: string | null;
    emailVerified: boolean;
    roles: Role[] | null;
    deletionRequested: boolean | null;
}

export interface ChangeEmailRequest {
    newEmail: string;
    currentPassword: string;
}

export interface PlayerMatchSummaryDTO {
    matchId: string | null;
    endTime: Instant | null;
    result: string | null;
    yourOutcome: string | null;
    gameMode: 'CASUAL' | 'RANKED' | null;
}

export interface PlayerMatchHistoryDTO {
    history: import('./match').MatchHistoryDTO | null;
    yourResult: string | null;
}