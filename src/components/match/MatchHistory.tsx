import React, { useState, useCallback } from 'react';
import { Button, Loading, Select } from '../common';
import { useMatchHistory, useMatchSummary } from '../../hooks/useMatchHistory';
import { useAuth } from '../../hooks/useAuth';
import { MatchCard } from './MatchCard';
import { MatchSummaryCard } from './MatchSummaryCard';
import type { PlayerMatchHistoryDTO, PlayerMatchSummaryDTO } from '../../types/user';

type ViewMode = 'detailed' | 'summary';

export const MatchHistory: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('summary');
    const [currentPage, setCurrentPage] = useState(0);
    const itemsPerPage = 10;

    const { user } = useAuth();

    const {
        matchHistory,
        isLoading: isHistoryLoading,
        error: historyError,
        refetch: refetchHistory
    } = useMatchHistory(user?.id, currentPage, itemsPerPage);

    const {
        matchSummary,
        isLoading: isSummaryLoading,
        error: summaryError,
        refetch: refetchSummary
    } = useMatchSummary(user?.id, currentPage, itemsPerPage);

    const isLoading = viewMode === 'detailed' ? isHistoryLoading : isSummaryLoading;
    const error = viewMode === 'detailed' ? historyError : summaryError;
    const refetch = viewMode === 'detailed' ? refetchHistory : refetchSummary;

    const data = viewMode === 'detailed' ? matchHistory : matchSummary;
    const hasMatches = data && data.length > 0;

    const viewModeOptions = [
        { value: 'summary', label: 'Quick View' },
        { value: 'detailed', label: 'Detailed View' }
    ];

    const handleViewModeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setViewMode(e.target.value as ViewMode);
        setCurrentPage(0);
    }, []);

    const handlePageChange = useCallback((newPage: number) => {
        setCurrentPage(newPage);
    }, []);

    const handlePreviousPage = useCallback(() => {
        handlePageChange(Math.max(0, currentPage - 1));
    }, [currentPage, handlePageChange]);

    const handleNextPage = useCallback(() => {
        handlePageChange(currentPage + 1);
    }, [currentPage, handlePageChange]);

    if (isLoading && !data) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <Loading size="large" text="Loading your match history..." />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-gradient-to-r from-red-900/40 to-red-800/20 border-l-4 border-red-500 p-6 rounded-r-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-red-300 font-semibold text-lg">Unable to Load Match History</h3>
                            <p className="text-red-400/80 text-sm mt-1">Something went wrong while fetching your matches</p>
                        </div>
                    </div>
                    <Button
                        onClick={refetch}
                        variant="outline"
                        size="small"
                        className="mt-4 border-red-400 text-red-300 hover:bg-red-500/10"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-950 to-emerald-900">
            <div className="max-w-6xl mx-auto p-6 space-y-8">
                {/* Header Section */}
                <div className="relative overflow-hidden bg-gradient-to-r from-emerald-900/60 to-emerald-800/40 backdrop-blur-sm border border-emerald-700/50 p-8 rounded-2xl shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-transparent"></div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-emerald-600/30 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                    <svg className="w-8 h-8 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-emerald-100">Match History</h1>
                                    <p className="text-emerald-300/80 text-lg">
                                        {data?.length || 0} {viewMode === 'detailed' ? 'detailed matches' : 'match summaries'} found
                                    </p>
                                </div>
                            </div>

                            <Button
                                onClick={refetch}
                                variant="outline"
                                size="small"
                                isLoading={isLoading}
                                disabled={isLoading}
                                className="bg-emerald-800/30 border-emerald-600 hover:bg-emerald-700/40 text-emerald-300"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {isLoading ? 'Refreshing...' : 'Refresh'}
                            </Button>
                        </div>

                        {/* View Mode Selector */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <label className="text-emerald-300 font-medium">View Mode:</label>
                            </div>
                            <Select
                                options={viewModeOptions}
                                value={viewMode}
                                onChange={handleViewModeChange}
                                className="bg-emerald-900/50 border-emerald-600 text-emerald-200"
                            />
                        </div>
                    </div>
                </div>

                {/* Loading indicator for page changes */}
                {isLoading && data && (
                    <div className="text-center py-4">
                        <div className="inline-flex items-center gap-3 bg-emerald-900/50 px-4 py-2 rounded-full backdrop-blur-sm">
                            <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-emerald-300">Loading matches...</span>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                {!hasMatches ? (
                    <div className="text-center py-20">
                        <div className="max-w-md mx-auto">
                            <div className="w-32 h-32 bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-16 h-16 text-emerald-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 100-4H7a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-emerald-200 mb-3">No Match History Yet</h3>
                            <p className="text-emerald-400/80 text-lg">
                                Your epic gaming journey starts here! Play some matches to see your history.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className={viewMode === 'summary' ? 'space-y-2' : 'space-y-6'}>
                        {viewMode === 'detailed'
                            ? matchHistory?.map((historyItem: PlayerMatchHistoryDTO, index: number) => (
                                <MatchCard
                                    key={historyItem.history?.match?.id || index}
                                    historyItem={historyItem}
                                    currentUserId={user?.id}
                                />
                            ))
                            : matchSummary?.map((summaryItem: PlayerMatchSummaryDTO, index: number) => (
                                <MatchSummaryCard
                                    key={summaryItem.matchId || index}
                                    summaryItem={summaryItem}
                                    currentUserId={user?.id}
                                />
                            ))
                        }
                    </div>
                )}

                {/* Enhanced Pagination */}
                {hasMatches && (
                    <div className="bg-emerald-900/30 backdrop-blur-sm border border-emerald-700/50 p-6 rounded-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="text-emerald-300">
                                    <span className="font-semibold text-lg">Page {currentPage + 1}</span>
                                    {data && data.length === itemsPerPage && (
                                        <span className="text-emerald-400/70 ml-2">
                                            • {itemsPerPage} matches per page
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={handlePreviousPage}
                                    variant="outline"
                                    size="small"
                                    disabled={currentPage === 0 || isLoading}
                                    className="bg-emerald-800/30 border-emerald-600 hover:bg-emerald-700/40 text-emerald-300 disabled:opacity-50 disabled:border-emerald-800"
                                >
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Previous
                                </Button>

                                <Button
                                    onClick={handleNextPage}
                                    variant="outline"
                                    size="small"
                                    disabled={!data || data.length < itemsPerPage || isLoading}
                                    className="bg-emerald-800/30 border-emerald-600 hover:bg-emerald-700/40 text-emerald-300 disabled:opacity-50 disabled:border-emerald-800"
                                >
                                    Next
                                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};