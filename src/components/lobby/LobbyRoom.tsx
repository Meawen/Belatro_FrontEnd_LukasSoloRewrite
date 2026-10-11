import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { m } from 'motion/react';
import { Button, Chip, EmptyState, ErrorState, IconButton, Loader, PixelIcon, showToast } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { Page } from '../layout/Page';
import { useAuth } from '../../hooks/useAuth';
import { LOBBY_POLL_MS, useLobby } from '../../hooks/useLobby';
import { lobbyService } from '../../services/lobbyService';
import { matchService } from '../../services/matchService';
import { ApiError } from '../../services/api';
import { spring } from '../../motion/tokens';
import type { LobbyDTO, LobbyTeam } from '../../types/lobby';
import type { UserSimpleDTO } from '../../types/user';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { LobbyActionBar, type LobbyRole } from './LobbyActionBar';
import { ConfirmSheet, OptionsSheet, PasswordSheet, SeatSheet } from './LobbySheets';
import { LobbyTable, type SeatBusy } from './LobbyTable';
import { isBot, isMember, lobbyName } from './lobbyModel';
import { fillableSeats, hostHint, isHost, lobbyHint, memberStatus, seatAction, startReadiness, tableSeats, takesBots, teamOf, type SeatPosition, type TableSeat } from './seats';

export interface LobbyRoomProps {
    lobbyId: string;
}

const BACK = { to: '/lobbies', label: 'Lobbies' };

/** A bot request with no usable answer: the backend's 503 (no bot free) reaches the wire as Spring's default body (R25). */
const BOTS_UNAVAILABLE = "Bots aren't available right now. Try again later.";

/** A bot request's failure: a refusal (403, 409) in the server's words; no answer or a 5xx as BOTS_UNAVAILABLE. */
function botFailure(e: unknown, fallback: string): string {
    return e instanceof ApiError && isNetworkOrServerFailure(e.status) ? BOTS_UNAVAILABLE : errorMessage(e, fallback);
}

/**
 * Where focus goes once a request at the table has finished (R38, R43), read off the table as it now is: whether the
 * request went through, and the lobby it left.
 */
type FocusAfter = (ok: boolean, lobby: LobbyDTO) => HTMLElement | null;

const TABLE = '[data-testid="lobby-table"]';

/** The host's "Start match" in the action bar, when it is enabled. */
function enabledStart(): HTMLButtonElement | null {
    const buttons = document.querySelectorAll<HTMLButtonElement>('[role="region"][aria-label="Lobby actions"] button');
    return [...buttons].find((button) => button.textContent === 'Start match' && !button.disabled) ?? null;
}

/** A seat's button, found by its place: a request may have remounted it. */
function seatButton(position: SeatPosition): HTMLElement | null {
    return document.querySelector<HTMLElement>(`${TABLE} [data-position="${position}"] > button`);
}

/** The "+ Bot" under the seat at this place, when it shows: the second button of the seat's column. */
function botChip(position: SeatPosition): HTMLElement | null {
    return document.querySelector<HTMLElement>(`${TABLE} [data-position="${position}"] > button + button`);
}

/**
 * Where focus goes after a "+ Bot" went through (R43): the next "+ Bot" round the table from the seat the bot took (the
 * chip's own seat, R44, unless the lobby changed meanwhile), else Start when it is enabled, else the bot's seat.
 * `seated`: who sat at the table before the request.
 */
function afterBot(lobby: LobbyDTO, viewerId: string | null, seated: Set<string>, tapped: SeatPosition): HTMLElement | null {
    const seats = tableSeats(lobby, viewerId);
    const taken = seats.findIndex((seat) => isBot(seat.player) && !seated.has(seat.player?.username ?? ''));
    const from = taken >= 0 ? taken : seats.findIndex((seat) => seat.position === tapped);
    for (let step = 1; step < seats.length; step++) {
        const chip = botChip(seats[(from + step) % seats.length].position);
        if (chip) return chip;
    }
    return enabledStart() ?? seatButton(seats[from].position);
}

