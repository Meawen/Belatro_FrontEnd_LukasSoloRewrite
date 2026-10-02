import { apiClient } from './api';
import type {
    LobbyDTO,
    CreateLobbyDTO,
    JoinLobbyRequestDTO,
    LeaveLobbyRequestDTO,
    KickPlayerRequestDTO,
    TeamSwitchRequestDTO,
    LobbyUpdateDTO,
    MatchDTO,
    Void
} from '../types';

export const lobbyService = {
    async getAllLobbies(): Promise<LobbyDTO[]> {
        return apiClient.get<LobbyDTO[]>('/lobbies');
    },

    async getAllOpenLobbies(): Promise<LobbyDTO[]> {
        return apiClient.get<LobbyDTO[]>('/lobbies/open');
    },

    async getLobbyById(id: string): Promise<LobbyDTO> {
        return apiClient.get<LobbyDTO>(`/lobbies/${id}`);
    },

    // Alias for consistency with hook usage
    async getLobby(id: string): Promise<LobbyDTO> {
        return this.getLobbyById(id);
    },

    async createLobby(lobbyData: CreateLobbyDTO): Promise<LobbyDTO> {
        return apiClient.post<LobbyDTO>('/lobbies', lobbyData);
    },

    async joinLobby(lobbyId: string, joinData: JoinLobbyRequestDTO): Promise<LobbyDTO> {
        const payload: JoinLobbyRequestDTO = { ...joinData, lobbyId };
        return apiClient.post<LobbyDTO>('/lobbies/join', payload); // ✅ correct endpoint
    },

    async leaveLobby(lobbyId: string, leaveData?: LeaveLobbyRequestDTO): Promise<Void> {
        return apiClient.patch<Void>(`/lobbies/${lobbyId}/leave`, leaveData);
    },

    // PUT /lobbies takes the lobby id in the body (LobbyController has no path variable here)
    async updateLobby(lobbyId: string, updateData: LobbyUpdateDTO): Promise<LobbyDTO> {
        return apiClient.put<LobbyDTO>('/lobbies', { ...updateData, id: lobbyId });
    },

    async deleteLobby(lobbyId: string): Promise<Void> {
        return apiClient.delete<Void>(`/lobbies/${lobbyId}`);
    },

    async startLobby(lobbyId: string): Promise<MatchDTO> {
        return apiClient.post<MatchDTO>(`/lobbies/${lobbyId}/start-match`);
    },

    // Alias for consistency with hook usage
    async startMatch(lobbyId: string): Promise<MatchDTO> {
        return this.startLobby(lobbyId);
    },

    async kickPlayer(lobbyId: string, kickData: KickPlayerRequestDTO): Promise<LobbyDTO> {
        return apiClient.patch<LobbyDTO>(`/lobbies/${lobbyId}/kick`, kickData);
    },

    async switchTeam(lobbyId: string, switchData: TeamSwitchRequestDTO): Promise<LobbyDTO> {
        return apiClient.post<LobbyDTO>('/lobbies/switchTeam', { ...switchData, lobbyId });
    }
};