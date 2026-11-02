import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, EmptyState, ErrorState, Input, Loader, Panel, PixelIcon, Segmented } from '../ui';
import { RankChip } from '../rank/RankChip';
import { ErrorAlert } from '../common/ErrorAlert';
import { RemoveFriendSheet } from './RemoveFriendSheet';
import { useFriends } from '../../hooks/useFriends';
import { useAuth } from '../../hooks/useAuth';
import type { Friendship } from '../../types/friendship';
import type { User } from '../../types/user';
import { errorMessage } from '../../utils/errorMessage';
import { formatDate } from '../../i18n/format';
import { useT } from '../../i18n/t';
import { fold } from '../../utils/fold';
import { displayName } from '../common/displayName';

type Tab = 'friends' | 'pending' | 'sent';
type Busy = 'accept' | 'reject' | 'cancel' | 'remove';

interface FriendRowProps {
    friendship: Friendship;
    other: User;
    tab: Tab;
    /** This row's request in flight, if any. */
    busy: Busy | undefined;
    onAccept: () => void;
    onReject: () => void;
    onCancel: () => void;
    onRemove: () => void;
    onViewProfile: () => void;
}

function FriendRow({ friendship, other, tab, busy, onAccept, onReject, onCancel, onRemove, onViewProfile }: FriendRowProps) {
    const t = useT();
    const name = displayName(other.username || t.common.unknownPlayer);
    // the row's other actions wait while one of its requests runs; other rows never do
    const held = (kind: Busy) => busy !== undefined && busy !== kind;
    return (
        <Panel padding="none" className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Avatar initial={name} />
            <div className="min-w-40 flex-1">
                <p className="t-headline break-words">{name}</p>
                <p className="t-footnote text-text-2">
                    Elo {other.eloRating ?? '—'}
                    {/* ranks spec §6.3: the rank between the Elo and the level */}
                    {other.rank && (
                        <>
                            {' '}
                            <RankChip rank={other.rank} className="align-middle" />
                        </>
                    )}{' '}
                    · {t.common.level} {other.level || 1}
                </p>
                {friendship.createdAt && (
                    <p className="t-footnote text-text-3">
                        {tab === 'friends' ? t.friends.since(formatDate(friendship.createdAt)) : t.friends.requested(formatDate(friendship.createdAt))}
                    </p>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="quiet" size="sm" leftIcon={<PixelIcon name="user" />} onClick={onViewProfile}>
                    {t.friends.viewProfile}
                </Button>
                {tab === 'friends' && (
                    <Button variant="secondary" size="sm" leftIcon={<PixelIcon name="trash" />} loading={busy === 'remove'} disabled={held('remove')} onClick={onRemove}>
                        {t.friends.remove}
                    </Button>
                )}
                {tab === 'pending' && (
                    <>
                        <Button size="sm" leftIcon={<PixelIcon name="check" />} loading={busy === 'accept'} disabled={held('accept')} onClick={onAccept}>
                            {t.friends.accept}
                        </Button>
                        <Button variant="secondary" size="sm" leftIcon={<PixelIcon name="x" />} loading={busy === 'reject'} disabled={held('reject')} onClick={onReject}>
                            {t.friends.decline}
                        </Button>
                    </>
                )}
                {tab === 'sent' && (
                    <Button variant="secondary" size="sm" leftIcon={<PixelIcon name="x" />} loading={busy === 'cancel'} disabled={held('cancel')} onClick={onCancel}>
                        {t.friends.cancelRequest}
                    </Button>
                )}
            </div>
        </Panel>
    );
}

/** /friends (spec §4.11): friends, requests to me and requests I sent, with each row's actions its own. */
export const FriendsList: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('friends');
    const [searchTerm, setSearchTerm] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);
    // Busy per row (spec §4.11): one row's request never disables another row's buttons
    const [busyById, setBusyById] = useState<Record<string, Busy>>({});
    const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);

    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    const t = useT();
    const { friendships, isLoading, error, acceptFriendRequest, rejectFriendRequest, cancelFriendRequest, removeFriend, refetch } =
        useFriends(currentUser?.id || undefined);

    const filteredFriendships = useMemo(() => {
        if (!friendships || !currentUser?.id) return [];

        let filtered = friendships.filter((friendship: Friendship) => {
            switch (activeTab) {
                case 'friends':
                    return friendship.status === 'ACCEPTED';
                case 'pending':
                    return friendship.status === 'PENDING' && friendship.toUser?.id === currentUser.id;
                case 'sent':
                    return friendship.status === 'PENDING' && friendship.fromUser?.id === currentUser.id;
                default:
                    return false;
            }
        });

        if (searchTerm) {
            const term = fold(searchTerm);
            filtered = filtered.filter((friendship: Friendship) => {
                const otherUser = friendship.fromUser?.id === currentUser.id ? friendship.toUser : friendship.fromUser;
                return fold(otherUser?.username ?? '').includes(term);
            });
        }

        return filtered;
    }, [friendships, activeTab, currentUser?.id, searchTerm]);

    const counts = useMemo(() => {
        if (!friendships || !currentUser?.id) {
            return { friends: 0, pending: 0, sent: 0 };
        }
        return {
            friends: friendships.filter((f: Friendship) => f.status === 'ACCEPTED').length,
            pending: friendships.filter((f: Friendship) => f.status === 'PENDING' && f.toUser?.id === currentUser.id).length,
            sent: friendships.filter((f: Friendship) => f.status === 'PENDING' && f.fromUser?.id === currentUser.id).length,
        };
    }, [friendships, currentUser?.id]);

    const run = async (id: string, action: Busy, work: () => Promise<unknown>, fallback: string) => {
        if (busyById[id]) return;
        setBusyById((current) => ({ ...current, [id]: action }));
        setActionError(null);
        try {
            await work();
        } catch (failure) {
            setActionError(errorMessage(failure, fallback));
        } finally {
            setBusyById((current) => {
                const next = { ...current };
                delete next[id];
                return next;
            });
        }
    };

    if (isLoading && !friendships.length) {
        return <Loader text={t.friends.loading} />;
    }

    if (error && !friendships.length) {
        return (
            <ErrorState
                title={t.friends.loadFailedTitle}
                body={t.friends.loadFailedBody}
                action={
                    <Button variant="secondary" onClick={() => refetch()}>
                        {t.common.tryAgain}
                    </Button>
                }
            />
        );
    }

    const empty = {
        friends: { title: t.friends.empty.friendsTitle, body: t.friends.empty.friendsBody },
        pending: { title: t.friends.empty.pendingTitle, body: t.friends.empty.pendingBody },
        sent: { title: t.friends.empty.sentTitle, body: t.friends.empty.sentBody },
    }[activeTab];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented
                    label={t.friends.lists}
                    value={activeTab}
                    onChange={setActiveTab}
                    options={[
                        { value: 'friends', label: t.friends.tabFriends(counts.friends) },
                        { value: 'pending', label: t.friends.tabRequests(counts.pending) },
                        { value: 'sent', label: t.friends.tabSent(counts.sent) },
                    ]}
                />
                <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isLoading} leftIcon={<PixelIcon name="refresh" />}>
                    {isLoading ? t.common.refreshing : t.common.refresh}
                </Button>
            </div>

            <ErrorAlert message={actionError} />

            <Input label={t.friends.search} hideLabel type="text" placeholder={t.friends.searchPlaceholder} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />

            {isLoading && friendships.length > 0 && <Loader layout="inline" text={t.friends.updating} />}

            {filteredFriendships.length === 0 ? (
                <EmptyState
                    icon="people"
                    title={empty.title}
                    body={empty.body}
                    action={
                        <Button variant="secondary" leftIcon={<PixelIcon name="trophy" />} onClick={() => navigate('/users')}>
                            {t.friends.openLeaderboard}
                        </Button>
                    }
                />
            ) : (
                <ul className="flex flex-col gap-2">
                    {filteredFriendships.map((friendship: Friendship) => {
                        const otherUser = friendship.fromUser?.id === currentUser?.id ? friendship.toUser : friendship.fromUser;
                        if (!otherUser || !friendship.id) return null;
                        const id = friendship.id;
                        return (
                            <li key={id}>
                                <FriendRow
                                    friendship={friendship}
                                    other={otherUser}
                                    tab={activeTab}
                                    busy={busyById[id]}
                                    onAccept={() => run(id, 'accept', () => acceptFriendRequest(id), t.friends.failed.accept)}
                                    onReject={() => run(id, 'reject', () => rejectFriendRequest(id), t.friends.failed.reject)}
                                    onCancel={() => run(id, 'cancel', () => cancelFriendRequest(id), t.friends.failed.cancel)}
                                    onRemove={() => setRemoving({ id, name: displayName(otherUser.username || t.friends.someone) })}
                                    onViewProfile={() => navigate(`/profile/${otherUser.id}`)}
                                />
                            </li>
                        );
                    })}
                </ul>
            )}

            <RemoveFriendSheet
                open={removing !== null}
                name={removing?.name ?? ''}
                busy={removing !== null && busyById[removing.id] === 'remove'}
                onClose={() => setRemoving(null)}
                onConfirm={() => {
                    if (!removing) return;
                    const { id } = removing;
                    run(id, 'remove', () => removeFriend(id), t.friends.failed.remove).then(() => setRemoving(null));
                }}
            />
        </div>
    );
};