/**
 * /lobby/:lobbyId (spec §4.7, D-18): take a seat at the table; the host starts the match. The lobby comes
 * from a 2-s poll; members follow a started match into the game.
 */
export function LobbyRoom({ lobbyId }: LobbyRoomProps) {
    const { user } = useAuth();
    const me = user?.id ?? null;
    const navigate = useNavigate();
    const [removed, setRemoved] = useState(false);
    const { lobby, loading, loadError, closed, pollError, refresh } = useLobby(lobbyId, !removed);
    const member = lobby !== null && isMember(lobby, me);

    // A poll that no longer lists you, after you were a member, means the host removed you (AC 7).
    const wasMember = useRef(false);
    useEffect(() => {
        if (lobby === null || me === null) return;
        if (member) wasMember.current = true;
        else if (wasMember.current) setRemoved(true);
    }, [lobby, me, member]);

    const lobbyClosed = lobby?.status === 'CLOSED';
    const [followError, setFollowError] = useState<string | null>(null);

    // Once the host starts, the lobby closes and every member follows it into the
    // game. The lobby is saved CLOSED before its match exists, so a 404 means
    // "not yet": try again after the next poll interval. Any other failure is
    // shown (in its own state, so a good lobby poll can't blink it away) and
    // retried too. `replace`: Back from the game must not land on this page,
    // which would follow straight back in.
    useEffect(() => {
        if (!lobbyClosed || !member) return;
        let cancelled = false;
        let retry: number | undefined;
        const follow = () => {
            matchService.getMatchByLobbyId(lobbyId)
                .then((match) => {
                    if (!cancelled && match?.id) navigate(`/game/${match.id}`, { replace: true });
                })
                .catch((e) => {
                    if (cancelled) return;
                    const notYet = e instanceof ApiError && e.status === 404;
                    setFollowError(notYet ? null : `Could not open the match: ${errorMessage(e, 'unknown error')}`);
                    retry = window.setTimeout(follow, LOBBY_POLL_MS);
                });
        };
        follow();
        return () => {
            cancelled = true;
            if (retry) window.clearTimeout(retry);
        };
    }, [lobbyClosed, member, lobbyId, navigate]);

    // Only the first load shows a spinner; later polls keep the page in place.
    if (loading && lobby === null) {
        return (
            <Page title="Lobby" back={BACK}>
                <Loader text="Loading lobby..." />
            </Page>
        );
    }
    if (closed) return <LobbyGone title="This lobby was closed." />;
    if (removed) return <LobbyGone title="You were removed from this lobby." />;

    // Only a failed first load replaces the page; a failed poll leaves the last lobby up.
    if (lobby === null) {
        return (
            <Page title="Lobby" back={BACK}>
                <ErrorState
                    title="Couldn't load this lobby"
                    body={errorMessage(loadError, 'Failed to load lobby')}
                    action={
                        <>
                            <Button variant="secondary" onClick={() => void refresh()}>
                                Try again
                            </Button>
                            <Button variant="quiet" onClick={() => navigate('/lobbies')}>
                                Back to lobbies
                            </Button>
                        </>
                    }
                />
            </Page>
        );
    }

    return <LobbyView lobbyId={lobbyId} lobby={lobby} me={me} refresh={refresh} notice={pollError ?? followError} following={lobbyClosed && member} />;
}

/** The end of a lobby, for this viewer: closed (404) or removed by the host. */
function LobbyGone({ title }: { title: string }) {
    const navigate = useNavigate();
    return (
        <Page title="Lobby" back={BACK}>
            <EmptyState icon="door" title={title} action={<Button onClick={() => navigate('/lobbies')}>Back to lobbies</Button>} />
        </Page>
    );
}

type OpenSheet = 'seat' | 'leave' | 'remove' | 'options' | 'close' | 'password' | null;

interface LobbyViewProps {
    lobbyId: string;
    lobby: LobbyDTO;
    me: string | null;
    refresh: () => Promise<void>;
    /** The poll error or the follow error, shown over the table. */
    notice: string | null;
    /** The lobby closed and this member is following it into the game. */
    following: boolean;
}

