import React from 'react';
import { RankedQueueContext, useRankedQueueState } from '../../hooks/useEnhancedRanked';
import { MatchFoundModal } from './MatchFoundModal';

/**
 * The ranked queue for the whole app (R-33). App mounts it once around the routes, so the
 * queue state, its subscriptions and the Match Found dialog survive every page change.
 */
export const RankedQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const queue = useRankedQueueState();
    return (
        <RankedQueueContext.Provider value={queue}>
            {children}
            <MatchFoundModal />
        </RankedQueueContext.Provider>
    );
};
