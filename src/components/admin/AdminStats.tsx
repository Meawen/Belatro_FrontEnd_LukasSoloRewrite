import React, { useId } from 'react';
import { Loader, type IconName } from '../ui';
import { useAllMatches } from '../../hooks/useMatch';
import { useLobbies } from '../../hooks/useLobby';
import { useAdmin } from '../../hooks/useAdmin';
import type { UserDto } from '../../types/user';
import { useT } from '../../i18n/t';
import { formatNumber } from '../../i18n/format';
import { StatTile } from './StatTile';

export const AdminStats: React.FC = () => {
    const { matches, isLoading: matchesLoading } = useAllMatches();
    const { users: adminUsers, isLoading: adminUsersLoading } = useAdmin();
    // X-7: the open lobbies (GET /lobbies/open); the hook's `lobbies` is the all-lobbies query, which never runs here
    const { openLobbies, isLoading: lobbiesLoading } = useLobbies();
    const headingId = useId();
    const t = useT();

    if (matchesLoading || adminUsersLoading || lobbiesLoading) {
        return <Loader text={t.admin.stats.loading} />;
    }

    // matches for game stats, adminUsers for admin-specific stats
    const totalUsers = adminUsers?.length || 0;

    const pendingDeletions = adminUsers?.filter((user: UserDto) => user.deletionRequested).length || 0;
    const activeLobbies = Array.isArray(openLobbies) ? openLobbies.length : 0;
    // Count the matches themselves: summing gamesPlayed over users counted each match four
    // times, and /user/findAll is paged now.
    const totalMatches = Array.isArray(matches) ? matches.length : 0;

    const stats: { label: string; value: number; icon: IconName }[] = [
        { label: t.admin.stats.users, value: totalUsers, icon: 'people' },
        { label: t.admin.stats.matches, value: totalMatches, icon: 'cards' },
        { label: t.admin.stats.tables, value: activeLobbies, icon: 'list' },
        { label: t.admin.stats.deletions, value: pendingDeletions, icon: 'trash' },
    ];

    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-3">
            <h2 id={headingId} className="t-title">
                {t.admin.stats.title}
            </h2>
            <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <StatTile key={stat.label} label={stat.label} value={formatNumber(stat.value)} icon={stat.icon} />
                ))}
            </dl>
        </section>
    );
};