function LobbyView({ lobbyId, lobby, me, refresh, notice, following }: LobbyViewProps) {
    const navigate = useNavigate();
    const [sheet, setSheet] = useState<OpenSheet>(null);
    // who "Remove {name}?" is about: a person; a bot goes with one tap (R37)
    const [removing, setRemoving] = useState('');
    const [busy, setBusy] = useState<SeatBusy | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);
    const [joining, setJoining] = useState(false);
    const fillButton = useRef<HTMLButtonElement>(null);
    const inTable = (element: Element | null) => element !== null && (element === fillButton.current || element.closest(TABLE) !== null);
    // A request remounts the seat it is about (a seat's key is its occupant), or takes a chip or Fill away, so focus
    // falls to the page: once the table shows the result, it goes where `FocusAfter` says (R38, R43). Only from the page,
    // or from the table where it was when the request started: never out of a sheet opened meanwhile (I2).
    const refocus = useRef<{ wasAtTable: boolean; target: (lobby: LobbyDTO) => HTMLElement | null } | null>(null);
    useEffect(() => {
        const pending = refocus.current;
        if (busy !== null || pending === null) return;
        refocus.current = null;
        const now = document.activeElement;
        if (now !== null && now !== document.body && !(pending.wasAtTable && inTable(now))) return;
        pending.target(lobby)?.focus();
    });

    const host = isHost(lobby, me);
    const role: LobbyRole = host ? 'host' : isMember(lobby, me) ? 'member' : 'outsider';
    const { ready, reason } = startReadiness(lobby);
    const hint = lobbyHint(lobby, me) ?? hostHint(lobby, me);
    const mySeat = tableSeats(lobby, me).find((seat) => seat.player !== null && seat.player.id === me);
    const launching = starting || following;
    // the host's "+ Bot" chips and "Fill with bots": in a lobby that takes bots, and never while the match starts (R27)
    const botControls = takesBots(lobby) && !launching;
    const closeSheet = () => setSheet(null);

    const copyInvite = () => {
        const link = `${window.location.origin}/lobby/${lobbyId}`;
        if (!navigator.clipboard) {
            showToast(link);
            return;
        }
        navigator.clipboard.writeText(link).then(
            () => showToast('Invite link copied'),
            () => showToast(link),
        );
    };

    // One request at the table at a time (a seat change, a bot, a fill): the seat it is about is aria-busy and says
    // what is happening, and no seat or chip takes a tap meanwhile. `failure` words what went wrong; `focusAfter` says
    // where focus goes once it has finished.
    const atTable = async (pending: SeatBusy, request: () => Promise<unknown>, failure: (e: unknown) => string, focusAfter: FocusAfter) => {
        if (busy) return;
        const wasAtTable = inTable(document.activeElement);
        setActionError(null);
        setBusy(pending);
        let ok = false;
        try {
            await request();
            await refresh();
            ok = true;
        } catch (e) {
            setActionError(failure(e));
        } finally {
            refocus.current = { wasAtTable, target: (fresh) => focusAfter(ok, fresh) };
            setBusy(null);
        }
    };

    // a seat change that went through leaves the viewer at the bottom: in their new seat, or (standing up) where theirs
    // was; one that failed leaves focus on the seat tapped
    const changeSeat = (targetTeam: LobbyTeam, seat: TableSeat) =>
        atTable(
            { key: seat.key, label: teamOf(lobby, me) === 'U' && targetTeam !== 'U' ? 'Joining…' : 'Switching…' },
            () => lobbyService.switchTeam(lobbyId, { lobbyId, targetTeam }),
            (e) => errorMessage(e, 'Failed to switch team'),
            (ok) => seatButton(ok ? 'bottom' : seat.position),
        );

    // a "+ Bot" that failed leaves focus on its chip, for another try
    const addBot = (seat: TableSeat) => {
        const seated = new Set(tableSeats(lobby, me).flatMap((each) => (each.player?.username ? [each.player.username] : [])));
        return atTable(
            { key: seat.key, label: 'Adding…' },
            () => lobbyService.addBot(lobbyId, seat.team),
            (e) => botFailure(e, 'Failed to add a bot'),
            (ok, fresh) => (ok ? afterBot(fresh, me, seated, seat.position) : (botChip(seat.position) ?? seatButton(seat.position))),
        );
    };

    const fillWithBots = () =>
        atTable(
            { key: null, label: 'Filling with bots…' },
            () => lobbyService.fillBots(lobbyId),
            (e) => botFailure(e, 'Failed to fill with bots'),
            () => enabledStart(),
        );

    // a bot goes at once, with no sheet: re-adding one is one tap too, and nothing is lost (R37)
    const removeBot = (seat: TableSeat, username: string) =>
        atTable(
            { key: seat.key, label: 'Removing…' },
            () => lobbyService.kickPlayer(lobbyId, { usernameToKick: username }),
            (e) => errorMessage(e, 'Failed to remove the bot'),
            () => seatButton(seat.position),
        );

    const askRemove = (member: UserSimpleDTO) => {
        setRemoving(member.username ?? '');
        setSheet('remove');
    };

    const onSeat = (seat: TableSeat) => {
        const action = seatAction(seat, lobby, me);
        if (action === 'sit') void changeSeat(seat.team, seat);
        else if (action === 'own') setSheet('seat');
        else if (action === 'remove' && seat.player?.username) {
            // a bot goes with one tap, but not while the match starts: bot controls are off then (R27, R42)
            if (isBot(seat.player)) {
                if (botControls) void removeBot(seat, seat.player.username);
            } else askRemove(seat.player);
        }
    };

    const standUp = () => {
        closeSheet();
        if (mySeat) void changeSeat('U', mySeat);
    };

    const leave = async () => {
        await lobbyService.leaveLobby(lobbyId);
        navigate('/lobbies');
    };

    const kick = async () => {
        await lobbyService.kickPlayer(lobbyId, { usernameToKick: removing });
        closeSheet();
        await refresh();
    };

    const closeLobby = async () => {
        await lobbyService.deleteLobby(lobbyId);
        navigate('/lobbies');
    };

    // POST /lobbies/join puts the caller in Unassigned, or, in a lobby of four with a bot, in that bot's seat; the next
    // fetch shows the member view (Not seated, or seated).
    const join = async (password: string | null) => {
        await lobbyService.joinLobby(lobbyId, { lobbyId, password });
        closeSheet();
        await refresh();
    };

    const joinNow = () => {
        if (lobby.privateLobby) {
            setSheet('password');
            return;
        }
        setJoining(true);
        setActionError(null);
        join(null)
            .catch((e) => setActionError(errorMessage(e, 'Failed to join lobby')))
            .finally(() => setJoining(false));
    };

    // The host goes straight in from the start response; `replace`, so Back never re-enters the lobby.
    const start = async () => {
        setActionError(null);
        setStarting(true);
        try {
            const match = await lobbyService.startMatch(lobbyId);
            if (match?.id) navigate(`/game/${match.id}`, { replace: true });
            else setStarting(false);
        } catch (e) {
            setActionError(errorMessage(e, 'Failed to start match'));
            setStarting(false);
        }
    };

    return (
        <Page
            title={lobbyName(lobby)}
            back={BACK}
            meta={<LobbyChips lobby={lobby} />}
            actions={<IconButton icon="link" aria-label="Copy invite link" variant="secondary" onClick={copyInvite} />}
        >
            <div className="flex flex-col gap-4">
                <ErrorAlert message={actionError} />
                <ErrorAlert message={notice} />
                <LobbyTable lobby={lobby} viewerId={me} busy={busy} onSeat={onSeat} onAddBot={botControls ? (seat) => void addBot(seat) : undefined} launching={launching} />
                {/* on Start the table grows and the rest fades (spec §4.7 Motion) */}
                <m.div className="flex flex-col gap-3" animate={{ opacity: launching ? 0 : 1 }} transition={spring.felt}>
                    {/* the host's, directly under the table, so the phone's action bar keeps one row; nothing to fill, no button (R26) */}
                    {host && botControls && fillableSeats(lobby) > 0 && (
                        <Button
                            ref={fillButton}
                            variant="secondary"
                            size="sm"
                            className="self-start"
                            leftIcon={<PixelIcon name="robot" />}
                            // any request at the table (a seat, a chip, a fill) disables it; the spinner is the fill's own
                            disabled={busy !== null}
                            loading={busy !== null && busy.key === null}
                            onClick={() => void fillWithBots()}
                        >
                            Fill with bots
                        </Button>
                    )}
                    <NotSeated lobby={lobby} viewerId={me} hostView={host} onRemove={askRemove} />
                    {hint && <p className="t-callout text-text-2">{hint}</p>}
                </m.div>
                <LobbyActionBar
                    role={role}
                    line={host ? reason : memberStatus(lobby, me)}
                    canStart={ready}
                    starting={starting}
                    joining={joining}
                    privateLobby={lobby.privateLobby ?? false}
                    following={following}
                    onOptions={() => setSheet('options')}
                    onStart={() => void start()}
                    onLeave={() => setSheet('leave')}
                    onJoin={joinNow}
                />
            </div>

            <SeatSheet open={sheet === 'seat'} onClose={closeSheet} canLeave={!host} onStandUp={standUp} onLeave={leave} />
            <ConfirmSheet
                open={sheet === 'leave'}
                onClose={closeSheet}
                title="Leave this lobby?"
                body="Your seat opens for someone else."
                confirmLabel="Leave lobby"
                confirmIcon="door"
                cancelLabel="Stay"
                onConfirm={leave}
                fallbackError="Failed to leave lobby"
            />
            <ConfirmSheet
                open={sheet === 'remove'}
                onClose={closeSheet}
                title={`Remove ${removing}?`}
                body="They leave the lobby at once and can join again from the list."
                confirmLabel={`Remove ${removing}`}
                confirmIcon="x"
                onConfirm={kick}
                fallbackError="Failed to kick player"
            />
            <OptionsSheet
                open={sheet === 'options'}
                onClose={closeSheet}
                onCopy={() => {
                    closeSheet();
                    copyInvite();
                }}
                onCloseLobby={() => setSheet('close')}
            />
            <ConfirmSheet
                open={sheet === 'close'}
                onClose={closeSheet}
                title="Close this lobby?"
                body="Everyone goes back to the list."
                confirmLabel="Close lobby"
                confirmIcon="trash"
                onConfirm={closeLobby}
                fallbackError="Failed to delete lobby"
            />
            <PasswordSheet open={sheet === 'password'} onClose={closeSheet} onJoin={join} />
        </Page>
    );
}

