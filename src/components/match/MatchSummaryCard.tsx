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
    if (yourOutcome?.toLowerCase().includes('win')) return '🏆';
    if (yourOutcome?.toLowerCase().includes('draw')) return '🤝';
    if (yourOutcome?.toLowerCase().includes('loss')) return '💀';
    return '❓';
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

    // Handle Instant object - you might need to adjust this based on actual structure
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
                <span>🕒 {formatDate(endTime)}</span>
                <span>🎯 {result || 'No result'}</span>
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