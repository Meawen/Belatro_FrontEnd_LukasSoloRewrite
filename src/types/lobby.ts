import type {UserSimpleDTO} from './user';
import type {LobbyStatus} from './common';

export interface LobbyDTO {
    id: string | null;
    name: string | null;
    gameMode: string | null;
    status: LobbyStatus | null;
    createdAt: string | null; // ISO date string
    hostUser: UserSimpleDTO | null;
    teamAPlayers: UserSimpleDTO[] | null;
    teamBPlayers: UserSimpleDTO[] | null;
    unassignedPlayers: UserSimpleDTO[] | null;
    privateLobby: boolean | null;
    password: string | null;
}

export interface JoinLobbyRequestDTO {
    lobbyId: string | null;
    userId: string | null;
    password: string | null;
}

export interface LeaveLobbyRequestDTO {
    id: string | null;
    username: string | null;
}

export interface KickPlayerRequestDTO {
    lobbyId: string | null;
    usernameToKick: string | null;
    requesterUsername: string | null;
}

export interface TeamSwitchRequestDTO {
    lobbyId: string | null;
    userId: string | null;
    targetTeam: string | null;
}