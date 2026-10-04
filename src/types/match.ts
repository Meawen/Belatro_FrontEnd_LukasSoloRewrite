
import type {UserSimpleDTO} from './user';
import type {LobbyDTO} from './lobby';
import type {GameMode} from './common';

export interface MatchDTO {
    id: string | null;
    teamA: UserSimpleDTO[] | null;
    teamB: UserSimpleDTO[] | null;
    originLobby: LobbyDTO | null;
    gameMode: GameMode | null;
    result: string | null;
    startTime: string | null; // ISO date string
    endTime: string | null; // ISO date string
}

export interface MoveDTO {
    order: number | null;
    player: string | null;
    card: string | null;
    legal: boolean | null;
}

export interface TrumpCallDTO {
    order: number | null;
    player: string | null;
    trump: string | null;
}

export interface TrickDTO {
    trickNo: number | null;
    winnerId?: string | null;
    points?: number | null;
    moves: MoveDTO[] | null;
    lastTrickBonus: boolean | null;
}

export interface ChallengeDTO {
    order: number | null;
    player: string | null;
    success: boolean | null;
}

export interface HandSummary {
    teamAPoints: number;
    teamBPoints: number;
    teamADeclPoints: number;
    teamBDeclPoints: number;
    teamATricksWon: number;
    teamBTricksWon: number;
    padanje: boolean;
    capot: boolean;
    finalScoreA: number;
    finalScoreB: number;
}

export interface HandDTO {
    handNo: number | null;
    trumpCalls: TrumpCallDTO[] | null;
    tricks: TrickDTO[] | null;
    challenges: ChallengeDTO[] | null;
    handSummary?: HandSummary | null;
}

export interface MatchHistoryDTO {
    match: MatchDTO | null;
    moves: MoveDTO[] | null;
    structuredMoves: HandDTO[] | null;
}

// Re-export from user.ts for convenience
export type { PlayerMatchHistoryDTO, PlayerMatchSummaryDTO } from './user';