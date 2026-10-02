import React from 'react';
import type { User, UserDto } from '../../types/user';

export interface ProfileStatsProps {
    user: User;
    me?: UserDto | null;
}

export const ProfileStats: React.FC<ProfileStatsProps> = ({ user, me }) => {
    const eloRating = user.eloRating || 1200;
    const gamesPlayed = user.gamesPlayed || 0;
    const level = user.level || 1;

    return (
        <div className="space-y-6">
            {/* Game Statistics */}
            <div className="card">
                <h3 className="text-lg font-semibold text-white mb-4">Game Statistics</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                        <div className="text-3xl font-bold text-purple-400 mb-1">
                            {eloRating}
                        </div>
                        <div className="text-sm text-slate-400">Current ELO</div>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                        <div className="text-3xl font-bold text-blue-400 mb-1">
                            {gamesPlayed}
                        </div>
                        <div className="text-sm text-slate-400">Games Played</div>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                        <div className="text-3xl font-bold text-green-400 mb-1">
                            {level}
                        </div>
                        <div className="text-sm text-slate-400">Level</div>
                    </div>
                </div>
            </div>

            {/* Rank Information */}
            <div className="card">
                <h3 className="text-lg font-semibold text-white mb-4">Ranking</h3>

                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-2xl">
                        {getRankIcon(eloRating)}
                    </div>

                    <div>
                        <h4 className="text-xl font-bold text-white">
                            {getRankName(eloRating)}
                        </h4>
                        <p className="text-slate-400">
                            {eloRating} ELO • {getRankDescription(eloRating)}
                        </p>
                    </div>
                </div>

                {/* ELO Progress to Next Rank */}
                <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">Progress to Next Rank</span>
                        <span className="text-sm text-white font-medium">
              {getProgressToNextRank(eloRating)}%
            </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                            className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${getProgressToNextRank(eloRating)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Account Information */}
            <div className="card">
                <h3 className="text-lg font-semibold text-white mb-4">Account Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-slate-400">Username:</span>
                        <div className="text-white font-medium">
                            {user.username || 'Not set'}
                        </div>
                    </div>

                    {/* Email and roles come from GET /user/me and exist only on your own profile. */}
                    {me && (
                        <div>
                            <span className="text-slate-400">Email:</span>
                            <div className="text-white font-medium">
                                {me.email || 'Not set'}
                            </div>
                        </div>
                    )}

                    {me?.roles && me.roles.length > 0 && (
                        <div>
                            <span className="text-slate-400">Roles:</span>
                            <div className="flex gap-1 mt-1">
                                {me.roles.map((role, index) => (
                                    <span key={index} className="badge badge-purple text-xs">
                    {role.replace('ROLE_', '')}
                  </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper functions for rank system
function getRankIcon(elo: number): string {
    if (elo >= 2000) return '👑';
    if (elo >= 1800) return '💎';
    if (elo >= 1600) return '🏆';
    if (elo >= 1400) return '🥈';
    if (elo >= 1200) return '🥉';
    return '🆕';
}

function getRankName(elo: number): string {
    if (elo >= 2000) return 'Grandmaster';
    if (elo >= 1800) return 'Master';
    if (elo >= 1600) return 'Expert';
    if (elo >= 1400) return 'Advanced';
    if (elo >= 1200) return 'Intermediate';
    return 'Beginner';
}

function getRankDescription(elo: number): string {
    if (elo >= 2000) return 'Elite player';
    if (elo >= 1800) return 'Highly skilled';
    if (elo >= 1600) return 'Very experienced';
    if (elo >= 1400) return 'Experienced player';
    if (elo >= 1200) return 'Learning the ropes';
    return 'Just getting started';
}

function getProgressToNextRank(elo: number): number {
    const thresholds = [1200, 1400, 1600, 1800, 2000];
    const nextThreshold = thresholds.find(t => t > elo);

    if (!nextThreshold) return 100; // Max rank reached

    const prevThreshold = thresholds[thresholds.indexOf(nextThreshold) - 1] || 0;
    const progress = ((elo - prevThreshold) / (nextThreshold - prevThreshold)) * 100;

    return Math.min(Math.max(progress, 0), 100);
}
