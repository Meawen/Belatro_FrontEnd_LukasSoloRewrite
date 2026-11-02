import { useState } from 'react';
import { Button, IconButton, PixelIcon, type IconName } from '../ui';
import { cx } from '../ui/cx';
import { RemoveFriendSheet } from './RemoveFriendSheet';
import type { FriendsState } from '../../hooks/useFriends';
import type { User } from '../../types/user';
import type { Friendship } from '../../types/friendship';
import { errorMessage } from '../../utils/errorMessage';
import { useT } from '../../i18n/t';
import { displayName } from '../common/displayName';

export type FriendStatus = 'none' | 'incoming' | 'outgoing' | 'friends' | 'closed';

/** Where `userId` stands with the signed-in player `meId` (today's UserCard rule, either direction). */
function friendshipWith(
    friendships: Friendship[],
    meId: string | null | undefined,
    userId: string | null | undefined,
): { friendship: Friendship | null; status: FriendStatus } {
    if (!meId || !userId) return { friendship: null, status: 'none' };
    const friendship =
        friendships.find(
            (f) => (f.fromUser?.id === userId && f.toUser?.id === meId) || (f.fromUser?.id === meId && f.toUser?.id === userId),
        ) ?? null;
    if (!friendship) return { friendship: null, status: 'none' };
    if (friendship.status === 'ACCEPTED') return { friendship, status: 'friends' };
    if (friendship.status === 'PENDING') return { friendship, status: friendship.toUser?.id === meId ? 'incoming' : 'outgoing' };
    // a declined or cancelled request: no action, as today
    return { friendship, status: 'closed' };
}

type Busy = 'send' | 'accept' | 'reject' | 'cancel' | 'remove';

export interface FriendActionsProps {
    /** The other player. */
    user: User;
    /** The signed-in player. */
    meId: string | null | undefined;
    friends: Pick<
        FriendsState,
        'friendships' | 'sendFriendRequest' | 'acceptFriendRequest' | 'rejectFriendRequest' | 'cancelFriendRequest' | 'removeFriend'
    >;
    /** Phones on the leaderboard: icon buttons with the same names. */
    compact?: boolean;
    className?: string;
}

interface ActionProps {
    label: string;
    icon: IconName;
    variant: 'primary' | 'secondary';
    busy: boolean;
    disabled: boolean;
    compact: boolean;
    onClick: () => void;
}

function Action({ label, icon, variant, busy, disabled, compact, onClick }: ActionProps) {
    if (compact) {
        return <IconButton icon={icon} aria-label={label} variant={variant} loading={busy} disabled={disabled} onClick={onClick} />;
    }
    return (
        <Button size="sm" variant={variant} leftIcon={<PixelIcon name={icon} />} loading={busy} disabled={disabled} onClick={onClick}>
            {label}
        </Button>
    );
}

/**
 * The friend buttons for another player (spec §4.10, §4.12): Add Friend, Pending (it cancels), Accept and
 * Decline, or Remove behind a confirm sheet. Busy per instance: one player's request never holds up another's.
 */
export function FriendActions({ user, meId, friends, compact = false, className }: FriendActionsProps) {
    const [busy, setBusy] = useState<Busy | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const t = useT();
    const { friendship, status } = friendshipWith(friends.friendships, meId, user.id);

    if (!meId || !user.id || user.id === meId || status === 'closed') return null;
    const toUserId = user.id;
    const friendshipId = friendship?.id ?? null;
    const name = displayName(user.username || t.friends.thisPlayer);

    const run = async (action: Busy, work: () => Promise<unknown>, fallback: string) => {
        if (busy) return;
        setBusy(action);
        setError(null);
        try {
            await work();
        } catch (failure) {
            setError(errorMessage(failure, fallback));
        } finally {
            setBusy(null);
        }
    };

    const action = (label: string, icon: IconName, variant: 'primary' | 'secondary', kind: Busy, onClick: () => void) => (
        <Action
            key={kind}
            label={label}
            icon={icon}
            variant={variant}
            busy={busy === kind}
            disabled={busy !== null && busy !== kind}
            compact={compact}
            onClick={onClick}
        />
    );

    let buttons;
    if (status === 'none') {
        // secondary: a list of players would otherwise be a column of yellow (the accent is for answering a request)
        buttons = action(t.friends.addFriend, 'plus', 'secondary', 'send', () =>
            run('send', () => friends.sendFriendRequest({ toUserId }), t.friends.failed.send),
        );
    } else if (status === 'incoming' && friendshipId) {
        buttons = (
            <>
                {action(t.friends.accept, 'check', 'primary', 'accept', () =>
                    run('accept', () => friends.acceptFriendRequest(friendshipId), t.friends.failed.accept),
                )}
                {action(t.friends.decline, 'x', 'secondary', 'reject', () =>
                    run('reject', () => friends.rejectFriendRequest(friendshipId), t.friends.failed.reject),
                )}
            </>
        );
    } else if (status === 'outgoing' && friendshipId) {
        buttons = action(t.friends.pending, 'more', 'secondary', 'cancel', () =>
            run('cancel', () => friends.cancelFriendRequest(friendshipId), t.friends.failed.cancel),
        );
    } else if (status === 'friends' && friendshipId) {
        buttons = action(t.friends.remove, 'trash', 'secondary', 'remove', () => setConfirming(true));
    } else {
        return null;
    }

    return (
        <div className={cx('flex flex-col gap-1', className)}>
            <div className="flex flex-wrap items-center gap-2">{buttons}</div>
            {error && (
                <p role="alert" className="t-footnote text-danger-text">
                    {error}
                </p>
            )}
            {friendshipId && (
                <RemoveFriendSheet
                    open={confirming}
                    name={name}
                    busy={busy === 'remove'}
                    onClose={() => setConfirming(false)}
                    onConfirm={() =>
                        run('remove', () => friends.removeFriend(friendshipId), t.friends.failed.remove).then(() => setConfirming(false))
                    }
                />
            )}
        </div>
    );
}
