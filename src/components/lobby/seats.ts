import type { LobbyDTO, LobbyTeam } from '../../types/lobby';
import type { UserSimpleDTO } from '../../types/user';
import { botCount, isBot, LOBBY_CAP, memberCount } from './lobbyModel';
import { cat } from '../../i18n/t';
import { displayName } from '../common/displayName';

/** A table seat: A1 is Team A's first player in the server's list, B2 Team B's second. */
export type SeatKey = 'A1' | 'B1' | 'A2' | 'B2';
export type SeatPosition = 'bottom' | 'right' | 'top' | 'left';

export interface TableSeat {
    key: SeatKey;
    team: 'A' | 'B';
    position: SeatPosition;
    /** null: an empty seat, in the slot its team's list leaves free. */
    player: UserSimpleDTO | null;
}

/** The game's turn order, A1 → B1 → A2 → B2 (spec §4.7). */
const TURN_ORDER: readonly { key: SeatKey; team: 'A' | 'B'; index: 0 | 1 }[] = [
    { key: 'A1', team: 'A', index: 0 },
    { key: 'B1', team: 'B', index: 0 },
    { key: 'A2', team: 'A', index: 1 },
    { key: 'B2', team: 'B', index: 1 },
];

/** Counter-clockwise from the viewer, as on the board (§5.3.2): the next to act sits on the right. */
const POSITIONS: readonly SeatPosition[] = ['bottom', 'right', 'top', 'left'];

/** The four seats seen from the viewer: a seated viewer at the bottom, otherwise A1 at the bottom. */
export function tableSeats(lobby: LobbyDTO, viewerId: string | null): TableSeat[] {
    const slots = TURN_ORDER.map(({ key, team, index }) => ({
        key,
        team,
        player: (team === 'A' ? lobby.teamAPlayers : lobby.teamBPlayers)?.[index] ?? null,
    }));
    const mine = viewerId == null ? -1 : slots.findIndex((slot) => slot.player?.id === viewerId);
    const start = Math.max(mine, 0);
    return POSITIONS.map((position, i) => ({ ...slots[(start + i) % slots.length], position }));
}

/** The list a user is in: 'A', 'B', 'U' (Unassigned), or null for someone outside the lobby. */
export function teamOf(lobby: LobbyDTO, userId: string | null): LobbyTeam | null {
    if (userId == null) return null;
    const has = (players: UserSimpleDTO[] | null) => (players ?? []).some((player) => player.id === userId);
    if (has(lobby.teamAPlayers)) return 'A';
    if (has(lobby.teamBPlayers)) return 'B';
    if (has(lobby.unassignedPlayers)) return 'U';
    return null;
}

export function isHost(lobby: LobbyDTO, userId: string | null): boolean {
    return userId != null && lobby.hostUser?.id === userId;
}

export function seatedCount(lobby: LobbyDTO): number {
    return (lobby.teamAPlayers?.length ?? 0) + (lobby.teamBPlayers?.length ?? 0);
}

/** The server starts a match only at 2 + 2 with nobody unassigned (LobbyServiceImpl.start). */
export function isReadyToStart(lobby: LobbyDTO): boolean {
    return (lobby.teamAPlayers?.length ?? 0) === 2 && (lobby.teamBPlayers?.length ?? 0) === 2 && (lobby.unassignedPlayers?.length ?? 0) === 0;
}

export type SeatAction = 'sit' | 'own' | 'remove';

/** What a tap on a seat does for this viewer (spec §4.7 Actions), or null when it does nothing. */
export function seatAction(seat: TableSeat, lobby: LobbyDTO, viewerId: string | null): SeatAction | null {
    const team = teamOf(lobby, viewerId);
    if (seat.player === null) return team !== null && team !== seat.team ? 'sit' : null;
    if (viewerId != null && seat.player.id === viewerId) return 'own';
    return isHost(lobby, viewerId) ? 'remove' : null;
}

/**
 * Whether a lobby takes bots at all: never a ranked one (the room can show a legacy one, and the server refuses bots
 * there), and only from a backend with bots, which always sends its members' `bot` flag; one before bots sends none
 * and has no bot routes (R27). The one rule behind the "+ Bot" chips (`canAddBot`) and "Fill with bots".
 */
