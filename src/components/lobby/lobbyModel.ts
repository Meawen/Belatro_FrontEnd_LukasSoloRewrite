import type { LobbyDTO } from '../../types/lobby';
import type { UserSimpleDTO } from '../../types/user';
import { cat } from '../../i18n/t';
import { formatRelative } from '../../i18n/format';
import { fold } from '../../utils/fold';

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

function counted(lobby: LobbyDTO, separator: string): string {
    const c = cat().tables;
    const people = c.count(peopleCount(lobby), LOBBY_CAP);
    const bots = botCount(lobby);
    if (bots === 0) return people;
    return `${people}${separator}${c.bots(bots)}`;
}

/** "2 of 4", or with bots "2 of 4 · 2 bots": people of the cap, then the bots. */
export function countLine(lobby: LobbyDTO): string {
    return counted(lobby, ' · ');
}

/** The count as an accessible name reads it: "2 of 4, 2 bots" (R27). */
export function countLabel(lobby: LobbyDTO): string {
    return counted(lobby, ', ');
}

export function lobbyName(lobby: LobbyDTO): string {
    return lobby.name || cat().tables.unnamed;
}

export type LobbySort = 'newest' | 'name' | 'players';

/** The "Sort by" choices (spec §4.6). */
export const SORTS: readonly LobbySort[] = ['newest', 'name', 'players'];

const createdTime = (lobby: LobbyDTO) => new Date(lobby.createdAt ?? 0).getTime() || 0;

/** A sorted copy. "Most players" counts each lobby's own people, Unassigned included, bots not (X-6). */
export function sortLobbies(lobbies: LobbyDTO[], sort: LobbySort): LobbyDTO[] {
    return [...lobbies].sort((a, b) => {
        if (sort === 'name') return lobbyName(a).localeCompare(lobbyName(b));
        if (sort === 'players') return peopleCount(b) - peopleCount(a);
        return createdTime(b) - createdTime(a);
    });
}

/**
 * The lobbies whose name or host contains `term`, in any case and with or without the marks on č ć š ž đ (spec §1.5);
 * a blank term keeps them all.
 */
export function filterLobbies(lobbies: LobbyDTO[], term: string): LobbyDTO[] {
    const wanted = fold(term.trim());
    if (!wanted) return lobbies;
    return lobbies.filter(
        (lobby) => fold(lobby.name ?? '').includes(wanted) || fold(lobby.hostUser?.username ?? '').includes(wanted),
    );
}

/** A row's accessible name (spec §4.6 AC 6): "Kod Mire, host mira_z, 3 of 4, private". */
export function lobbyRowLabel(lobby: LobbyDTO, userId: string | null | undefined): string {
    const c = cat().tables;
    const parts = [lobbyName(lobby), c.host(lobby.hostUser?.username ?? c.unknownHost), countLabel(lobby)];
    if (lobby.privateLobby) parts.push(c.rowPrivate);
    if (isMember(lobby, userId)) parts.push(c.rowYoureIn);
    return parts.join(', ');
}

/** How long ago a lobby was created, in words in the site's language; null without a usable date. */
export function createdAgo(createdAt: string | null, now = Date.now()): string | null {
    if (!createdAt) return null;
    const then = new Date(createdAt).getTime();
    if (Number.isNaN(then)) return null;
    return formatRelative(then, now);
}
