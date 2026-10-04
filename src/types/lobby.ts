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

/** POST /lobbies. The caller becomes the host; the server ignores any host field. */
export interface CreateLobbyDTO {
    name: string;
    privateLobby: boolean;
    password: string | null;
}

export interface LobbyUpdateDTO {
    name?: string | null;
    gameMode?: string | null;
    privateLobby?: boolean | null;
    password?: string | null;
}

/** POST /lobbies/join. The caller joins themselves. */
export interface JoinLobbyRequestDTO {
    lobbyId: string;
    password: string | null;
}

/** PATCH /lobbies/{lobbyId}/kick, host only. */
export interface KickPlayerRequestDTO {
    usernameToKick: string;
}

/** A = team A, B = team B, U = unassigned (the backend's codes). */
export type LobbyTeam = 'A' | 'B' | 'U';

/** POST /lobbies/switchTeam. The caller moves themselves. */
export interface TeamSwitchRequestDTO {
    lobbyId: string;
    targetTeam: LobbyTeam;
}