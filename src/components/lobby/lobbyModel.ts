import type { LobbyDTO } from '../../types/lobby';
import type { UserSimpleDTO } from '../../types/user';

/**
 * The server's cap counts people, Unassigned included: a fifth person's join is answered 409 "Lobby is full"
 * (LobbyServiceImpl.joinLobby). A bot's seat goes to a joiner, so bots don't count toward it.
 */
export const LOBBY_CAP = 4;

/** Every member of a lobby: Team A, then Team B, then Unassigned. */
export function membersOf(lobby: LobbyDTO): UserSimpleDTO[] {
    return [...(lobby.teamAPlayers ?? []), ...(lobby.teamBPlayers ?? []), ...(lobby.unassignedPlayers ?? [])];
}

/** Every member, bots included. */
export function memberCount(lobby: LobbyDTO): number {
    return membersOf(lobby).length;
}

/**
 * A bot, by the server's flag; never tell one by its name. Any member with the flag: a lobby's `UserSimpleDTO` or a
 * game's `PlayerPublicInfo` (the board's seats), so the flag-only rule lives here once.
 */
export function isBot(member: { bot?: boolean } | null | undefined): boolean {
    return member?.bot === true;
}

export function peopleCount(lobby: LobbyDTO): number {
    return membersOf(lobby).filter((member) => !isBot(member)).length;
}

export function botCount(lobby: LobbyDTO): number {
    return membersOf(lobby).filter(isBot).length;
}

export function isMember(lobby: LobbyDTO, userId: string | null | undefined): boolean {
    return userId != null && membersOf(lobby).some((player) => player.id === userId);
}

/** Four people: a lobby whose seats are partly bots still takes a joiner. */
export function isFull(lobby: LobbyDTO): boolean {
    return peopleCount(lobby) >= LOBBY_CAP;
}

/** "2 of 4", or with bots "2 of 4 · 2 bots": people of the cap, then the bots. */
export function countLine(lobby: LobbyDTO): string {
    const people = `${peopleCount(lobby)} of ${LOBBY_CAP}`;
    const bots = botCount(lobby);
    if (bots === 0) return people;
    return `${people} · ${bots} ${bots === 1 ? 'bot' : 'bots'}`;
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

/** A sorted copy. "Most players" counts each lobby's own people, Unassigned included, bots not (X-6). */
export function sortLobbies(lobbies: LobbyDTO[], sort: LobbySort): LobbyDTO[] {
    return [...lobbies].sort((a, b) => {
        if (sort === 'name') return lobbyName(a).localeCompare(lobbyName(b));
        if (sort === 'players') return peopleCount(b) - peopleCount(a);
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
    const parts = [lobbyName(lobby), `host ${lobby.hostUser?.username ?? 'unknown'}`, countLine(lobby)];
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
