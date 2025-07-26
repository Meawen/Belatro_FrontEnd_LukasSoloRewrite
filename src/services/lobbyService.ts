import { apiClient } from './api';
import type {
    LobbyDTO,
    JoinLobbyRequestDTO,
    LeaveLobbyRequestDTO,
    KickPlayerRequestDTO,
    TeamSwitchRequestDTO,
    MatchDTO,
    Void,
} from '../types';

export const lobbyService = {
    async getAllLobbies(): Promise<LobbyDTO> {
        return apiClient.get<LobbyDTO>('/lobbies');
    },

    async getAllOpenLobbies(): Promise<LobbyDTO> {
        return apiClient.get<LobbyDTO>('/lobbies/open');
    },

    async getLobby(lobbyId: string): Promise<LobbyDTO> {
        return apiClient.get<LobbyDTO>(`/lobbies/${lobbyId}`);
    },

    async createLobby(lobbyData: LobbyDTO): Promise<LobbyDTO> {
        return apiClient.post<LobbyDTO>('/lobbies', lobbyData);
    },

    async updateLobby(lobbyData: LobbyDTO): Promise<LobbyDTO> {
        return apiClient.put<LobbyDTO>('/lobbies', lobbyData);
    },

    async deleteLobby(lobbyId: string): Promise<Void> {
        return apiClient.delete<Void>(`/lobbies/${lobbyId}`);
    },

    async joinLobby(joinData: JoinLobbyRequestDTO): Promise<LobbyDTO> {
        return apiClient.post<LobbyDTO>('/lobbies/join', joinData);
    },

    async leaveLobby(lobbyId: string, leaveData: LeaveLobbyRequestDTO): Promise<LobbyDTO> {
        return apiClient.patch<LobbyDTO>(`/lobbies/${lobbyId}/leave`, leaveData);
    },

    async kickPlayer(lobbyId: string, kickData: KickPlayerRequestDTO): Promise<LobbyDTO> {
        return apiClient.patch<LobbyDTO>(`/lobbies/${lobbyId}/kick`, kickData);
    },

    async switchTeam(switchData: TeamSwitchRequestDTO): Promise<LobbyDTO> {
        return apiClient.post<LobbyDTO>('/lobbies/switchTeam', switchData);
    },

    async startMatch(lobbyId: string): Promise<MatchDTO> {
        return apiClient.post<MatchDTO>(`/lobbies/${lobbyId}/start-match`);
    }
};