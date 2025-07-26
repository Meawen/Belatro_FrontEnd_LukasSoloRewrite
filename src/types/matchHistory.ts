import type { MatchDTO } from './match';
import type { UserSimpleDTO } from './user';

// Extended match interface for history display
export interface MatchHistoryItem {
    match: MatchDTO;
    currentUserResult?: 'win' | 'loss' | 'draw';
    currentUserTeam?: 'A' | 'B';
    duration?: number; // calculated from start/end time
    playerCount: number;
}

export interface MatchPlayer {
    user: UserSimpleDTO;
    team: 'A' | 'B';
    result: 'win' | 'loss' | 'draw';
}

export interface MatchFilterOptions {
    gameMode: 'all' | string;
    result: 'all' | 'win' | 'loss' | 'draw';
    dateRange: 'all' | 'today' | 'week' | 'month' | '3months';
    sortBy: 'date' | 'duration' | 'gameMode';
    sortOrder: 'asc' | 'desc';
}

export interface MatchHistoryResponse {
    matches: MatchHistoryItem[];
    totalMatches: number;
    currentPage: number;
    totalPages: number;
}