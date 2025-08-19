import React, { useState } from 'react';
import { Button } from '../common';
import { MatchDetails } from './MatchDetails';
import type { PlayerMatchHistoryDTO } from '../../types/user';
import type { UserSimpleDTO } from '../../types';

interface MatchCardProps {
    historyItem: PlayerMatchHistoryDTO;
    currentUserId?: string | null;
}

export const MatchCard: React.FC<MatchCardProps> = ({ historyItem, currentUserId }) => {
    const [showDetails, setShowDetails] = useState(false);

    const { history, yourResult } = historyItem;
    const match = history?.match;

    if (!match) {
        return (
            <div className="card bg-emerald-900/20 border-emerald-800">
                <div className="text-center py-8 text-emerald-400/70">
                    <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Match data unavailable
                </div>
            </div>
        );
    }

    // Enhanced result styling with emerald theme
    const getResultStyling = () => {
        if (yourResult?.toLowerCase().includes('win'))
            return 'border-emerald-400/40 bg-gradient-to-r from-emerald-900/40 to-emerald-800/20 shadow-emerald-500/10';
        if (yourResult?.toLowerCase().includes('draw'))
            return 'border-amber-400/40 bg-gradient-to-r from-amber-900/40 to-amber-800/20 shadow-amber-500/10';
        if (yourResult?.toLowerCase().includes('loss'))
            return 'border-red-400/40 bg-gradient-to-r from-red-900/40 to-red-800/20 shadow-red-500/10';
        return 'border-emerald-600/30 bg-gradient-to-r from-emerald-900/20 to-emerald-800/10';
    };

    const getResultIcon = () => {
        const iconClass = "w-10 h-10";

        if (yourResult?.toLowerCase().includes('win')) {
            return (
                <div className="relative">
                    <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <svg className={`${iconClass} text-emerald-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-pulse"></div>
                </div>
            );
        }
        if (yourResult?.toLowerCase().includes('draw')) {
            return (
                <div className="w-14 h-14 bg-amber-500/20 rounded-xl flex items-center justify-center">
                    <svg className={`${iconClass} text-amber-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                </div>
            );
        }
        if (yourResult?.toLowerCase().includes('loss')) {
            return (
                <div className="w-14 h-14 bg-red-500/20 rounded-xl flex items-center justify-center">
                    <svg className={`${iconClass} text-red-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
            );
        }
        return (
            <div className="w-14 h-14 bg-emerald-600/20 rounded-xl flex items-center justify-center">
                <svg className={`${iconClass} text-emerald-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
        );
    };

    const getResultText = () => {
        if (yourResult?.toLowerCase().includes('win')) return 'Victory';
        if (yourResult?.toLowerCase().includes('draw')) return 'Draw';
        if (yourResult?.toLowerCase().includes('loss')) return 'Defeat';
        return yourResult || 'Unknown';
    };

    const getResultColor = () => {
        if (yourResult?.toLowerCase().includes('win')) return 'text-emerald-300';
        if (yourResult?.toLowerCase().includes('draw')) return 'text-amber-300';
        if (yourResult?.toLowerCase().includes('loss')) return 'text-red-300';
        return 'text-emerald-400';
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Unknown time';

        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays === 1) {
            return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    const formatDuration = (startTime?: string, endTime?: string) => {
        if (!startTime || !endTime) return 'Unknown';

        const start = new Date(startTime).getTime();
        const end = new Date(endTime).getTime();
        const durationMs = end - start;
        const minutes = Math.floor(durationMs / (1000 * 60));

        if (minutes < 60) return `${minutes}min`;
        const hours = Math.floor(minutes / 60);
        const remainingMins = minutes % 60;
        return `${hours}h ${remainingMins}m`;
    };

    const totalPlayers = (match.teamA?.length || 0) + (match.teamB?.length || 0);
    const duration = formatDuration(match.startTime || undefined, match.endTime || undefined);

    return (
        <>
            <div className={`bg-emerald-950/40 backdrop-blur-sm border-2 rounded-xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] ${getResultStyling()}`}>
                <div className="flex items-start justify-between">
                    {/* Left side - Match info */}
                    <div className="flex gap-6 flex-1">
                        {/* Result icon */}
                        {getResultIcon()}

                        {/* Match details */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                                <h3 className={`text-2xl font-bold ${getResultColor()}`}>
                                    {getResultText()}
                                </h3>
                                <div className="flex items-center gap-2">
                  <span className="bg-emerald-600/30 text-emerald-300 px-3 py-1 rounded-full text-sm font-medium">
                    {match.gameMode || 'Unknown'}
                  </span>
                                    <span className="text-emerald-400/60 text-xs">
                    #{match.id?.slice(-8) || 'Unknown'}
                  </span>
                                </div>
                            </div>

                            {/* Match stats */}
                            <div className="flex items-center gap-6 text-sm text-emerald-400/80 mb-4">
                                <div className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {formatDate(match.endTime)}
                                </div>
                                <div className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    {duration}
                                </div>
                                <div className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    {totalPlayers} players
                                </div>
                            </div>

                            {/* Teams preview */}
                            <div className="flex items-center gap-8">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-emerald-400/60 font-medium">TEAM A</span>
                                    <div className="flex -space-x-2">
                                        {match.teamA?.slice(0, 4).map((player: UserSimpleDTO) => (
                                            <div
                                                key={player.id}
                                                className={`w-8 h-8 rounded-full border-2 border-emerald-950 flex items-center justify-center text-xs font-bold ${
                                                    player.id === currentUserId
                                                        ? 'bg-gradient-to-r from-purple-500 to-emerald-500 text-white'
                                                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                                                }`}
                                                title={player.username}
                                            >
                                                {player.username?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                        ))}
                                        {(match.teamA?.length || 0) > 4 && (
                                            <div className="w-8 h-8 bg-emerald-800/60 rounded-full border-2 border-emerald-950 flex items-center justify-center text-xs text-emerald-300">
                                                +{(match.teamA?.length || 0) - 4}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="text-emerald-500/50 font-bold">VS</div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-emerald-400/60 font-medium">TEAM B</span>
                                    <div className="flex -space-x-2">
                                        {match.teamB?.slice(0, 4).map((player: UserSimpleDTO) => (
                                            <div
                                                key={player.id}
                                                className={`w-8 h-8 rounded-full border-2 border-emerald-950 flex items-center justify-center text-xs font-bold ${
                                                    player.id === currentUserId
                                                        ? 'bg-gradient-to-r from-purple-500 to-emerald-500 text-white'
                                                        : 'bg-gradient-to-r from-red-500 to-pink-500 text-white'
                                                }`}
                                                title={player.username}
                                            >
                                                {player.username?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                        ))}
                                        {(match.teamB?.length || 0) > 4 && (
                                            <div className="w-8 h-8 bg-emerald-800/60 rounded-full border-2 border-emerald-950 flex items-center justify-center text-xs text-emerald-300">
                                                +{(match.teamB?.length || 0) - 4}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right side - Action button */}
                    <div className="flex flex-col items-end gap-2">
                        <Button
                            onClick={() => setShowDetails(true)}
                            variant="outline"
                            size="small"
                            className="bg-emerald-800/30 border-emerald-600 hover:bg-emerald-700/40 text-emerald-300"
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Details
                        </Button>
                    </div>
                </div>
            </div>

            {/* Match Details Modal */}
            {showDetails && (
                <MatchDetails
                    historyItem={historyItem}
                    currentUserId={currentUserId}
                    onClose={() => setShowDetails(false)}
                />
            )}
        </>
    );
};