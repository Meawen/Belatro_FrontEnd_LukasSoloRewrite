import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { m } from 'motion/react';
import { Button, Chip, EmptyState, ErrorState, IconButton, Loader, showToast } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { Page } from '../layout/Page';
import { useAuth } from '../../hooks/useAuth';
import { LOBBY_POLL_MS, useLobby } from '../../hooks/useLobby';
import { lobbyService } from '../../services/lobbyService';
import { matchService } from '../../services/matchService';
import { ApiError } from '../../services/api';
import { spring } from '../../motion/tokens';
import type { LobbyDTO, LobbyTeam } from '../../types/lobby';
import { errorMessage } from '../../utils/errorMessage';
import { LobbyActionBar, type LobbyRole } from './LobbyActionBar';
import { ConfirmSheet, OptionsSheet, PasswordSheet, SeatSheet } from './LobbySheets';
import { LobbyTable, type SeatBusy } from './LobbyTable';
import { isMember, lobbyName } from './lobbyModel';
import { isHost, lobbyHint, memberStatus, seatAction, startReadiness, tableSeats, teamOf, type SeatKey, type TableSeat } from './seats';

export interface LobbyRoomProps {
    lobbyId: string;
}

const BACK = { to: '/lobbies', label: 'Lobbies' };

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
            <Page title="Lobby" heading={null} back={BACK}>
                <Loader text="Loading lobby..." />
            </Page>
        );
    }
    if (closed) return <LobbyGone title="This lobby was closed." />;
    if (removed) return <LobbyGone title="You were removed from this lobby." />;

    // Only a failed first load replaces the page; a failed poll leaves the last lobby up.
    if (lobby === null) {
        return (
            <Page title="Lobby" heading={null} back={BACK}>
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
        <Page title="Lobby" heading={null} back={BACK}>
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
    const [removeName, setRemoveName] = useState('');
    const [busy, setBusy] = useState<SeatBusy | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);
    const [joining, setJoining] = useState(false);

    const host = isHost(lobby, me);
    const role: LobbyRole = host ? 'host' : isMember(lobby, me) ? 'member' : 'outsider';
    const { ready, reason } = startReadiness(lobby);
    const hint = lobbyHint(lobby, me);
    const mySeat = tableSeats(lobby, me).find((seat) => seat.player !== null && seat.player.id === me);
    const launching = starting || following;
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

    // One seat change in flight: the tapped seat is aria-busy and says what is happening.
    const changeSeat = async (targetTeam: LobbyTeam, key: SeatKey) => {
        if (busy) return;
        setActionError(null);
        setBusy({ key, label: teamOf(lobby, me) === 'U' && targetTeam !== 'U' ? 'Joining…' : 'Switching…' });
        try {
            await lobbyService.switchTeam(lobbyId, { lobbyId, targetTeam });
            await refresh();
        } catch (e) {
            setActionError(errorMessage(e, 'Failed to switch team'));
        } finally {
            setBusy(null);
        }
    };

    const askRemove = (name: string) => {
        setRemoveName(name);
        setSheet('remove');
    };

    const onSeat = (seat: TableSeat) => {
        const action = seatAction(seat, lobby, me);
        if (action === 'sit') void changeSeat(seat.team, seat.key);
        else if (action === 'own') setSheet('seat');
        else if (action === 'remove' && seat.player?.username) askRemove(seat.player.username);
    };

    const standUp = () => {
        closeSheet();
        if (mySeat) void changeSeat('U', mySeat.key);
    };

    const leave = async () => {
        await lobbyService.leaveLobby(lobbyId);
        navigate('/lobbies');
    };

    const kick = async () => {
        await lobbyService.kickPlayer(lobbyId, { usernameToKick: removeName });
        closeSheet();
        await refresh();
    };

    const closeLobby = async () => {
        await lobbyService.deleteLobby(lobbyId);
        navigate('/lobbies');
    };

    // POST /lobbies/join puts the caller in Unassigned; the next fetch shows the member view (Not seated).
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
                <LobbyTable lobby={lobby} viewerId={me} busy={busy} onSeat={onSeat} launching={launching} />
                {/* on Start the table grows and the rest fades (spec §4.7 Motion) */}
                <m.div className="flex flex-col gap-3" animate={{ opacity: launching ? 0 : 1 }} transition={spring.felt}>
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
                title={`Remove ${removeName}?`}
                body="They leave the lobby at once and can join again from the list."
                confirmLabel={`Remove ${removeName}`}
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
function NotSeated({ lobby, viewerId, hostView, onRemove }: { lobby: LobbyDTO; viewerId: string | null; hostView: boolean; onRemove: (name: string) => void }) {
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
                        onClick={() => onRemove(player.username ?? '')}
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
