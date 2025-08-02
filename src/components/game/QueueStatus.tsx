import React from 'react';
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked';
import { Loading } from '../common/Loading';

export const QueueStatus: React.FC = () => {
    const { isInQueue, queueStatus } = useEnhancedRanked();

    if (!isInQueue || !queueStatus) {
        return null;
    }

    const formatWaitTime = (seconds?: number) => {
        if (!seconds) return 'Calculating...';

        if (seconds < 60) {
            return `${seconds}s`;
        } else {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        }
    };

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
                <Loading size="small" />
                <h3 className="font-semibold text-blue-900">Searching for Match</h3>
            </div>

            <div className="space-y-2 text-sm text-blue-800">
                {queueStatus.position && (
                    <div className="flex justify-between">
                        <span>Position in queue:</span>
                        <span className="font-medium">#{queueStatus.position}</span>
                    </div>
                )}

                {queueStatus.queueSize && (
                    <div className="flex justify-between">
                        <span>Players in queue:</span>
                        <span className="font-medium">{queueStatus.queueSize}</span>
                    </div>
                )}

                <div className="flex justify-between">
                    <span>Estimated wait:</span>
                    <span className="font-medium">
                        {formatWaitTime(queueStatus.estimatedWaitTime)}
                    </span>
                </div>
            </div>

            <div className="text-xs text-blue-600 mt-3">
                We're finding players with similar skill levels...
            </div>
        </div>
    );
};
