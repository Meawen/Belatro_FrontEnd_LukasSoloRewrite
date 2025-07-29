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
        { value: 'summary', label: 'Summary View' },
        { value: 'detailed', label: 'Detailed View' }
    ];

    const handleViewModeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setViewMode(e.target.value as ViewMode);
        setCurrentPage(0); // Reset to first page
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

    // Icon components to replace emojis
    const RefreshIcon = () => (
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    );

    const GamepadIcon = () => (
        <svg className="w-16 h-16 text-slate-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 100-4H7a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
        </svg>
    );

    const WarningIcon = () => (
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
    );

    if (isLoading && !data) {
        return <Loading size="large" text="Loading match history..." />;
    }

    if (error) {
        return (
            <div className="card bg-red-900/20 border-red-500/30">
                <div className="flex items-center gap-3">
                    <WarningIcon />
                    <div>
                        <h3 className="text-red-400 font-semibold">Error Loading Match History</h3>
                        <p className="text-red-300 text-sm">Failed to load your matches</p>
                    </div>
                </div>
                <Button
                    onClick={refetch}
                    variant="outline"
                    size="small"
                    className="mt-4"
                >
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Match History</h1>
                        <p className="text-slate-400">
                            {data?.length || 0} {viewMode === 'detailed' ? 'detailed matches' : 'match summaries'} found
                        </p>
                    </div>
                    <Button
                        onClick={refetch}
                        variant="outline"
                        size="small"
                        isLoading={isLoading}
                        disabled={isLoading}
                    >
                        <RefreshIcon />
                        {isLoading ? 'Refreshing...' : 'Refresh'}
                    </Button>
                </div>

                {/* View Mode Selector */}
                <div className="flex items-center gap-4">
                    <label className="text-sm text-slate-400">View:</label>
                    <Select
                        options={viewModeOptions}
                        value={viewMode}
                        onChange={handleViewModeChange}
                    />
                </div>
            </div>

            {/* Loading indicator for page changes */}
            {isLoading && data && (
                <div className="text-center py-2">
                    <span className="text-slate-400 text-sm flex items-center justify-center gap-2">
                        <RefreshIcon />
                        Loading matches...
                    </span>
                </div>
            )}

            {/* Matches List */}
            {!hasMatches ? (
                <div className="card text-center py-12">
                    <GamepadIcon />
                    <h3 className="text-xl font-semibold text-white mb-2">No Match History</h3>
                    <p className="text-slate-400">
                        Start playing to see your match history here!
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
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

            {/* Pagination */}
            {hasMatches && (
                <div className="card">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-400">
                            Page {currentPage + 1}
                            {data && data.length === itemsPerPage && (
                                <span className="ml-2">({itemsPerPage} per page)</span>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={handlePreviousPage}
                                variant="outline"
                                size="small"
                                disabled={currentPage === 0 || isLoading}
                            >
                                Previous
                            </Button>
                            <Button
                                onClick={handleNextPage}
                                variant="outline"
                                size="small"
                                disabled={!data || data.length < itemsPerPage || isLoading}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};