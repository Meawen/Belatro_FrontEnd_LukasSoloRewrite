
import React from 'react';
import type { PlayerMatchSummaryDTO } from '../../types/user';

interface MatchSummaryCardProps {
    summaryItem: PlayerMatchSummaryDTO;
    currentUserId?: string | null;
}

export const MatchSummaryCard: React.FC<MatchSummaryCardProps> = ({ summaryItem }) => {
    const { matchId, endTime, result, yourOutcome, gameMode } = summaryItem;

    // Get result styling with emerald theme
    const getResultStyling = () => {
        if (yourOutcome?.toLowerCase().includes('win')) return 'border-l-emerald-400 bg-emerald-900/20';
        if (yourOutcome?.toLowerCase().includes('draw')) return 'border-l-amber-400 bg-amber-900/20';
        if (yourOutcome?.toLowerCase().includes('loss')) return 'border-l-red-400 bg-red-900/20';
        return 'border-l-emerald-600 bg-emerald-900/10';
    };

    const getResultIcon = () => {
        if (yourOutcome?.toLowerCase().includes('win')) {
            return (
                <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            );
        }
        if (yourOutcome?.toLowerCase().includes('draw')) {
            return (
                <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4" />
                    </svg>
                </div>
            );
        }
        if (yourOutcome?.toLowerCase().includes('loss')) {
            return (
                <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
            );
        }
        return (
            <div className="w-8 h-8 bg-emerald-600/20 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
        );
    };

    const getResultText = () => {
        if (yourOutcome?.toLowerCase().includes('win')) return 'Victory';
        if (yourOutcome?.toLowerCase().includes('draw')) return 'Draw';
        if (yourOutcome?.toLowerCase().includes('loss')) return 'Defeat';
        return yourOutcome || 'Unknown';
    };

    const getResultColor = () => {
        if (yourOutcome?.toLowerCase().includes('win')) return 'text-emerald-300';
        if (yourOutcome?.toLowerCase().includes('draw')) return 'text-amber-300';
        if (yourOutcome?.toLowerCase().includes('loss')) return 'text-red-300';
        return 'text-emerald-400';
    };

    const formatDate = (instant: any) => {
        if (!instant) return 'Unknown';

        const date = new Date(instant);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    return (
        <div className={`bg-emerald-950/60 border-l-4 ${getResultStyling()} p-4 rounded-r-lg hover:bg-emerald-950/80 transition-all duration-200 cursor-pointer group`}>
            <div className="flex items-center justify-between">
                {/* Left side - Result and basic info */}
                <div className="flex items-center gap-3">
                    {getResultIcon()}

                    <div>
                        <div className="flex items-center gap-2">
              <span className={`font-medium text-sm ${getResultColor()}`}>
                {getResultText()}
              </span>
                            <span className="text-xs bg-emerald-800/50 text-emerald-300 px-2 py-0.5 rounded-full">
                {gameMode || 'Unknown'}
              </span>
                        </div>

                        <div className="text-xs text-emerald-400/70 mt-0.5">
                            {formatDate(endTime)}
                        </div>
                    </div>
                </div>

                {/* Right side - Match ID */}
                <div className="text-right">
                    <div className="text-xs font-mono text-emerald-400/60">
                        #{matchId?.slice(-6) || 'N/A'}
                    </div>
                </div>
            </div>
        </div>
    );
};