
import React from 'react';
import { Modal, Button } from '../common';
import type { PlayerMatchHistoryDTO } from '../../types/user';
import type { UserSimpleDTO, HandDTO, TrumpCallDTO, MoveDTO } from '../../types';

interface MatchDetailsProps {
  historyItem: PlayerMatchHistoryDTO;
  currentUserId?: string | null;
  onClose: () => void;
}

export const MatchDetails: React.FC<MatchDetailsProps> = ({ historyItem, currentUserId, onClose }) => {
  const { history, yourResult } = historyItem;
  const match = history?.match;
  const moves = history?.moves;
  const structuredMoves = history?.structuredMoves;

  if (!match) {
    return (
        <Modal isOpen={true} onClose={onClose} title="Match Details">
          <div className="text-center py-8 text-slate-400">
            Match data is not available
          </div>
        </Modal>
    );
  }

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime || !endTime) return 'Unknown';

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationMs = end - start;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const duration = formatDuration(match.startTime || undefined, match.endTime || undefined);
  const totalPlayers = (match.teamA?.length || 0) + (match.teamB?.length || 0);

  return (
      <Modal
          isOpen={true}
          onClose={onClose}
          title={`Match Details - ${match.gameMode || 'Unknown'}`}
          size="large"
      >
        <div className="space-y-6">
          {/* Match Summary */}
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-slate-400 mb-1">Your Result</div>
                <div className="text-white font-medium">{yourResult || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">Game Mode</div>
                <div className="text-white font-medium">{match.gameMode || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">Duration</div>
                <div className="text-white font-medium">{duration}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">Players</div>
                <div className="text-white font-medium">{totalPlayers}</div>
              </div>
            </div>
          </div>

          {/* Match Timeline */}
          {(match.startTime || match.endTime) && (
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <h3 className="text-white font-semibold mb-3">Timeline</h3>
                <div className="space-y-2 text-sm">
                  {match.startTime && (
                      <div className="flex items-center gap-3">
                        <span className="text-green-400">🟢</span>
                        <span className="text-slate-400">Started:</span>
                        <span className="text-white">{new Date(match.startTime).toLocaleString()}</span>
                      </div>
                  )}
                  {match.endTime && (
                      <div className="flex items-center gap-3">
                        <span className="text-red-400">🔴</span>
                        <span className="text-slate-400">Ended:</span>
                        <span className="text-white">{new Date(match.endTime).toLocaleString()}</span>
                      </div>
                  )}
                  {match.result && (
                      <div className="flex items-center gap-3">
                        <span className="text-blue-400">🏁</span>
                        <span className="text-slate-400">Result:</span>
                        <span className="text-white">{match.result}</span>
                      </div>
                  )}
                </div>
              </div>
          )}

          {/* Teams */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Team A */}
            <div className="bg-slate-800/50 p-4 rounded-lg">
              <h3 className="text-white font-semibold mb-3">Team A ({match.teamA?.length || 0})</h3>
              <div className="space-y-2">
                {match.teamA?.map((player: UserSimpleDTO) => (
                    <div
                        key={player.id}
                        className={`flex items-center gap-3 p-2 rounded ${
                            player.id === currentUserId ? 'bg-purple-900/30' : ''
                        }`}
                    >
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                        {player.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <span className="text-white">
                    {player.username}
                        {player.id === currentUserId && ' (You)'}
                  </span>
                    </div>
                ))}
              </div>
            </div>

            {/* Team B */}
            <div className="bg-slate-800/50 p-4 rounded-lg">
              <h3 className="text-white font-semibold mb-3">Team B ({match.teamB?.length || 0})</h3>
              <div className="space-y-2">
                {match.teamB?.map((player: UserSimpleDTO) => (
                    <div
                        key={player.id}
                        className={`flex items-center gap-3 p-2 rounded ${
                            player.id === currentUserId ? 'bg-purple-900/30' : ''
                        }`}
                    >
                      <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                        {player.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <span className="text-white">
                    {player.username}
                        {player.id === currentUserId && ' (You)'}
                  </span>
                    </div>
                ))}
              </div>
            </div>
          </div>

          {/* Game Moves (if available) */}
          {structuredMoves && structuredMoves.length > 0 && (
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <h3 className="text-white font-semibold mb-3">Game Hands ({structuredMoves.length})</h3>
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {structuredMoves.map((hand: HandDTO, index: number) => (
                      <div key={index} className="border border-slate-700 rounded p-3">
                        <div className="text-sm font-medium text-white mb-2">
                          Hand {hand.handNo || index + 1}
                        </div>

                        {/* Trump Calls */}
                        {hand.trumpCalls && hand.trumpCalls.length > 0 && (
                            <div className="mb-2">
                              <div className="text-xs text-slate-400 mb-1">Trump Calls:</div>
                              <div className="text-xs text-slate-300">
                                {hand.trumpCalls.map((call: TrumpCallDTO, i: number) => (
                                    <span key={i} className="mr-2">
                            {call.player}: {call.trump}
                          </span>
                                ))}
                              </div>
                            </div>
                        )}

                        {/* Tricks */}
                        {hand.tricks && hand.tricks.length > 0 && (
                            <div className="text-xs text-slate-400">
                              {hand.tricks.length} tricks played
                            </div>
                        )}
                      </div>
                  ))}
                </div>
              </div>
          )}

          {/* Raw Moves (if available and no structured moves) */}
          {moves && moves.length > 0 && (!structuredMoves || structuredMoves.length === 0) && (
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <h3 className="text-white font-semibold mb-3">Moves ({moves.length})</h3>
                <div className="max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-slate-400 font-medium">Order</div>
                    <div className="text-slate-400 font-medium">Player</div>
                    <div className="text-slate-400 font-medium">Card</div>
                    {moves.map((move: MoveDTO, index: number) => (
                        <React.Fragment key={index}>
                          <div className="text-slate-300">{move.order}</div>
                          <div className="text-white">{move.player}</div>
                          <div className="text-blue-400">{move.card}</div>
                        </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
          )}

          {/* Close Button */}
          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </Modal>
  );
};