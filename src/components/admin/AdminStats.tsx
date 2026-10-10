import React, { useId } from 'react';
import { Loader, Panel, PixelIcon, type IconName } from '../ui';
import { useAllMatches } from '../../hooks/useMatch';
import { useLobbies } from '../../hooks/useLobby';
import { useAdmin } from '../../hooks/useAdmin';
import type { UserDto } from '../../types/user';

export const AdminStats: React.FC = () => {
    const { matches, isLoading: matchesLoading } = useAllMatches();
    const { users: adminUsers, isLoading: adminUsersLoading } = useAdmin();
    // X-7: the open lobbies (GET /lobbies/open); the hook's `lobbies` is the all-lobbies query, which never runs here
    const { openLobbies, isLoading: lobbiesLoading } = useLobbies();
    const headingId = useId();

    if (matchesLoading || adminUsersLoading || lobbiesLoading) {
        return <Loader text="Loading statistics..." />;
    }

    // matches for game stats, adminUsers for admin-specific stats
    const totalUsers = adminUsers?.length || 0;

    const pendingDeletions = adminUsers?.filter((user: UserDto) => user.deletionRequested).length || 0;
    const activeLobbies = Array.isArray(openLobbies) ? openLobbies.length : 0;
    // Count the matches themselves: summing gamesPlayed over users counted each match four
    // times, and /user/findAll is paged now.
    const totalMatches = Array.isArray(matches) ? matches.length : 0;

    const stats: { label: string; value: number; icon: IconName }[] = [
        { label: 'Total Users', value: totalUsers, icon: 'people' },
        { label: 'Total Matches', value: totalMatches, icon: 'cards' },
        { label: 'Active Lobbies', value: activeLobbies, icon: 'list' },
        { label: 'Pending Deletions', value: pendingDeletions, icon: 'trash' },
    ];

    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-3">
            <h2 id={headingId} className="t-title">
                System Statistics
            </h2>
            <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Panel key={stat.label} padding="none" className="flex items-center gap-3 px-4 py-3">
                        <PixelIcon name={stat.icon} scale={3} className="shrink-0 text-text-3" />
                        <div className="flex min-w-0 flex-col-reverse">
                            <dt className="t-caption text-text-2">{stat.label}</dt>
                            <dd className="t-score tabular-nums">{stat.value.toLocaleString()}</dd>
                        </div>
                    </Panel>
                ))}
            </dl>
        </section>
    );
};
