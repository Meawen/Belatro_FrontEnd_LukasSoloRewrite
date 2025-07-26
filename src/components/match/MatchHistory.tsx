import React, { useState } from 'react';
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

    const handleViewModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setViewMode(e.target.value as ViewMode);
        setCurrentPage(0); // Reset to first page
    };

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
    };

    if (isLoading && !data) {
        return <Loading size="large" text="Loading match history..." />;
    }

    if (error) {
        return (
            <div className="card bg-red-900/20 border-red-500/30">
                <div className="flex items-center gap-3">
                    <div className="text-red-400 text-2xl">⚠️</div>
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
                    >
                        🔄 Refresh
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

            {/* Matches List */}
            {!hasMatches ? (
                <div className="card text-center py-12">
                    <div className="text-slate-500 text-6xl mb-4">🎮</div>
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
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={() => handlePageChange(Math.max(0, currentPage - 1))}
                                variant="outline"
                                size="small"
                                disabled={currentPage === 0}
                            >
                                Previous
                            </Button>
                            <Button
                                onClick={() => handlePageChange(currentPage + 1)}
                                variant="outline"
                                size="small"
                                disabled={!data || data.length < itemsPerPage}
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