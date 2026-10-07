import React from 'react';
import { useLocation } from 'react-router-dom';
import { PlayButton, QueueStatus } from '../game';
import { ReconnectBanner } from './ReconnectBanner';

export const PlayPage: React.FC = () => {
    // Set by the game table when a DECLINED end sends the other three back here, still queued (R-25)
    const notice = (useLocation().state as { notice?: string } | null)?.notice;

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800">
            {/* While the queue's socket is down (R-30) */}
            <ReconnectBanner />
            {notice && (
                <div className="max-w-2xl mx-auto px-6 pt-6">
                    <div className="rounded-xl border border-amber-500/40 bg-amber-900/30 px-4 py-3 text-amber-100">
                        {notice}
                    </div>
                </div>
            )}

            {/* Hero Section */}
            <div className="pt-20 pb-12">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <div className="relative">
                        <h1 className="text-6xl md:text-7xl font-black bg-gradient-to-r from-amber-400 via-orange-400 to-red-500 bg-clip-text text-transparent mb-2">
                            RANKED
                        </h1>
                        <p className="text-lg text-amber-200 font-medium mb-6">Are you ready?</p>
                        <div className="absolute -top-2 -right-8 w-4 h-4 bg-amber-400 rounded-full animate-pulse"></div>
                        <div className="absolute -bottom-2 -left-6 w-3 h-3 bg-orange-400 rounded-full animate-pulse delay-300"></div>
                    </div>
                </div>
            </div>

            {/* Main Game Area */}
            <div className="max-w-2xl mx-auto px-6 pb-20">
                <div className="backdrop-blur-sm bg-gradient-to-br from-emerald-900/50 to-teal-900/50 rounded-2xl border border-emerald-600/30 shadow-2xl p-8 space-y-8">
                    <PlayButton />
                    <QueueStatus />
                </div>

                {/* How to Play Section */}
                <div className="mt-12 backdrop-blur-sm bg-gradient-to-r from-emerald-900/30 to-teal-900/30 rounded-2xl border border-emerald-700/30 p-8">
                    <h2 className="text-2xl font-bold text-emerald-100 mb-6 text-center">How It Works</h2>
                    <div className="space-y-6">
                        <div className="flex items-start gap-4 group hover:bg-emerald-800/10 rounded-lg p-4 transition-colors">
                            <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
                                    1
                                </div>
                            </div>
                            <div className="pt-1">
                                <h3 className="text-emerald-100 font-semibold mb-1">Join the Queue</h3>
                                <p className="text-emerald-200/80">Click "Find Match" to enter the ranked matchmaking system</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 group hover:bg-emerald-800/10 rounded-lg p-4 transition-colors">
                            <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-gradient-to-r from-teal-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
                                    2
                                </div>
                            </div>
                            <div className="pt-1">
                                <h3 className="text-emerald-100 font-semibold mb-1">Skill-Based Matching</h3>
                                <p className="text-emerald-200/80">We'll find 3 other players with similar MMR for balanced gameplay</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 group hover:bg-emerald-800/10 rounded-lg p-4 transition-colors">
                            <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-gradient-to-r from-emerald-600 to-lime-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
                                    3
                                </div>
                            </div>
                            <div className="pt-1">
                                <h3 className="text-emerald-100 font-semibold mb-1">Battle & Climb</h3>
                                <p className="text-emerald-200/80">Accept your match and compete to increase your ranking!</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats/Info Cards */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="backdrop-blur-sm bg-emerald-800/30 rounded-xl border border-emerald-700/30 p-6 text-center">
                        <div className="text-2xl font-bold text-emerald-400 mb-2">Fast</div>
                        <div className="text-sm text-emerald-300">Quick matchmaking</div>
                    </div>
                    <div className="backdrop-blur-sm bg-emerald-800/30 rounded-xl border border-emerald-700/30 p-6 text-center">
                        <div className="text-2xl font-bold text-teal-400 mb-2">Fair</div>
                        <div className="text-sm text-emerald-300">Skill-based matching</div>
                    </div>
                    <div className="backdrop-blur-sm bg-emerald-800/30 rounded-xl border border-emerald-700/30 p-6 text-center">
                        <div className="text-2xl font-bold text-lime-400 mb-2">Fun</div>
                        <div className="text-sm text-emerald-300">Strategic gameplay</div>
                    </div>
                </div>
            </div>
        </div>
    );
};