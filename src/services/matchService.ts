import { apiClient } from './api';
import type {
    MatchDTO,
    MoveDTO,
    HandDTO,
    Void,
} from '../types';

export const matchService = {
    async getAllMatches(): Promise<MatchDTO[]> {
        return apiClient.get<MatchDTO[]>('/matches');
    },

    async getMatch(id: string): Promise<MatchDTO> {
        return apiClient.get<MatchDTO>(`/matches/${id}`);
    },
    async getByLobbyId(lobbyId: string): Promise<MatchDTO | null> {
        const res = await fetch(`/matches/getmatchbylobbyid/${encodeURIComponent(lobbyId)}`, {
            credentials: "include",
        });
        if (!res.ok) return null;
        return res.json();
    },

    async createMatch(matchData: MatchDTO): Promise<MatchDTO> {
        return apiClient.post<MatchDTO>('/matches', matchData);
    },

    async updateMatch(id: string, matchData: MatchDTO): Promise<MatchDTO> {
        return apiClient.put<MatchDTO>(`/matches/${id}`, matchData);
    },

    async deleteMatch(id: string): Promise<Void> {
        return apiClient.delete<Void>(`/matches/${id}`);
    },

    async getMoves(id: string): Promise<MoveDTO[]> {
        return apiClient.get<MoveDTO[]>(`/matches/${id}/moves`);
    },

    async getStructuredMoves(id: string): Promise<HandDTO[]> {
        return apiClient.get<HandDTO[]>(`/matches/${id}/structured-moves`);
    },

    async getMatchByLobbyId(lobbyId: string): Promise<MatchDTO> {
        return apiClient.get<MatchDTO>(`/matches/getmatchbylobbyid/${lobbyId}`);
    }
};