import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Button, EmptyState, ErrorState, Input, ListRow, Loader, Pager, PixelIcon, Tag } from '../ui';
import { FriendActions } from './FriendActions';
import { useMediaQuery } from '../layout/useMediaQuery';
import { useUsersPage, USERS_PAGE_SIZE } from '../../hooks/useUser';
import { useFriends, type FriendsState } from '../../hooks/useFriends';
import { useAuth } from '../../hooks/useAuth';
import type { User } from '../../types/user';
import { errorMessage } from '../../utils/errorMessage';

// The server searches; wait for a pause in typing before asking it.
const SEARCH_DEBOUNCE_MS = 300;
// One refresh every 3 s at most: it asks the server again.
const REFRESH_LOCK_MS = 3000;

/** Phones get compact rows (spec §4.12): rank, name, Elo, and the friend action as an icon button. */
export const COMPACT_ROWS_QUERY = '(max-width: 767.98px)';

/** A player with at least one game is ranked; accounts without one are listed after them as Unranked (O-3). */
const isRanked = (user: User): boolean => (user.gamesPlayed ?? 0) > 0;

interface PlayerRowProps {
    player: User;
    /** The place on the leaderboard, or null: unranked, or a search is applied. */
    rank: number | null;
    isMe: boolean;
    meId: string | null;
    friends: FriendsState;
    compact: boolean;
}

function PlayerRow({ player, rank, isMe, meId, friends, compact }: PlayerRowProps) {
    const name = player.username || 'Unknown User';
    const games = player.gamesPlayed ?? 0;
    return (
        <ListRow
            highlight={isMe}
            leading={
                <span className="flex items-center gap-3">
                    <span className={compact ? 't-score w-9 text-right text-text-2' : 't-score w-12 text-right text-text-2'}>
                        {rank !== null ? `#${rank}` : ''}
                    </span>
                    {!compact && <Avatar initial={name} tone={isMe ? 'accent' : 'neutral'} />}
                </span>
            }
            title={
                <span className="flex items-center gap-2">
                    <Link to={`/profile/${player.id}`} className="inline-flex min-h-11 min-w-0 items-center truncate hover:underline">
                        {name}
                    </Link>
                    {isMe && <Tag tone="you">You</Tag>}
                    {!isRanked(player) && <Tag>Unranked</Tag>}
                </span>
            }
            meta={compact ? undefined : `${games} ${games === 1 ? 'game' : 'games'} · Level ${player.level || 1}`}
            trailing={
                <>
                    <span className="flex flex-col items-end">
                        <span className="t-score tabular-nums">{player.eloRating ?? '—'}</span>
                        <span className="t-caption text-text-3">Elo</span>
                    </span>
                    {!isMe && <FriendActions user={player} meId={meId} friends={friends} compact={compact} className="items-end" />}
                </>
            }
        />
    );
}

/** /users, the leaderboard (spec §4.12; D-28): the server's Elo-ranked page as it is, me included. */
export const UserList: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [page, setPage] = useState(0);
    const [query, setQuery] = useState('');
    // Back to the first page only when the term really changes: not on mount, where it
    // would undo a page change made during the pause.
    useEffect(() => {
        const term = searchTerm.trim();
        if (term === query) return;
        const timer = window.setTimeout(() => {
            setQuery(term);
            setPage(0);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchTerm, query]);

    const { data: usersPage, isLoading, error, refetch } = useUsersPage(page, query);
    const users = usersPage?.content;
    const totalUsers = usersPage?.totalElements ?? 0;
    const { user: authUser } = useAuth();
    const meId = authUser?.id ?? null;
    // one friendships list for every row's buttons
    const friends = useFriends(meId ?? undefined);
    const compact = useMediaQuery(COMPACT_ROWS_QUERY);

    const handleRefresh = useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            await refetch();
        } catch {
            // the error state below shows what went wrong
        } finally {
            window.setTimeout(() => setIsRefreshing(false), REFRESH_LOCK_MS);
        }
    }, [refetch, isRefreshing]);

    const clearSearch = useCallback(() => setSearchTerm(''), []);

    if (!usersPage && !error) {
        return <Loader text="Loading users..." />;
    }

    if (error) {
        return (
            <ErrorState
                title="Error Loading Users"
                body={errorMessage(error, 'Failed to load user list')}
                action={
                    <Button variant="secondary" onClick={handleRefresh} disabled={isRefreshing}>
                        {isRefreshing ? 'Retrying...' : 'Try Again'}
                    </Button>
                }
            />
        );
    }

    let list;
    if (!users || users.length === 0) {
        list = query ? (
            <EmptyState
                icon="search"
                title={`No players match '${query}'`}
                action={
                    <Button variant="secondary" onClick={clearSearch}>
                        Clear Search
                    </Button>
                }
            />
        ) : (
            <EmptyState icon="people" title="No Users Found" body="No users available." />
        );
    } else {
        // Ranks only without a search term (spec §4.12): a search shows a slice, not places
        const offset = (usersPage?.number ?? 0) * USERS_PAGE_SIZE;
        list = (
            <ul className="flex flex-col gap-2">
                {users.map((player, index) => (
                    <li key={player.id ?? index}>
                        <PlayerRow
                            player={player}
                            rank={!query && isRanked(player) ? offset + index + 1 : null}
                            isMe={!!meId && player.id === meId}
                            meId={meId}
                            friends={friends}
                            compact={compact}
                        />
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="t-callout text-text-2">
                    {totalUsers} {totalUsers === 1 ? 'user' : 'users'} found
                </p>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing || isLoading}
                    leftIcon={<PixelIcon name="refresh" />}
                >
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
            </div>

            <Input
                label="Search players"
                hideLabel
                type="text"
                placeholder="Search users by username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />

            {isLoading && <Loader layout="inline" text="Loading users..." />}

            {list}

            {/* Step from the page the server answered with, and not while the next one loads
                (useApi keeps the old page on screen meanwhile, so a double-click would skip one). */}
            {usersPage && usersPage.totalPages > 1 && (
                <Pager
                    className="mt-2"
                    page={usersPage.number}
                    pageCount={usersPage.totalPages}
                    hasNext={usersPage.number + 1 < usersPage.totalPages}
                    disabled={isLoading}
                    onPage={(next) => setPage(Math.max(0, next))}
                />
            )}
        </div>
    );
};
