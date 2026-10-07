import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked';
import { rankedService } from '../../services/rankedService';
import { ApiError } from '../../services/api';
import { errorMessage } from '../../utils/errorMessage';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { ErrorAlert } from '../common/ErrorAlert';

/** The server's 409 once a match can no longer be declined: a bid was made, or 30 s passed (R-25). */
export const DECLINE_TOO_LATE = 'This match can no longer be declined';

export const MatchFoundModal: React.FC = () => {
    const navigate = useNavigate();
    const { foundMatch, acceptMatch } = useEnhancedRanked();
    const [countdown, setCountdown] = useState(15);
    const [declineError, setDeclineError] = useState<string | null>(null);
    const [isDeclining, setIsDeclining] = useState(false);
    // Read by the countdown's timer: never auto-accept a match whose decline is on its way
    const decliningRef = useRef(false);

    useEffect(() => {
        if (!foundMatch) return;
        // RankedQueueProvider keeps this dialog mounted for the app's lifetime, so every
        // match starts a fresh countdown (unmounting PlayPage used to reset it)
        setCountdown(15);
        setDeclineError(null);

        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    // Auto-accept after countdown
                    handleAccept();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [foundMatch]);

    const handleAccept = () => {
        if (!foundMatch || decliningRef.current) return;
        acceptMatch();
        navigate(`/game/${foundMatch.id}`);
    };

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

    if (!foundMatch) return null;

    return (
        <Modal
            isOpen={!!foundMatch}
            onClose={() => {}} // Prevent manual close
            title="Match Found!"
            size="medium"
        >
            <div className="space-y-6">
                <div className="text-center">
                    <div className="text-4xl mb-2">🎮</div>
                    <p className="text-lg text-gray-700">
                        A match has been found! Get ready to play.
                    </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="text-sm text-gray-600">Match Details:</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="font-medium text-blue-600">Team A</div>
                            <div className="space-y-1">
                                {(foundMatch.teamA ?? []).map((player) => (
                                    <div key={player.id ?? player.username ?? ''} className="text-gray-700">
                                        {player.username}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div className="font-medium text-red-600">Team B</div>
                            <div className="space-y-1">
                                {(foundMatch.teamB ?? []).map((player) => (
                                    <div key={player.id ?? player.username ?? ''} className="text-gray-700">
                                        {player.username}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600 mb-2">
                        {countdown}
                    </div>
                    <div className="text-sm text-gray-500">
                        Auto-accepting in {countdown} seconds...
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button
                        onClick={handleAccept}
                        variant="primary"
                        size="large"
                        className="flex-1"
                    >
                        Accept Match
                    </Button>
                    <Button
                        onClick={handleDecline}
                        variant="secondary"
                        size="large"
                        className="flex-1"
                        disabled={isDeclining}
                    >
                        Decline
                    </Button>
                </div>

                <ErrorAlert message={declineError} />
            </div>
        </Modal>
    );
};
