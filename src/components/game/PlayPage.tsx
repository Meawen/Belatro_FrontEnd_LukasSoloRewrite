import React from 'react';
import { PlayButton, QueueStatus, MatchFoundModal } from '../game';

export const PlayPage: React.FC = () => {
    return (
        <div className="max-w-2xl mx-auto p-6 space-y-8">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-white mb-4">
                    Ready to Play Belatro?
                </h1>
                <p className="text-lg text-emerald-300 mb-8">
                    Join the ranked queue to find a match with players of similar skill level.
                </p>
            </div>

            <div className="card space-y-6">
                <PlayButton />
                <QueueStatus />
            </div>

            <div className="bg-emerald-800 rounded-lg p-6 border border-emerald-600">
                <h2 className="text-xl font-semibold text-emerald-100 mb-4">How it works:</h2>
                <div className="space-y-3 text-emerald-200">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-bold text-white mt-0.5">1</div>
                        <div>Click "Find Match" to join the ranked queue</div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-bold text-white mt-0.5">2</div>
                        <div>Wait while we find 3 other players with similar skill</div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-bold text-white mt-0.5">3</div>
                        <div>Accept the match when found and start playing!</div>
                    </div>
                </div>
            </div>

            {/* Match found modal */}
            <MatchFoundModal />
        </div>
    );
};