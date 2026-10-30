import React from 'react';
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked';
import { Button, Loader } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { ResendConfirmationButton } from '../auth/ResendConfirmationButton';
import { localiseApiError } from '../../i18n/serverErrors';
import { errorMessage } from '../../utils/errorMessage';
import { useT } from '../../i18n/t';

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
    const t = useT();

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
        if (isWebSocketConnecting) return t.ranked.connecting;
        if (isJoining) return t.ranked.joining;
        if (isLeaving) return t.ranked.leaving;
        if (isInQueue) return t.ranked.leave;
        return t.ranked.find;
    };

    // joining and leaving disable it too, through `loading`
    const isDisabled = isWebSocketConnecting || (!isWebSocketConnected && !isInQueue);

    return (
        <div className="flex flex-col gap-3">
            {isWebSocketConnecting && <Loader layout="inline" text={t.ranked.connectingServer} className="self-start" />}

            {webSocketError && !isWebSocketConnecting && <ErrorAlert message={t.ranked.connectionError(webSocketError)} />}

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
                        message={localiseApiError(joinError)}
                    />
                    <ResendConfirmationButton />
                </div>
            ) : joinError?.status === 429 ? (
                // a declined match's 2-minute cooldown (R-25) or the rate limit: the server says how long
                <ErrorAlert message={localiseApiError(joinError)} />
            ) : (
                (joinError || leaveError) && <ErrorAlert message={t.ranked.error(errorMessage(joinError ?? leaveError, ''))} />
            )}
        </div>
    );
};