export function takesBots(lobby: LobbyDTO): boolean {
    return lobby.gameMode !== 'RANKED' && typeof lobby.hostUser?.bot === 'boolean';
}

/**
 * Whether the host may put a bot on this seat: its team's first free slot, the one a bot added to that team lands in
 * (the server fills the team's list in order), so a team shows one "+ Bot" and it seats the bot where it is (R44);
 * while the lobby has fewer than four members (the server refuses a bot at four, unassigned people included), in a
 * lobby that takes bots. Separate from the seat's own tap.
 */
export function canAddBot(seat: TableSeat, lobby: LobbyDTO, viewerId: string | null): boolean {
    const team = (seat.team === 'A' ? lobby.teamAPlayers : lobby.teamBPlayers) ?? [];
    const firstFree = seat.key === `${seat.team}${team.length + 1}`;
    return seat.player === null && firstFree && isHost(lobby, viewerId) && memberCount(lobby) < LOBBY_CAP && takesBots(lobby);
}

/**
 * How many bots "Fill with bots" can seat: the free team places, but no more than the lobby has room for, so a person
 * waiting unassigned keeps a seat (casual bots spec §3).
 */
export function fillableSeats(lobby: LobbyDTO): number {
    const freePlaces = (2 - (lobby.teamAPlayers?.length ?? 0)) + (2 - (lobby.teamBPlayers?.length ?? 0));
    return Math.max(0, Math.min(freePlaces, LOBBY_CAP - memberCount(lobby)));
}

/** A seat's accessible name (spec §4.7); a bot's ends ", bot", and the host's, whose tap removes it, starts "Remove" (R37). */
export function seatLabel(seat: TableSeat, lobby: LobbyDTO, viewerId: string | null): string {
    const c = cat().table.seat;
    const team = c.team(seat.team);
    if (seat.player === null) return `${seatAction(seat, lobby, viewerId) === 'sit' ? c.sitHere : c.open}, ${team}`;
    const name = displayName(seat.player.username ?? cat().common.unknown);
    if (viewerId != null && seat.player.id === viewerId) return `${name} ${c.you}, ${team}`;
    if (isBot(seat.player)) return `${isHost(lobby, viewerId) ? c.remove(name) : name}, ${team}, ${c.bot}`;
    return isHost(lobby, seat.player.id) ? `${name}, ${team}, ${c.host}` : `${name}, ${team}`;
}

/** Whether the host may start, and the reason line that says why not (spec §4.7 Action bar). */
export function startReadiness(lobby: LobbyDTO): { ready: boolean; reason: string } {
    const c = cat().table;
    const missing = LOBBY_CAP - memberCount(lobby);
    if (missing > 0) return { ready: false, reason: c.waitingFor(missing) };
    const standing = lobby.unassignedPlayers ?? [];
    if (standing.length > 0) return { ready: false, reason: c.notSeatedYet(displayName(standing[0].username ?? c.someone)) };
    return { ready: isReadyToStart(lobby), reason: c.everyoneSeated };
}

/** The hint under the table, for everyone but the host. */
export function lobbyHint(lobby: LobbyDTO, viewerId: string | null): string | null {
    if (isHost(lobby, viewerId)) return null;
    const team = teamOf(lobby, viewerId);
    // true either way: a join lands in Unassigned, or in a bot's seat when four are there with a bot
    const c = cat().table.hint;
    if (team === null) return c.outsider;
    if (team === 'U') return c.unseated;
    return c.seated;
}

/** The hint under the table for the host: a public lobby with a bot gives that bot's seat to whoever joins. */
export function hostHint(lobby: LobbyDTO, viewerId: string | null): string | null {
    if (!isHost(lobby, viewerId) || lobby.privateLobby || botCount(lobby) === 0) return null;
    return cat().table.hint.host;
}

/** A member's status line in the action bar. */
export function memberStatus(lobby: LobbyDTO, viewerId: string | null): string {
    const team = teamOf(lobby, viewerId);
    const c = cat().table;
    return team === 'A' || team === 'B' ? c.onTeam(team) : c.tapSeat;
}
