import type { LobbyDTO } from '../../types/lobby';
import type { UserSimpleDTO } from '../../types/user';

/** The server's cap, Unassigned included: a fifth join is answered 409 "Lobby is full" (LobbyServiceImpl.joinLobby). */
export const LOBBY_CAP = 4;

/** Every member of a lobby: Team A, then Team B, then Unassigned. */
export function membersOf(lobby: LobbyDTO): UserSimpleDTO[] {
    return [...(lobby.teamAPlayers ?? []), ...(lobby.teamBPlayers ?? []), ...(lobby.unassignedPlayers ?? [])];
}

export function memberCount(lobby: LobbyDTO): number {
    return membersOf(lobby).length;
}

export function isMember(lobby: LobbyDTO, userId: string | null | undefined): boolean {
    return userId != null && membersOf(lobby).some((player) => player.id === userId);
}

export function isFull(lobby: LobbyDTO): boolean {
    return memberCount(lobby) >= LOBBY_CAP;
}

export function lobbyName(lobby: LobbyDTO): string {
    return lobby.name || 'Unnamed Lobby';
}

export type LobbySort = 'newest' | 'name' | 'players';

/** The "Sort by" choices (spec §4.6). */
export const SORT_OPTIONS: { value: LobbySort; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'name', label: 'Name' },
    { value: 'players', label: 'Most players' },
];

const createdTime = (lobby: LobbyDTO) => new Date(lobby.createdAt ?? 0).getTime() || 0;

/** A sorted copy. "Most players" counts each lobby's own members, Unassigned included (X-6). */
export function sortLobbies(lobbies: LobbyDTO[], sort: LobbySort): LobbyDTO[] {
    return [...lobbies].sort((a, b) => {
        if (sort === 'name') return lobbyName(a).localeCompare(lobbyName(b));
        if (sort === 'players') return memberCount(b) - memberCount(a);
        return createdTime(b) - createdTime(a);
    });
}

/** The lobbies whose name or host contains `term`, in any case; a blank term keeps them all. */
export function filterLobbies(lobbies: LobbyDTO[], term: string): LobbyDTO[] {
    const wanted = term.trim().toLowerCase();
    if (!wanted) return lobbies;
    return lobbies.filter(
        (lobby) => (lobby.name ?? '').toLowerCase().includes(wanted) || (lobby.hostUser?.username ?? '').toLowerCase().includes(wanted),
    );
}

/** A row's accessible name (spec §4.6 AC 6): "Kod Mire, host mira_z, 3 of 4, private". */
export function lobbyRowLabel(lobby: LobbyDTO, userId: string | null | undefined): string {
    const parts = [lobbyName(lobby), `host ${lobby.hostUser?.username ?? 'unknown'}`, `${memberCount(lobby)} of ${LOBBY_CAP}`];
    if (lobby.privateLobby) parts.push('private');
    if (isMember(lobby, userId)) parts.push("you're in");
    return parts.join(', ');
}

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

/** How long ago a lobby was created, in words; null without a usable date. */
export function createdAgo(createdAt: string | null, now = Date.now()): string | null {
    if (!createdAt) return null;
    const then = new Date(createdAt).getTime();
    if (Number.isNaN(then)) return null;
    const seconds = Math.max(0, Math.round((now - then) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return RELATIVE.format(-minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return RELATIVE.format(-hours, 'hour');
    return RELATIVE.format(-Math.round(hours / 24), 'day');
}
