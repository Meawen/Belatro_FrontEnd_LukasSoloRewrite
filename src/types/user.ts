import type {Role, Instant} from './common';

export interface User {
    id: string | null;
    username: string | null;
    email: string | null;
    passwordHashed: string | null;
    eloRating: number | null;
    level: number | null;
    expPoints: number | null;
    lastLogin: string | null; // ISO date string
    gamesPlayed: number | null;
    roles: Role[] | null;
    deletionRequested: boolean | null;
}

export interface UserSimpleDTO {
    id: string | null;
    username: string | null;
}

export interface UserUpdateDTO {
    username: string | null;
    email: string | null;
    passwordHashed: string | null;
    eloRating: number | null;
    level: number | null;
    expPoints: number | null;
    lastLogin: string | null; // ISO date string
    gamesPlayed: number | null;
}

export interface UserDto {
    id: string | null;
    username: string | null;
    email: string | null;
    roles: Role[] | null;
    deletionRequested: boolean | null;
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