function LobbyChips({ lobby }: { lobby: LobbyDTO }) {
    return (
        <span className="flex flex-wrap gap-1.5">
            <Chip>{lobby.gameMode === 'RANKED' ? 'Ranked' : 'Casual'}</Chip>
            {lobby.privateLobby && <Chip icon="lock">Private</Chip>}
            {lobby.hostUser?.username && <Chip icon="crown">{lobby.hostUser.username}</Chip>}
        </span>
    );
}

/** Members who have not taken a seat. For the host each other member's chip opens "Remove {name}?". */
function NotSeated({ lobby, viewerId, hostView, onRemove }: { lobby: LobbyDTO; viewerId: string | null; hostView: boolean; onRemove: (member: UserSimpleDTO) => void }) {
    const players = lobby.unassignedPlayers ?? [];
    if (players.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-x-2">
            <span className="t-footnote text-text-3">Not seated</span>
            {players.map((player) => {
                const you = viewerId !== null && player.id === viewerId;
                const chip = (
                    <Chip>
                        {player.username}
                        {you && <span className="text-accent"> · you</span>}
                    </Chip>
                );
                return hostView && !you ? (
                    <button
                        key={player.id}
                        type="button"
                        aria-haspopup="dialog"
                        className="press inline-flex min-h-11 items-center"
                        onClick={() => onRemove(player)}
                    >
                        {chip}
                    </button>
                ) : (
                    <span key={player.id} className="inline-flex min-h-11 items-center">
                        {chip}
                    </span>
                );
            })}
        </div>
    );
}
