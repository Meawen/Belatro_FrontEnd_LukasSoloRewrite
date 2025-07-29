import React from 'react';
import type { PlayerMatchSummaryDTO } from '../../types/user';

interface MatchSummaryCardProps {
  summaryItem: PlayerMatchSummaryDTO;
  currentUserId?: string | null;
}

export const MatchSummaryCard: React.FC<MatchSummaryCardProps> = ({ summaryItem }) => {
  const { matchId, endTime, result, yourOutcome, gameMode } = summaryItem;

  // Get result styling
  const getResultStyling = () => {
    if (yourOutcome?.toLowerCase().includes('win')) return 'border-green-500/30 bg-green-900/10';
    if (yourOutcome?.toLowerCase().includes('draw')) return 'border-yellow-500/30 bg-yellow-900/10';
    if (yourOutcome?.toLowerCase().includes('loss')) return 'border-red-500/30 bg-red-900/10';
    return 'border-slate-500/30 bg-slate-900/10';
  };

  const getResultIcon = () => {
    if (yourOutcome?.toLowerCase().includes('win')) {
      return (
          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
      );
    }
    if (yourOutcome?.toLowerCase().includes('draw')) {
      return (
          <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
      );
    }
    if (yourOutcome?.toLowerCase().includes('loss')) {
      return (
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
      );
    }
    return (
        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
  };

  const getResultText = () => {
    if (yourOutcome?.toLowerCase().includes('win')) return 'Victory';
    if (yourOutcome?.toLowerCase().includes('draw')) return 'Draw';
    if (yourOutcome?.toLowerCase().includes('loss')) return 'Defeat';
    return yourOutcome || 'Unknown';
  };

  const getResultColor = () => {
    if (yourOutcome?.toLowerCase().includes('win')) return 'text-green-400';
    if (yourOutcome?.toLowerCase().includes('draw')) return 'text-yellow-400';
    if (yourOutcome?.toLowerCase().includes('loss')) return 'text-red-400';
    return 'text-slate-400';
  };

  const formatDate = (instant: any) => {
    if (!instant) return 'Unknown time';

    const date = new Date(instant);
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

  const ClockIcon = () => (
      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
  );

  const TargetIcon = () => (
      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
  );

  return (
      <div className={`card border ${getResultStyling()}`}>
        <div className="flex items-center justify-between">
          {/* Match Info */}
          <div className="flex items-center gap-4">
            {/* Result Icon */}
            <div className="text-2xl">{getResultIcon()}</div>

            {/* Match Details */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className={`text-base font-semibold ${getResultColor()}`}>
                  {getResultText()}
                </h3>
                <span className="badge badge-purple text-xs">
                  {gameMode || 'Unknown'}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center">
                  <ClockIcon />
                  {formatDate(endTime)}
                </span>
                <span className="flex items-center">
                  <TargetIcon />
                  {result || 'No result'}
                </span>
              </div>
            </div>
          </div>

          {/* Match ID */}
          <div className="text-right">
            <div className="text-xs text-slate-500">Match ID</div>
            <div className="text-xs text-slate-300 font-mono">
              {matchId?.slice(-8) || 'Unknown'}
            </div>
          </div>
        </div>
      </div>
  );
};