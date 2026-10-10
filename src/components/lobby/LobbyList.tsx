import { useEffect, useRef, useState } from 'react';
import { Button, EmptyState, ErrorState, Input, ListRow, Loader, PixelIcon, Select, Tag } from '../ui';
import { cx } from '../ui/cx';
import { ErrorAlert } from '../common/ErrorAlert';
import { useMediaQuery } from '../layout/useMediaQuery';
import { useAuth } from '../../hooks/useAuth';
import type { LobbyDTO } from '../../types/lobby';
import { LobbyQuickLook } from './LobbyQuickLook';
import {
    filterLobbies,
    isFull,
    isMember,
    LOBBY_CAP,
    lobbyName,
    lobbyRowLabel,
    memberCount,
    SORT_OPTIONS,
    sortLobbies,
    type LobbySort,
} from './lobbyModel';

export interface LobbyListProps {
    /** The last good list (useOpenLobbies); null until the first answer. */
    lobbies: LobbyDTO[] | null;
    /** The first load failed. */
    failed: boolean;
    /** The last poll failed; `lobbies` is the last good list. */
    pollFailed: boolean;
    onRetry: () => void;
}

const NO_LOBBIES: LobbyDTO[] = [];

/** The open lobbies (spec §4.6): search, sort, one row per lobby, and the quick-look a row opens. */
export function LobbyList({ lobbies, failed, pollFailed, onRetry }: LobbyListProps) {
    const { user } = useAuth();
    const me = user?.id ?? null;
    const wide = useMediaQuery('(min-width: 768px)');
    const [term, setTerm] = useState('');
    const [sort, setSort] = useState<LobbySort>('newest');
    const [selected, setSelected] = useState<LobbyDTO | null>(null);

    // A finger (or the mouse button) is down on the list: a poll must not move a row out from under it.
    const pointerDown = useRef(false);
    useEffect(() => {
        const release = () => {
            pointerDown.current = false;
        };
        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', release);
        return () => {
            window.removeEventListener('pointerup', release);
            window.removeEventListener('pointercancel', release);
        };
    }, []);

    const all = lobbies ?? NO_LOBBIES;
    const rows = useSteadyOrder(all, sort, term, pointerDown.current || selected !== null);

    if (lobbies === null) {
        if (failed) {
            return (
                <ErrorState
                    title="Couldn't load the lobbies"
                    action={
                        <Button variant="secondary" onClick={onRetry}>
                            Try again
                        </Button>
                    }
                />
            );
        }
        return <Loader text="Loading lobbies…" />;
    }

    // the quick-look follows its lobby by id; when a poll no longer lists it, it says so
    const live = selected ? (all.find((lobby) => lobby.id === selected.id) ?? null) : null;

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <Input label="Search lobbies" type="search" value={term} onChange={(event) => setTerm(event.target.value)} autoComplete="off" />
                <Select label="Sort by" value={sort} onChange={(value) => setSort(value as LobbySort)} options={SORT_OPTIONS} />
            </div>

            {pollFailed && <ErrorAlert message="Couldn't refresh — showing the last list" />}

            {all.length === 0 ? (
                <EmptyState icon="cards" title="No open lobbies." body="Create one and invite friends." />
            ) : rows.length === 0 ? (
                <EmptyState icon="search" title="No lobbies match your search." />
            ) : (
                <ul
                    aria-label="Open lobbies"
                    className="flex flex-col gap-2"
                    onPointerDown={() => {
                        pointerDown.current = true;
                    }}
                >
                    {rows.map((lobby) => (
                        <li key={lobby.id}>
                            <LobbyRow lobby={lobby} me={me} wide={wide} onOpen={setSelected} />
                        </li>
                    ))}
                </ul>
            )}

            <LobbyQuickLook lobby={selected ? (live ?? selected) : null} gone={selected !== null && live === null} onClose={() => setSelected(null)} />
        </div>
    );
}

const orderOf = (lobbies: LobbyDTO[], sort: LobbySort, term: string) => sortLobbies(filterLobbies(lobbies, term), sort).map((lobby) => lobby.id);

