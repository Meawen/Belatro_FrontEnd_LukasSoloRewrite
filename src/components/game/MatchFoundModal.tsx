import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked';
import { rankedService } from '../../services/rankedService';
import { ApiError } from '../../services/api';
import { errorMessage } from '../../utils/errorMessage';
import { Avatar, Button, Sheet, Tag } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import type { MatchDTO } from '../../types';
import type { UserSimpleDTO } from '../../types/user';

/** The server's 409 once a match can no longer be declined: a bid was made, or 30 s passed (R-25). */
export const DECLINE_TOO_LATE = 'This match can no longer be declined';

/** A found match is accepted for the player after this many seconds. */
export const ACCEPT_COUNTDOWN_SECONDS = 15;

function Team({ name, tone, players, isMe }: {
    name: string;
    tone: 'team-a' | 'team-b';
    players: UserSimpleDTO[] | null;
    isMe: (player: UserSimpleDTO) => boolean;
}) {
    return (
        <section aria-label={name} className="notch bg-surface-2 p-3">
            <h3 className={tone === 'team-a' ? 't-caption text-team-a' : 't-caption text-team-b-text'}>{name}</h3>
            <ul className="mt-2 flex flex-col gap-2">
                {(players ?? []).map((player) => (
                    <li key={player.id ?? player.username ?? ''} className="flex min-w-0 items-center gap-2">
                        <Avatar initial={player.username ?? '?'} tone={tone} size="sm" />
                        <span className="t-callout truncate">{player.username}</span>
                        {isMe(player) && <Tag tone="you">YOU</Tag>}
                    </li>
                ))}
            </ul>
        </section>
    );
}

/**
 * Match Found (spec §4.5; X-4): a full-screen sheet over any page that only Accept or Decline closes
 * (no ×, no Escape, no scrim tap). The game already runs on the server; Accept only opens it.
 */
export const MatchFoundModal: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { foundMatch, acceptMatch } = useEnhancedRanked();
    const [countdown, setCountdown] = useState(ACCEPT_COUNTDOWN_SECONDS);
    const [declineError, setDeclineError] = useState<string | null>(null);
    const [isDeclining, setIsDeclining] = useState(false);
    // Read by the auto-accept: never auto-accept a match whose decline is on its way
    const decliningRef = useRef(false);
    const acceptRef = useRef<HTMLButtonElement>(null);
    // The match on screen, kept while the sheet slides away after Accept or Decline
    const [shown, setShown] = useState<MatchDTO | null>(null);
    if (foundMatch && foundMatch !== shown) {
        // RankedQueueProvider keeps this dialog mounted for the app's lifetime, so every
        // match starts a fresh countdown (unmounting PlayPage used to reset it)
        setShown(foundMatch);
        setCountdown(ACCEPT_COUNTDOWN_SECONDS);
        setDeclineError(null);
    }

    useEffect(() => {
        if (!foundMatch) return;
        const timer = setInterval(() => setCountdown((prev) => Math.max(prev - 1, 0)), 1000);
        return () => clearInterval(timer);
    }, [foundMatch]);

    const handleAccept = () => {
        if (!foundMatch || decliningRef.current) return;
        acceptMatch();
        navigate(`/game/${foundMatch.id}`);
    };

    // Auto-accept after the countdown, unless a decline is in flight (handleAccept checks; a refused decline retries here)
    useEffect(() => {
        if (countdown === 0 && !isDeclining) handleAccept();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countdown, isDeclining, foundMatch]);

    // R-25: the server cancels the game, re-queues the other three and starts this player's
    // 2-minute queue cooldown. Too late (a bid was made, or 30 s passed): say so, keep the dialog.
    const handleDecline = async () => {
        if (!foundMatch?.id) return;
        decliningRef.current = true;
        setIsDeclining(true);
        setDeclineError(null);
        try {
            await rankedService.declineMatch(foundMatch.id);
            acceptMatch(); // This clears the match state
        } catch (error) {
            setDeclineError(error instanceof ApiError && error.status === 409
                ? DECLINE_TOO_LATE
                : errorMessage(error, 'Could not decline the match'));
        } finally {
            decliningRef.current = false;
            setIsDeclining(false);
        }
    };

    const match = foundMatch ?? shown;
    const isMe = (player: UserSimpleDTO) =>
        (player.id != null && player.id === user?.id) || (player.username != null && player.username === user?.username);

    return (
        <Sheet
            open={foundMatch !== null}
            // not dismissible: only Accept (or the countdown) and Decline close it
            onClose={() => {}}
            dismissible={false}
            side="full"
            title="Match found"
            initialFocus={acceptRef}
            className="items-center"
        >
            {match && (
                <div className="flex w-[min(560px,calc(100vw-32px))] flex-col gap-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Team name="Team A" tone="team-a" players={match.teamA} isMe={isMe} />
                        <Team name="Team B" tone="team-b" players={match.teamB} isMe={isMe} />
                    </div>

                    <div className="flex flex-col gap-2">
                        {/* the countdown is information, so it runs under reduced motion too (spec §3.8) */}
                        <div className="h-2 overflow-hidden bg-surface-2" aria-hidden="true">
                            <div
                                data-testid="accept-countdown"
                                className="h-full origin-left bg-accent transition-transform duration-1000 ease-linear"
                                style={{ transform: `scaleX(${countdown / ACCEPT_COUNTDOWN_SECONDS})` }}
                            />
                        </div>
                        <p className="t-callout text-text-2">Auto-accepting in {countdown} seconds...</p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button ref={acceptRef} block onClick={handleAccept}>
                            Accept Match
                        </Button>
                        <Button variant="secondary" block onClick={handleDecline} disabled={isDeclining}>
                            Decline
                        </Button>
                    </div>

                    <ErrorAlert message={declineError} />
                </div>
            )}
        </Sheet>
    );
};
