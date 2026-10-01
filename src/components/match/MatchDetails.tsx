import React, { useState } from 'react';
import { Modal, Button } from '../common';
import { PlayingCard } from '../common/PlayingCard';
import type { PlayerMatchHistoryDTO } from '../../types/user';
import type { UserSimpleDTO, HandDTO, TrumpCallDTO, MoveDTO, TrickDTO } from '../../types';

interface MatchDetailsProps {
    historyItem: PlayerMatchHistoryDTO;
    currentUserId?: string;
    onClose: () => void;
}

export const MatchDetails: React.FC<MatchDetailsProps> = ({ historyItem, currentUserId, onClose }) => {
    const { history, yourResult } = historyItem;
    const match = history?.match;
    const moves = history?.moves;
    const structuredMoves = history?.structuredMoves;

    const [expandedHands, setExpandedHands] = useState<Set<number>>(new Set());

    if (!match) {
        return (
            <Modal isOpen={true} onClose={onClose} title="Match Details">
                <div className="text-center py-12">
                    <svg className="w-16 h-16 text-emerald-400/50 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-emerald-400/70">Match data is not available</p>
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

    // Enhanced result styling
    const getResultStyling = () => {
        if (yourResult?.toLowerCase().includes('win')) return 'bg-gradient-to-r from-emerald-600 to-green-600';
        if (yourResult?.toLowerCase().includes('draw')) return 'bg-gradient-to-r from-amber-600 to-yellow-600';
        if (yourResult?.toLowerCase().includes('loss')) return 'bg-gradient-to-r from-red-600 to-rose-600';
        return 'bg-gradient-to-r from-emerald-600 to-teal-600';
    };

    const getResultIcon = () => {
        const iconClass = "w-8 h-8 text-white";

        if (yourResult?.toLowerCase().includes('win')) {
            return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>;
        }
        if (yourResult?.toLowerCase().includes('draw')) {
            return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>;
        }
        if (yourResult?.toLowerCase().includes('loss')) {
            return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>;
        }
        return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>;
    };

    // Helper functions for card display
    const parseCardName = (cardString: string) => {
        // Parse "DECKO of PIK" format
        const parts = cardString.split(' of ');
        if (parts.length === 2) {
            return { rank: parts[0].trim(), suit: parts[1].trim() };
        }

        // Fallback for other formats
        return { rank: cardString, suit: '' };
    };

    const toggleHandExpansion = (handIndex: number) => {
        const newExpanded = new Set(expandedHands);
        if (newExpanded.has(handIndex)) {
            newExpanded.delete(handIndex);
        } else {
            newExpanded.add(handIndex);
        }
        setExpandedHands(newExpanded);
    };

    const getPlayerColor = (playerName: string | null | undefined) => {
        if (!playerName) return 'bg-gray-500/20 border border-gray-400/30 text-gray-200';

        // Check if player is current user
        const currentUser = match.teamA?.find(p => p.id === currentUserId) || match.teamB?.find(p => p.id === currentUserId);
        if (currentUser && currentUser.username === playerName) {
            return 'bg-gradient-to-r from-purple-500/20 to-emerald-500/20 border border-purple-400/30 text-purple-200';
        }

        // Check team membership for color coding
        const isTeamA = match.teamA?.some(p => p.username === playerName);
        if (isTeamA) {
            return 'bg-blue-500/20 border border-blue-400/30 text-blue-200';
        }
        return 'bg-red-500/20 border border-red-400/30 text-red-200';
    };

    // Helper function to count illegal moves in a hand
    const countIllegalMovesInHand = (hand: HandDTO) => {
        if (!hand.tricks) return 0;
        return hand.tricks.reduce((count, trick) => {
            if (!trick.moves) return count;
            return count + trick.moves.filter(move => move.legal === false).length;
        }, 0);
    };

    // Helper function to get the final cumulative scores from the last hand with scores
    const getFinalScores = (hands: HandDTO[]) => {
        // Find the last hand that has a handSummary with finalScore data
        for (let i = hands.length - 1; i >= 0; i--) {
            const hand = hands[i];
            if (hand.handSummary && (hand.handSummary.finalScoreA !== undefined || hand.handSummary.finalScoreB !== undefined)) {
                return {
                    teamAFinal: hand.handSummary.finalScoreA || 0,
                    teamBFinal: hand.handSummary.finalScoreB || 0
                };
            }
        }
        return { teamAFinal: 0, teamBFinal: 0 };
    };

    // Helper function to parse match result and extract scores
    const parseMatchResult = (result: string) => {
        // Parse patterns like "Team A wins 1134-0" or "Team B wins 500-200"
        const scoreMatch = result.match(/(\d+)-(\d+)/);
        if (scoreMatch) {
            const score1 = parseInt(scoreMatch[1]);
            const score2 = parseInt(scoreMatch[2]);
            
            // Determine which team won based on the result text
            const teamAWins = result.toLowerCase().includes('team a wins');
            const teamBWins = result.toLowerCase().includes('team b wins');
            
            if (teamAWins) {
                return { teamAScore: score1, teamBScore: score2 };
            } else if (teamBWins) {
                return { teamAScore: score2, teamBScore: score1 };
            } else {
                // Default to assuming first score is Team A if unclear
                return { teamAScore: score1, teamBScore: score2 };
            }
        }
        return { teamAScore: 0, teamBScore: 0 };
    };

    // Helper function to calculate total declarations across all hands
    const calculateTotalDeclarations = (hands: HandDTO[]) => {
        let teamADeclTotal = 0;
        let teamBDeclTotal = 0;

        hands.forEach(hand => {
            if (hand.handSummary) {
                teamADeclTotal += hand.handSummary.teamADeclPoints || 0;
                teamBDeclTotal += hand.handSummary.teamBDeclPoints || 0;
            }
        });

        return { teamADeclTotal, teamBDeclTotal };
    };


    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Match Details"
            size="large"
        >
            <div className="space-y-6">
                {/* Hero Section - Match Result */}
                <div className={`${getResultStyling()} p-6 rounded-xl text-white`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                {getResultIcon()}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">{yourResult || 'Unknown Result'}</h2>
                                <p className="text-white/80">Match ID: {match.id?.slice(-12) || 'Unknown'}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="bg-white/20 text-white px-2 py-1 rounded-full text-sm">
                                        {match.gameMode || 'Unknown'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold">{totalPlayers}</div>
                            <div className="text-white/80">Players</div>
                        </div>
                    </div>
                </div>

                {/* Key Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-emerald-900/30 p-4 rounded-lg border border-emerald-700/30">
                        <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-emerald-400 text-sm font-medium">Duration</span>
                        </div>
                        <div className="text-white text-lg font-semibold">{duration}</div>
                    </div>

                    <div className="bg-emerald-900/30 p-4 rounded-lg border border-emerald-700/30">
                        <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="text-emerald-400 text-sm font-medium">Mode</span>
                        </div>
                        <div className="text-white text-lg font-semibold">{match.gameMode || 'Unknown'}</div>
                    </div>

                    <div className="bg-emerald-900/30 p-4 rounded-lg border border-emerald-700/30">
                        <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="text-emerald-400 text-sm font-medium">Hands</span>
                        </div>
                        <div className="text-white text-lg font-semibold">{structuredMoves?.length || 0}</div>
                    </div>

                    <div className="bg-emerald-900/30 p-4 rounded-lg border border-emerald-700/30">
                        <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span className="text-emerald-400 text-sm font-medium">Tricks</span>
                        </div>
                        <div className="text-white text-lg font-semibold">
                            {structuredMoves?.reduce((total, hand) => total + (hand.tricks?.length || 0), 0) || 0}
                        </div>
                    </div>
                </div>

                {/* Teams Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Team A */}
                    <div className="bg-emerald-900/20 border border-emerald-700/30 p-5 rounded-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">A</span>
                            </div>
                            <div>
                                <h3 className="text-emerald-300 font-semibold text-lg">Team Alpha</h3>
                                <p className="text-emerald-400/70 text-sm">{match.teamA?.length || 0} members</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {match.teamA?.map((player: UserSimpleDTO) => (
                                <div
                                    key={player.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                        player.id === currentUserId
                                            ? 'bg-gradient-to-r from-purple-900/50 to-emerald-900/50 border border-purple-500/30'
                                            : 'bg-emerald-950/30 hover:bg-emerald-950/50'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                                        player.id === currentUserId
                                            ? 'bg-gradient-to-r from-purple-500 to-emerald-500 text-white'
                                            : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                                    }`}>
                                        {player.username?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-emerald-200 font-medium">
                                            {player.username}
                                            {player.id === currentUserId && (
                                                <span className="ml-2 bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full text-xs">
                                                    You
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Team B */}
                    <div className="bg-emerald-900/20 border border-emerald-700/30 p-5 rounded-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">B</span>
                            </div>
                            <div>
                                <h3 className="text-emerald-300 font-semibold text-lg">Team Bravo</h3>
                                <p className="text-emerald-400/70 text-sm">{match.teamB?.length || 0} members</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {match.teamB?.map((player: UserSimpleDTO) => (
                                <div
                                    key={player.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                        player.id === currentUserId
                                            ? 'bg-gradient-to-r from-purple-900/50 to-emerald-900/50 border border-purple-500/30'
                                            : 'bg-emerald-950/30 hover:bg-emerald-950/50'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                                        player.id === currentUserId
                                            ? 'bg-gradient-to-r from-purple-500 to-emerald-500 text-white'
                                            : 'bg-gradient-to-r from-red-500 to-pink-500 text-white'
                                    }`}>
                                        {player.username?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-emerald-200 font-medium">
                                            {player.username}
                                            {player.id === currentUserId && (
                                                <span className="ml-2 bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full text-xs">
                                                    You
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Match Summary */}
                {match.result && structuredMoves && structuredMoves.length > 0 && (
                    <div className="bg-emerald-900/20 border border-emerald-700/30 p-5 rounded-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h3 className="text-emerald-300 font-semibold text-lg">Match Summary</h3>
                        </div>
                        {(() => {
                            const { teamAScore, teamBScore } = parseMatchResult(match.result);
                            const { teamADeclTotal, teamBDeclTotal } = calculateTotalDeclarations(structuredMoves);
                            
                            return (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Final Scores */}
                                    <div className="text-center">
                                        <div className="text-blue-300 font-bold text-2xl">{teamAScore}</div>
                                        <div className="text-blue-300/70 text-sm">Team A Final</div>
                                        {teamADeclTotal > 0 && <div className="text-blue-300/60 text-xs mt-1">{teamADeclTotal} decl</div>}
                                    </div>
                                    
                                    <div className="text-center flex items-center justify-center">
                                        <div className="text-emerald-100 font-medium">{match.result}</div>
                                    </div>
                                    
                                    <div className="text-center">
                                        <div className="text-red-300 font-bold text-2xl">{teamBScore}</div>
                                        <div className="text-red-300/70 text-sm">Team B Final</div>
                                        {teamBDeclTotal > 0 && <div className="text-red-300/60 text-xs mt-1">{teamBDeclTotal} decl</div>}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Enhanced Game Details with Structured Moves */}
                {structuredMoves && structuredMoves.length > 0 && (
                    <div className="bg-emerald-900/20 border border-emerald-700/30 p-5 rounded-xl">
                        <div className="mb-6">
                            <h3 className="text-emerald-300 font-semibold text-xl flex items-center gap-3">
                                <div className="w-8 h-8 bg-emerald-600/30 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                Game History ({structuredMoves.length} hands)
                            </h3>
                        </div>

                        <div className="space-y-4">
                            {structuredMoves.map((hand: HandDTO, handIndex: number) => (
                                <div key={handIndex} className="bg-emerald-950/50 border border-emerald-800/50 rounded-xl overflow-hidden">
                                    {/* Hand Header */}
                                    <div
                                        className="p-4 cursor-pointer hover:bg-emerald-950/70 transition-colors"
                                        onClick={() => toggleHandExpansion(handIndex)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-emerald-600/40 rounded-lg flex items-center justify-center text-emerald-200 font-bold text-sm">
                                                    {hand.handNo || handIndex + 1}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-emerald-200 font-semibold">
                                                            Hand {hand.handNo || handIndex + 1}
                                                        </span>
                                                        {hand.handSummary?.padanje && (
                                                            <span className="bg-amber-600/30 text-amber-300 px-2 py-1 rounded-full text-xs font-bold border border-amber-500/30">
                                                                 Padanje
                                                            </span>
                                                        )}
                                                        {countIllegalMovesInHand(hand) > 0 && (
                                                            <span className="bg-red-600/30 text-red-300 px-2 py-0.5 rounded-full text-xs font-medium">
                                                                {countIllegalMovesInHand(hand)} illegal
                                                            </span>
                                                        )}
                                                    </div>
                                                    {hand.handSummary && (hand.handSummary.finalScoreA !== undefined || hand.handSummary.finalScoreB !== undefined) && (
                                                        <div className="mt-1 text-sm text-emerald-300/80 font-medium">
                                                            {hand.handSummary.finalScoreA || 0} - {hand.handSummary.finalScoreB || 0}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {/* Trump calls preview */}
                                                {hand.trumpCalls && hand.trumpCalls.length > 0 && (
                                                    <div className="flex gap-1">
                                                        {hand.trumpCalls.slice(0, 2).map((call: TrumpCallDTO, i: number) => (
                                                            <span key={i} className={`px-2 py-1 rounded text-xs font-medium ${
                                                                call.trump === 'PASS'
                                                                    ? 'bg-gray-600/30 text-gray-300'
                                                                    : 'bg-amber-600/30 text-amber-300'
                                                            }`}>
                                                                {call.trump}
                                                            </span>
                                                        ))}
                                                        {hand.trumpCalls.length > 2 && (
                                                            <span className="text-emerald-400/60 text-xs">+{hand.trumpCalls.length - 2}</span>
                                                        )}
                                                    </div>
                                                )}

                                                <svg
                                                    className={`w-5 h-5 text-emerald-400 transition-transform ${
                                                        expandedHands.has(handIndex) ? 'rotate-180' : ''
                                                    }`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Hand Details */}
                                    {expandedHands.has(handIndex) && (
                                        <div className="border-t border-emerald-800/30 p-4 space-y-5">
                                            {/* Hand Summary */}
                                            {hand.handSummary && (
                                                <div className="bg-emerald-900/30 rounded-lg p-3">
                                                    <h4 className="text-emerald-300 font-medium mb-2">Hand Summary</h4>
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <span className="text-blue-300">Team A: {hand.handSummary.teamAPoints} pts</span>
                                                            {hand.handSummary.teamADeclPoints > 0 && <span className="text-blue-300/70 ml-2">({hand.handSummary.teamADeclPoints} decl)</span>}
                                                        </div>
                                                        <div>
                                                            <span className="text-red-300">Team B: {hand.handSummary.teamBPoints} pts</span>
                                                            {hand.handSummary.teamBDeclPoints > 0 && <span className="text-red-300/70 ml-2">({hand.handSummary.teamBDeclPoints} decl)</span>}
                                                        </div>
                                                        <div className="text-emerald-400/70">Tricks: {hand.tricks?.length || 0}</div>
                                                        <div className="text-emerald-400/70">Trump Calls: {hand.trumpCalls?.length || 0}</div>
                                                    </div>
                                                    {(hand.handSummary.capot || hand.handSummary.padanje) && (
                                                        <div className="flex gap-2 mt-2">
                                                            {hand.handSummary.capot && (
                                                                <span className="bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded-full text-xs font-medium">
                                                                    Capot
                                                                </span>
                                                            )}
                                                            {hand.handSummary.padanje && (
                                                                <span className="bg-amber-600/30 text-amber-300 px-2 py-0.5 rounded-full text-xs font-medium">
                                                                    Hand Awarded (Padanje)
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Trump Calls */}
                                            {hand.trumpCalls && hand.trumpCalls.length > 0 && (
                                                <div>
                                                    <h4 className="text-emerald-300 font-medium mb-3 flex items-center gap-2">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h4a1 1 0 011 1v2h4a1 1 0 011 1v4a1 1 0 01-1 1h-1l-1 10a1 1 0 01-1 1H8a1 1 0 01-1-1L6 10H5a1 1 0 01-1-1V6a1 1 0 011-1h2z" />
                                                        </svg>
                                                        Trump Declarations
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {hand.trumpCalls.map((call: TrumpCallDTO, i: number) => (
                                                            <div key={i} className={`p-3 rounded-lg border ${getPlayerColor(call.player)}`}>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-medium">{call.player || 'Unknown'}</span>
                                                                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                                                                        call.trump === 'PASS'
                                                                            ? 'bg-gray-600/50 text-gray-200'
                                                                            : 'bg-amber-600/50 text-amber-200'
                                                                    }`}>
                                                                        {call.trump}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Challenges */}
                                            {hand.challenges && hand.challenges.length > 0 && (
                                                <div>
                                                    <h4 className="text-emerald-300 font-medium mb-3 flex items-center gap-2">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                        Challenges
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {hand.challenges.map((challenge: ChallengeDTO, i: number) => (
                                                            <div key={i} className={`p-3 rounded-lg border flex items-center justify-between ${
                                                                challenge.success 
                                                                    ? 'bg-green-900/30 border-green-700/50 text-green-200' 
                                                                    : 'bg-red-900/30 border-red-700/50 text-red-200'
                                                            }`}>
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                                        challenge.success 
                                                                            ? 'bg-green-600/50 text-green-100' 
                                                                            : 'bg-red-600/50 text-red-100'
                                                                    }`}>
                                                                        {challenge.success ? '✓' : '✗'}
                                                                    </div>
                                                                    <span className="font-medium">Challenge by {challenge.player || 'Unknown'}</span>
                                                                </div>
                                                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                                                    challenge.success 
                                                                        ? 'bg-green-600/50 text-green-200' 
                                                                        : 'bg-red-600/50 text-red-200'
                                                                }`}>
                                                                    {challenge.success ? 'Success' : 'Fail'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Tricks */}
                                            {hand.tricks && hand.tricks.length > 0 && (
                                                <div>
                                                    <h4 className="text-emerald-300 font-medium mb-4 flex items-center gap-2">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                        </svg>
                                                        Tricks Played
                                                    </h4>
                                                    <div className="space-y-4">
                                                        {hand.tricks.map((trick: TrickDTO, trickIndex: number) => (
                                                            <div key={trickIndex} className="bg-emerald-900/40 border border-emerald-800/30 rounded-lg p-4">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <div className="w-6 h-6 bg-emerald-600/50 rounded-full flex items-center justify-center text-xs font-bold text-emerald-100">
                                                                        {trick.trickNo || trickIndex + 1}
                                                                    </div>
                                                                    <span className="text-emerald-200 font-medium">
                                                                        Trick {trick.trickNo || trickIndex + 1}
                                                                    </span>
                                                                    <span className="text-emerald-400/60 text-sm">
                                                                        ({trick.moves?.length || 0} cards)
                                                                    </span>
                                                                    {trick.moves && trick.moves.length < 4 && (
                                                                        <span className="text-amber-400/60 text-xs bg-amber-600/20 px-2 py-0.5 rounded-full">
                                                                            Partial trick (hand ended)
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Cards played in this trick */}
                                                                {trick.moves && trick.moves.length > 0 && (
                                                                    <div className={`grid ${
                                                                        trick.moves.length <= 2 ? 'grid-cols-1 md:grid-cols-2' :
                                                                        trick.moves.length === 3 ? 'grid-cols-2 md:grid-cols-3' :
                                                                        'grid-cols-2 md:grid-cols-4'
                                                                    } gap-4`}>
                                                                        {trick.moves.map((move: MoveDTO, moveIndex: number) => {
                                                                            const { rank, suit } = parseCardName(move.card || '');
                                                                            const isIllegal = move.legal === false;
                                                                            const isWinner = move.player === trick.winnerId;
                                                                            
                                                                            // Get trump suit from hand's trump calls
                                                                            const handTrump = hand.trumpCalls?.find(call => call.trump !== 'PASS')?.trump;
                                                                            const isTrumpCard = handTrump && suit === handTrump;
                                                                            
                                                                            let baseColor = getPlayerColor(move.player);
                                                                            
                                                                            // Winner highlighting - golden border and background
                                                                            if (isWinner) {
                                                                                baseColor = 'bg-gradient-to-r from-yellow-900/30 to-amber-900/30 border-2 border-yellow-500/50 text-yellow-100';
                                                                            }
                                                                            
                                                                            return (
                                                                                <div 
                                                                                    key={moveIndex} 
                                                                                    className={`p-3 rounded-lg border ${baseColor} relative ${isTrumpCard ? 'ring-2 ring-amber-400/60' : ''}`}
                                                                                    title={isIllegal ? "This play violated rules; points only awarded if challenge succeeds." : ""}
                                                                                >
                                                                                    {/* Player name - fixed height */}
                                                                                    <div className="h-5 mb-2">
                                                                                        <span className="text-sm font-medium block">{move.player || 'Unknown'}</span>
                                                                                    </div>
                                                                                    
                                                                                    {/* Badges section - fixed height */}
                                                                                    <div className="h-6 mb-2 flex flex-wrap gap-1 justify-center relative z-20">
                                                                                        {isWinner && (
                                                                                            <span className="bg-yellow-600/80 text-yellow-100 px-1.5 py-0.5 rounded text-xs font-bold">
                                                                                                Winner
                                                                                            </span>
                                                                                        )}
                                                                                        {isTrumpCard && (
                                                                                            <span className="bg-amber-600/80 text-amber-100 px-1.5 py-0.5 rounded text-xs font-bold">
                                                                                                Trump
                                                                                            </span>
                                                                                        )}
                                                                                    </div>

                                                                                    {/* Card - consistent positioning */}
                                                                                    <div className="aspect-[5/7] w-16 mx-auto mb-2 relative z-10">

                                                                                        <PlayingCard
                                                                                            suit={suit}
                                                                                            rank={rank}
                                                                                            className="w-full h-full"
                                                                                        />
                                                                                    </div>
                                                                                    
                                                                                    {/* Illegal badge section - fixed height */}
                                                                                    <div className="h-6 text-center">
                                                                                        {isIllegal && (
                                                                                            <span className="bg-red-600/80 text-red-100 px-2 py-0.5 rounded text-xs font-bold">
                                                                                                Illegal
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Raw moves fallback */}
                {moves && moves.length > 0 && (!structuredMoves || structuredMoves.length === 0) && (
                    <div className="bg-emerald-900/20 border border-emerald-700/30 p-5 rounded-xl">
                        <h3 className="text-emerald-300 font-semibold text-lg mb-4">
                            Game Moves ({moves.length})
                        </h3>
                        <div className="max-h-48 overflow-y-auto">
                            <div className="grid grid-cols-3 gap-2 text-sm">
                                <div className="text-emerald-400 font-medium pb-2">Order</div>
                                <div className="text-emerald-400 font-medium pb-2">Player</div>
                                <div className="text-emerald-400 font-medium pb-2">Card</div>
                                {moves.map((move: MoveDTO, index: number) => (
                                    <React.Fragment key={index}>
                                        <div className="text-emerald-300 py-1">{move.order}</div>
                                        <div className="text-emerald-200 py-1">{move.player}</div>
                                        <div className="text-amber-400 py-1 font-mono">{move.card}</div>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-emerald-700/30">
                    <Button onClick={onClose} variant="primary">
                        Close Details
                    </Button>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(16, 185, 129, 0.1);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(16, 185, 129, 0.3);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(16, 185, 129, 0.5);
                }
            `}</style>
        </Modal>
    );
};