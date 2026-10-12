import React, { useId, type ReactNode } from 'react';
import { Avatar, Button, Chip, EmptyState, ErrorState, Loader, Panel } from '../ui';
import { MatchRow } from '../match/MatchRow';
import { FriendActions } from './FriendActions';
import { useUser, useMe, useUserHistorySummary } from '../../hooks/useUser';
import { useAuth } from '../../hooks/useAuth';
import { useFriends } from '../../hooks/useFriends';

/** How many of the player's newest matches the profile lists (spec §4.10: size=5). */
export const PROFILE_RECENT_MATCHES = 5;

export interface UserProfileProps {
    userId?: string;
}

function Stat({ label, value }: { label: string; value: number | string }) {
    return (
        <Panel padding="none" className="px-4 py-3">
            <dt className="t-caption text-text-2">{label}</dt>
            <dd className="t-score mt-1 tabular-nums">{value}</dd>
        </Panel>
    );
}

/** A state of the page while there is no player to show: under the page's h1. */
function Frame({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="t-display">Profile</h1>
            {children}
        </div>
    );
}

/**
 * A player's public face (spec §4.10; D-32): the name, the numbers once, the recent matches and, on another
 * player's profile, the friend actions. Your account (address, password, deletion) is in Settings.
 */
export const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
    const { user: currentUser } = useAuth();
    const targetUserId = userId || (currentUser?.id ?? undefined);
    const isOwnProfile = !userId || userId === currentUser?.id;
    const { user: player, error, refetch } = useUser(targetUserId);
    // roles come only from GET /user/me, and only your own profile shows them
    const { data: me } = useMe(isOwnProfile);
    // the friendships, only where the friend actions are
    const friends = useFriends(isOwnProfile ? undefined : currentUser?.id || undefined);
    const recent = useUserHistorySummary(targetUserId ?? '', { page: 0, size: PROFILE_RECENT_MATCHES });
    const recentId = useId();

    if (!targetUserId || error?.status === 404) {
        return (
            <Frame>
                <Panel>
                    <EmptyState icon="user" title="Profile not found" body="Profile information is not available." />
                </Panel>
            </Frame>
        );
    }

    if (error) {
        return (
            <Frame>
                <Panel>
                    <ErrorState
                        title="Couldn't load this profile"
                        action={
                            <Button variant="secondary" onClick={() => refetch().catch(() => {})}>
                                Try Again
                            </Button>
                        }
                    />
                </Panel>
            </Frame>
        );
    }

    if (!player) {
        return (
            <Frame>
                <Loader text="Loading profile..." />
            </Frame>
        );
    }

    const name = player.username || 'Unknown User';
    const matches = recent.data?.content;
    let recentList;
    if (recent.error) {
        recentList = <p className="t-callout text-text-2">Couldn't load the recent matches.</p>;
    } else if (!matches) {
        recentList = <Loader layout="inline" text="Loading matches..." className="self-start" />;
    } else if (matches.length === 0) {
        recentList = <p className="t-callout text-text-2">No matches yet</p>;
    } else {
        recentList = (
            <ul className="flex flex-col gap-2">
                {matches.map((summary, index) => (
                    <li key={summary.matchId ?? index}>
                        <MatchRow summary={summary} />
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="flex min-w-0 items-center gap-4">
                    <Avatar initial={name} tone={isOwnProfile ? 'accent' : 'neutral'} size="xl" />
                    <div className="flex min-w-0 flex-col gap-2">
                        <h1 className="t-display break-words">{name}</h1>
                        {isOwnProfile && me?.roles && me.roles.length > 0 && (
                            <ul aria-label="Roles" className="flex flex-wrap gap-1.5">
                                {me.roles.map((role) => (
                                    <li key={role}>
                                        <Chip>{role.replace('ROLE_', '')}</Chip>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {!isOwnProfile && <FriendActions user={player} meId={currentUser?.id} friends={friends} className="items-start" />}
                    </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 lg:w-80">
                    <Stat label="Elo" value={player.eloRating ?? '—'} />
                    <Stat label="Games" value={player.gamesPlayed ?? '—'} />
                    {/* a new player is level 0 in the database and Level 1 on every screen (R-34) */}
                    <Stat label="Level" value={player.level || 1} />
                </dl>
            </div>

            <section aria-labelledby={recentId} className="flex flex-col gap-3">
                <h2 id={recentId} className="t-title">
                    Recent matches
                </h2>
                {recentList}
            </section>
        </div>
    );
};