/** The earlier places for the lobbies still there, then any new ones. */
function keepPlaces(previous: (string | null)[], next: (string | null)[]): (string | null)[] {
    return [...previous.filter((id) => next.includes(id)), ...next.filter((id) => !previous.includes(id))];
}

/**
 * The rows in sorted order, except that a poll never reorders them while `frozen` (a pointer down on the list,
 * the quick-look open): then the rows keep their places, and the new order applies with the next poll after
 * that (spec §4.6). A new sort or search applies at once.
 */
function useSteadyOrder(lobbies: LobbyDTO[], sort: LobbySort, term: string, frozen: boolean): LobbyDTO[] {
    const [shown, setShown] = useState(() => ({ source: lobbies, sort, term, ids: orderOf(lobbies, sort, term) }));
    let ids = shown.ids;
    if (shown.source !== lobbies || shown.sort !== sort || shown.term !== term) {
        const next = orderOf(lobbies, sort, term);
        ids = frozen && shown.sort === sort && shown.term === term ? keepPlaces(shown.ids, next) : next;
        setShown({ source: lobbies, sort, term, ids });
    }
    const byId = new Map(lobbies.map((lobby) => [lobby.id, lobby]));
    return ids.flatMap((id) => {
        const lobby = byId.get(id);
        return lobby ? [lobby] : [];
    });
}

function LobbyRow({ lobby, me, wide, onOpen }: { lobby: LobbyDTO; me: string | null; wide: boolean; onOpen: (lobby: LobbyDTO) => void }) {
    const host = `host ${lobby.hostUser?.username ?? 'unknown'}`;
    const facts = <RowFacts lobby={lobby} me={me} />;
    return (
        <ListRow
            as="button"
            onClick={() => onOpen(lobby)}
            aria-label={lobbyRowLabel(lobby, me)}
            title={
                <span className="inline-flex max-w-full items-center gap-2">
                    <span className="truncate">{lobbyName(lobby)}</span>
                    {lobby.privateLobby && (
                        <span className="t-footnote inline-flex shrink-0 items-center gap-1 text-text-2">
                            <PixelIcon name="lock" />
                            Private
                        </span>
                    )}
                </span>
            }
            meta={
                wide ? (
                    host
                ) : (
                    <span className="inline-flex items-center gap-2">
                        <span>{host}</span>
                        {facts}
                    </span>
                )
            }
            trailing={wide ? facts : undefined}
        />
    );
}

function RowFacts({ lobby, me }: { lobby: LobbyDTO; me: string | null }) {
    return (
        <span className="inline-flex items-center gap-2">
            <SeatSquares lobby={lobby} />
            <span className="t-footnote tabular-nums text-text">
                {memberCount(lobby)}/{LOBBY_CAP}
            </span>
            {isFull(lobby) && <Tag tone="warn">Full</Tag>}
            {isMember(lobby, me) && <Tag tone="you">You're in</Tag>}
        </span>
    );
}

/** Team A's two seats, then Team B's: filled in the team colour when taken, outlined when free. */
function SeatSquares({ lobby }: { lobby: LobbyDTO }) {
    const seats = [
        { team: 'A', taken: (lobby.teamAPlayers?.length ?? 0) > 0 },
        { team: 'A', taken: (lobby.teamAPlayers?.length ?? 0) > 1 },
        { team: 'B', taken: (lobby.teamBPlayers?.length ?? 0) > 0 },
        { team: 'B', taken: (lobby.teamBPlayers?.length ?? 0) > 1 },
    ];
    return (
        <span aria-hidden="true" className="inline-flex gap-[3px]">
            {seats.map((seat, i) => (
                <span
                    key={i}
                    data-seat={`${seat.team} ${seat.taken ? 'taken' : 'free'}`}
                    className={cx(
                        'size-2.5',
                        seat.team === 'A'
                            ? seat.taken
                                ? 'bg-team-a'
                                : 'shadow-[inset_0_0_0_2px_var(--team-a)]'
                            : seat.taken
                              ? 'bg-team-b'
                              : 'shadow-[inset_0_0_0_2px_var(--team-b)]',
                    )}
                />
            ))}
        </span>
    );
}
