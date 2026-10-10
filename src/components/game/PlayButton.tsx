import React from 'react';
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked';
import { Button, Loader } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { ResendConfirmationButton } from '../auth/ResendConfirmationButton';

export const PlayButton: React.FC = () => {
    const {
        isInQueue,
        joinQueue,
        leaveQueue,
        isJoining,
        isLeaving,
        joinError,
        leaveError,
        isWebSocketConnected,
        isWebSocketConnecting,
        webSocketError
    } = useEnhancedRanked();

    const handlePlayClick = async () => {
        if (isInQueue) {
            try {
                await leaveQueue();
            } catch (error) {
                console.error('Failed to leave queue:', error);
            }
        } else {
            try {
                await joinQueue();
            } catch (error) {
                console.error('Failed to join queue:', error);
            }
        }
    };

    const getButtonText = () => {
        if (isWebSocketConnecting) return 'Connecting...';
        if (isJoining) return 'Joining Queue...';
        if (isLeaving) return 'Leaving Queue...';
        if (isInQueue) return 'Leave Queue';
        return 'Find Match';
    };

    // joining and leaving disable it too, through `loading`
    const isDisabled = isWebSocketConnecting || (!isWebSocketConnected && !isInQueue);

    return (
        <div className="flex flex-col gap-3">
            {isWebSocketConnecting && <Loader layout="inline" text="Connecting to game server..." className="self-start" />}

            {webSocketError && !isWebSocketConnecting && <ErrorAlert message={`Connection error: ${webSocketError}`} />}

            <Button
                onClick={handlePlayClick}
                disabled={isDisabled}
                loading={isJoining || isLeaving}
                variant={isInQueue ? 'secondary' : 'primary'}
                block
            >
                {getButtonText()}
            </Button>

            {/* POST /ranked/queue answers 403 only to an unverified account; a dead session is a 401 */}
            {joinError?.status === 403 ? (
                <div className="flex flex-col items-start gap-2">
                    {/* no promise of a mail: an address another account holds never gets a link */}
                    <ErrorAlert
                        message={`${joinError.message}. Open your confirmation link if you have one, or ask for a new one, then try again.`}
                    />
                    <ResendConfirmationButton />
                </div>
            ) : joinError?.status === 429 ? (
                // a declined match's 2-minute cooldown (R-25) or the rate limit: the server says how long
                <ErrorAlert message={joinError.message} />
            ) : (
                (joinError || leaveError) && <ErrorAlert message={`Error: ${joinError?.message || leaveError?.message}`} />
            )}
        </div>
    );
};
