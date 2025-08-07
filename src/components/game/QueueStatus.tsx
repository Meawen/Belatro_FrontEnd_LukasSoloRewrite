import React from 'react';
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked';
import { Loading } from '../common/Loading';

export const QueueStatus: React.FC = () => {
    const {
        isInQueue,
        queueStatus,
        isJoining,
        isWebSocketConnected,
        webSocketError
    } = useEnhancedRanked();

    // Show joining state (when HTTP request is in progress)
    if (isJoining) {
        return (
            <div className="backdrop-blur-sm bg-gradient-to-r from-emerald-900/40 to-teal-900/40 rounded-xl border border-emerald-600/30 p-6">
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                        <Loading size="small" />
                        <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping"></div>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-emerald-100">Joining Queue</h3>
                        <p className="text-emerald-300 text-sm">Connecting to matchmaking system...</p>
                    </div>
                </div>
                <div className="w-full bg-emerald-900/30 rounded-full h-2">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full animate-pulse"></div>
                </div>
            </div>
        );
    }

    // Show queue status if we have WebSocket data
    if (queueStatus && queueStatus.state === 'IN_QUEUE') {
        const formatWaitTime = (seconds?: number) => {
            if (!seconds || seconds < 0) return 'Calculating...';
            if (seconds < 60) return `${seconds}s`;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
        };

        return (
            <div className="backdrop-blur-sm bg-gradient-to-br from-emerald-900/40 via-teal-900/40 to-emerald-800/40 rounded-xl border border-emerald-500/30 p-6 shadow-xl">
                {/* Header with animated icon */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-6 h-6 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-bounce"></div>
                        <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping"></div>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-emerald-100">Searching for Match</h3>
                        <p className="text-emerald-300 text-sm">Finding players with similar skill levels...</p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {queueStatus.queueSize !== undefined && (
                        <div className="bg-emerald-800/20 rounded-lg p-4 border border-emerald-600/20">
                            <div className="text-2xl font-bold text-emerald-400 mb-1">
                                {queueStatus.queueSize}
                            </div>
                            <div className="text-emerald-200 text-sm">Players in queue</div>
                        </div>
                    )}

                    {queueStatus.estWaitSeconds !== undefined && (
                        <div className="bg-teal-800/20 rounded-lg p-4 border border-teal-600/20">
                            <div className="text-2xl font-bold text-teal-400 mb-1">
                                {formatWaitTime(queueStatus.estWaitSeconds)}
                            </div>
                            <div className="text-teal-200 text-sm">Estimated wait</div>
                        </div>
                    )}

                    {queueStatus.mmr !== undefined && (
                        <div className="bg-blue-800/20 rounded-lg p-4 border border-blue-600/20">
                            <div className="text-2xl font-bold text-blue-400 mb-1">
                                {queueStatus.mmr}
                            </div>
                            <div className="text-blue-200 text-sm">Your MMR</div>
                        </div>
                    )}
                </div>

                {/* Animated Progress Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-emerald-200">
                        <span>Matchmaking Progress</span>
                        <span>Searching...</span>
                    </div>
                    <div className="w-full bg-emerald-900/30 rounded-full h-3 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 animate-pulse rounded-full relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite] skew-x-12"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show match found state
    if (queueStatus && queueStatus.state === 'MATCH_FOUND') {
        return (
            <div className="backdrop-blur-sm bg-gradient-to-r from-amber-900/40 to-orange-900/40 rounded-xl border border-amber-500/30 p-6 shadow-xl">
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div className="absolute inset-0 rounded-full bg-amber-400/30 animate-ping"></div>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-amber-100">Match Found!</h3>
                        <p className="text-amber-300 text-sm">Preparing your game...</p>
                    </div>
                </div>
                <div className="w-full bg-amber-900/30 rounded-full h-2">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full w-full animate-pulse"></div>
                </div>
            </div>
        );
    }

    // Show cancelled state
    if (queueStatus && queueStatus.state === 'CANCELLED') {
        return (
            <div className="backdrop-blur-sm bg-gradient-to-r from-red-900/40 to-pink-900/40 rounded-xl border border-red-500/30 p-6 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-red-100">Queue Cancelled</h3>
                        <p className="text-red-300 text-sm">Your search was cancelled</p>
                    </div>
                </div>
            </div>
        );
    }

    // Default case - not in queue or no connection
    if (!isWebSocketConnected) {
        return (
            <div className="backdrop-blur-sm bg-slate-800/30 rounded-xl border border-slate-600/30 p-6 text-center">
                <div className="text-slate-400 mb-2">
                    <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                </div>
                <p className="text-slate-400 text-sm">Establishing connection...</p>
            </div>
        );
    }

    return (
        <div className="backdrop-blur-sm bg-slate-800/30 rounded-xl border border-slate-600/30 p-6 text-center">
            <div className="text-slate-400 mb-2">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <p className="text-slate-400 text-sm">Ready to queue when you are!</p>
        </div>
    );
};