import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked';
import { useUser } from '../../hooks/useUser';
import { Banner, Panel } from '../ui';
import { PlayButton } from './PlayButton';
import { QueueStatus } from './QueueStatus';
import { ReconnectBanner } from './ReconnectBanner';

/** /play (spec §4.5; X-3): one calm panel to join and leave the ranked queue. */
export const PlayPage: React.FC = () => {
    // Set by the game table when a DECLINED end sends the other three back here, still queued (R-25)
    const notice = (useLocation().state as { notice?: string } | null)?.notice;
    const { user } = useAuth();
    // GET /user/{id}: the rating the queue matches on (the queue's own frames call it "mmr")
    const { user: profile } = useUser(user?.id ?? undefined);
    const { queueStatus } = useEnhancedRanked();
    const elo = profile?.eloRating ?? queueStatus?.mmr ?? '—';

    return (
        <div className="flex flex-col gap-4">
            {/* While the queue's socket is down (R-30) */}
            <ReconnectBanner />
            {notice && <Banner label="Match declined">{notice}</Banner>}
            <Panel as="section" padding="lg" aria-labelledby="ranked-title" className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
                <div>
                    {/* the release gate's harness waits for this text on /play */}
                    <p className="t-caption text-accent">RANKED</p>
                    <h1 id="ranked-title" className="t-display mt-1">
                        Find a match
                    </h1>
                </div>
                <p className="flex items-baseline gap-2">
                    <span className="t-callout text-text-2">Elo</span>
                    <span className="t-score tabular-nums">{elo}</span>
                </p>
                <PlayButton />
                <QueueStatus />
            </Panel>
        </div>
    );
};
