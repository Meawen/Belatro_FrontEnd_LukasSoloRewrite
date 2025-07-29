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
        <div className="card border-slate-500/30 bg-slate-900/10">
          <div className="text-center py-8 text-slate-400">
            Match data is not available
          </div>
        </div>
    );
  }

  // Get result styling based on outcome
  const getResultStyling = () => {
    if (yourResult?.toLowerCase().includes('win')) return 'border-green-500/30 bg-green-900/10';
    if (yourResult?.toLowerCase().includes('draw')) return 'border-yellow-500/30 bg-yellow-900/10';
    if (yourResult?.toLowerCase().includes('loss')) return 'border-red-500/30 bg-red-900/10';
    return 'border-slate-500/30 bg-slate-900/10';
  };

  const getResultIcon = () => {
    if (yourResult?.toLowerCase().includes('win')) {
      return (
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
      );
    }
    if (yourResult?.toLowerCase().includes('draw')) {
      return (
          <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
      );
    }
    if (yourResult?.toLowerCase().includes('loss')) {
      return (
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
      );
    }
    return (
        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
  };

  const getResultText = () => {
    if (yourResult?.toLowerCase().includes('win')) return 'Victory';
    if (yourResult?.toLowerCase().includes('draw')) return 'Draw';
    if (yourResult?.toLowerCase().includes('loss')) return 'Defeat';
    return yourResult || 'Unknown';
  };

  const getResultColor = () => {
    if (yourResult?.toLowerCase().includes('win')) return 'text-green-400';
    if (yourResult?.toLowerCase().includes('draw')) return 'text-yellow-400';
    if (yourResult?.toLowerCase().includes('loss')) return 'text-red-400';
    return 'text-slate-400';
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

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const totalPlayers = (match.teamA?.length || 0) + (match.teamB?.length || 0);
  const duration = formatDuration(match.startTime || undefined, match.endTime || undefined);

  const ClockIcon = () => (
      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
  );

  const TimerIcon = () => (
      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
  );

  const UsersIcon = () => (
      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
  );

  return (
      <>
        <div className={`card border hover:border-purple-500/50 transition-all duration-200 ${getResultStyling()}`}>
          <div className="flex items-center justify-between">
            {/* Match Info */}
            <div className="flex items-center gap-4 flex-1">
              {/* Result Icon */}
              <div>{getResultIcon()}</div>

              {/* Match Details */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className={`text-lg font-semibold ${getResultColor()}`}>
                    {getResultText()}
                  </h3>
                  <span className="badge badge-purple text-xs">
                    {match.gameMode || 'Unknown'}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span className="flex items-center">
                    <ClockIcon />
                    {formatDate(match.endTime)}
                  </span>
                  <span className="flex items-center">
                    <TimerIcon />
                    {duration}
                  </span>
                  <span className="flex items-center">
                    <UsersIcon />
                    {totalPlayers} players
                  </span>
                </div>

                {/* Teams Preview */}
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">Team A:</span>
                    <div className="flex -space-x-1">
                      {match.teamA?.slice(0, 3).map((player: UserSimpleDTO, index: number) => (
                          <div
                              key={player.id}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-slate-800 ${
                                  player.id === currentUserId ? 'bg-purple-500' : 'bg-blue-500'
                              }`}
                              title={player.username}
                          >
                            {player.username?.charAt(0).toUpperCase() || '?'}
                          </div>
                      ))}
                      {(match.teamA?.length || 0) > 3 && (
                          <div className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center text-xs text-white border-2 border-slate-800">
                            +{(match.teamA?.length || 0) - 3}
                          </div>
                      )}
                    </div>
                  </div>

                  <span className="text-slate-500">vs</span>

                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">Team B:</span>
                    <div className="flex -space-x-1">
                      {match.teamB?.slice(0, 3).map((player: UserSimpleDTO, index: number) => (
                          <div
                              key={player.id}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-slate-800 ${
                                  player.id === currentUserId ? 'bg-purple-500' : 'bg-red-500'
                              }`}
                              title={player.username}
                          >
                            {player.username?.charAt(0).toUpperCase() || '?'}
                          </div>
                      ))}
                      {(match.teamB?.length || 0) > 3 && (
                          <div className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center text-xs text-white border-2 border-slate-800">
                            +{(match.teamB?.length || 0) - 3}
                          </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <div className="text-right text-xs text-slate-500">
                <div>Match ID</div>
                <div className="font-mono text-slate-300">
                  {match.id?.slice(-8) || 'Unknown'}
                </div>
              </div>

              <Button
                  onClick={() => setShowDetails(true)}
                  variant="outline"
                  size="small"
              >
                View Details
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