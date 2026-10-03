import type {Role, Instant} from './common';

export interface User {
    id: string | null;
    username: string | null;
    eloRating: number | null;
    level: number | null;
    gamesPlayed: number | null;
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