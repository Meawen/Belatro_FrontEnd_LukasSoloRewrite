import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked';
import { useUser } from '../../hooks/useUser';
import { Banner, Panel, SuitIcon } from '../ui';
import type { Boja } from '../../types/game';
import { PlayButton } from './PlayButton';
import { QueueStatus } from './QueueStatus';
import { ReconnectBanner } from './ReconnectBanner';

/** The four suits beside the eyebrow, in the art's own colours. */
const SUITS: Boja[] = ['HERC', 'KARA', 'PIK', 'TREF'];

/**
 * /play (spec §4.5; X-3): one calm panel to join and leave the ranked queue, on the felt of the lobby table with its
 * wooden rim; the panel's edge turns accent while searching (owner, 2026-10-10: "a little more colour").
 */
export const PlayPage: React.FC = () => {
    // Set by the game table when a DECLINED end sends the other three back here, still queued (R-25)
    const notice = (useLocation().state as { notice?: string } | null)?.notice;
    const { user } = useAuth();
    // GET /user/{id}: the rating the queue matches on (the queue's own frames call it "mmr")
    const { user: profile } = useUser(user?.id ?? undefined);
    const { queueStatus, isInQueue } = useEnhancedRanked();
    const elo = profile?.eloRating ?? queueStatus?.mmr ?? '—';

    return (
        <div className="flex flex-col gap-4">
            {/* While the queue's socket is down (R-30) */}
            <ReconnectBanner />
            {notice && <Banner label="Match declined">{notice}</Banner>}
            <div data-testid="ranked-table" className="felt notch-6 relative mx-auto w-full max-w-[680px] px-4 py-8 sm:px-10 sm:py-12">
                <div aria-hidden="true" className="notch-6 pointer-events-none absolute inset-0 shadow-[inset_0_0_0_6px_var(--rim),inset_0_0_0_9px_var(--rim-hi)]" />
                <Panel
                    as="section"
                    padding="lg"
                    edge={isInQueue ? 'accent' : 'default'}
                    aria-labelledby="ranked-title"
                    className="px-shadow relative mx-auto flex w-full max-w-[520px] flex-col gap-5"
                >
                    <div>
                        <div className="flex items-center justify-between gap-3">
                            {/* the release gate's harness waits for this text on /play */}
                            <p className="t-caption text-accent">RANKED</p>
                            <span className="flex gap-1.5">
                                {SUITS.map((boja) => (
                                    <SuitIcon key={boja} boja={boja} />
                                ))}
                            </span>
                        </div>
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
        </div>
    );
};
