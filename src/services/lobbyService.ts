import { apiClient } from './api';
import type {
    LobbyDTO,
    CreateLobbyDTO,
    JoinLobbyRequestDTO,
    LeaveLobbyRequestDTO,
    KickPlayerRequestDTO,
    TeamSwitchRequestDTO,
    LobbyUpdateDTO,
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
        return apiClient.post<LobbyDTO>(`/lobbies/${lobbyId}/join`, joinData);
    },

    async leaveLobby(lobbyId: string, leaveData?: LeaveLobbyRequestDTO): Promise<Void> {
        return apiClient.post<Void>(`/lobbies/${lobbyId}/leave`, leaveData);
    },

    async updateLobby(lobbyId: string, updateData: LobbyUpdateDTO): Promise<LobbyDTO> {
        return apiClient.put<LobbyDTO>(`/lobbies/${lobbyId}`, updateData);
    },

    async deleteLobby(lobbyId: string): Promise<Void> {
        return apiClient.delete<Void>(`/lobbies/${lobbyId}`);
    },

    async startLobby(lobbyId: string): Promise<LobbyDTO> {
        return apiClient.post<LobbyDTO>(`/lobbies/${lobbyId}/start`);
    },

    // Alias for consistency with hook usage
    async startMatch(lobbyId: string): Promise<LobbyDTO> {
        return this.startLobby(lobbyId);
    },

    async kickPlayer(lobbyId: string, kickData: KickPlayerRequestDTO): Promise<LobbyDTO> {
        return apiClient.post<LobbyDTO>(`/lobbies/${lobbyId}/kick`, kickData);
    },

    async switchTeam(lobbyId: string, switchData: TeamSwitchRequestDTO): Promise<LobbyDTO> {
        return apiClient.post<LobbyDTO>(`/lobbies/${lobbyId}/switch-team`, switchData);
    }
};