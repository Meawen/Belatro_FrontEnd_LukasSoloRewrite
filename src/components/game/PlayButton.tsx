import React from 'react';
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/Button';
import { Loading } from '../common/Loading';

export const PlayButton: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
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
        console.log('PlayButton clicked!', { isInQueue, isWebSocketConnected, isWebSocketConnecting });

        if (isInQueue) {
            try {
                console.log('Attempting to leave queue...');
                await leaveQueue();
                console.log('Successfully left queue');
            } catch (error) {
                console.error('Failed to leave queue:', error);
            }
        } else {
            try {
                console.log('Attempting to join queue...');
                await joinQueue();
                console.log('Successfully joined queue');
            } catch (error) {
                console.error('Failed to join queue:', error);
            }
        }
    };

    const getButtonText = () => {
        if (!isAuthenticated) return 'Please Login First';
        if (isWebSocketConnecting) return 'Connecting...';
        if (isJoining) return 'Joining Queue...';
        if (isLeaving) return 'Leaving Queue...';
        if (isInQueue) return 'Leave Queue';
        return 'Find Match';
    };

    const getButtonVariant = () => {
        if (!isAuthenticated) return 'secondary';
        if (isInQueue) return 'secondary';
        return 'primary';
    };

    const isDisabled = !isAuthenticated || isJoining || isLeaving || isWebSocketConnecting || (!isWebSocketConnected && !isInQueue);

    // Debug render
    console.log('PlayButton render:', {
        isAuthenticated,
        user: user?.username,
        isInQueue,
        isJoining,
        isLeaving,
        isWebSocketConnected,
        isWebSocketConnecting,
        isDisabled,
        webSocketError,
        joinError: joinError?.message,
        leaveError: leaveError?.message
    });

    return (
        <div className="space-y-4">
            {/* Debug info - remove this later */}
            <div className="text-xs text-gray-400 p-2 bg-gray-800 rounded">
                <div>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</div>
                <div>Username: {user?.username || 'N/A'}</div>
                <div>WebSocket Connected: {isWebSocketConnected ? 'Yes' : 'No'}</div>
                <div>WebSocket Connecting: {isWebSocketConnecting ? 'Yes' : 'No'}</div>
                <div>In Queue: {isInQueue ? 'Yes' : 'No'}</div>
                <div>Button Disabled: {isDisabled ? 'Yes' : 'No'}</div>
                {webSocketError && <div>WS Error: {webSocketError}</div>}
            </div>

            {!isAuthenticated && (
                <div className="text-amber-400 text-sm bg-amber-950 p-3 rounded-lg border border-amber-800">
                    Please log in to play ranked matches
                </div>
            )}

            {isWebSocketConnecting && (
                <div className="flex items-center gap-2 text-amber-400 bg-amber-950 p-3 rounded-lg border border-amber-800">
                    <Loading size="small" />
                    <span className="text-sm">Connecting to game server...</span>
                </div>
            )}

            {webSocketError && !isWebSocketConnecting && (
                <div className="text-red-400 text-sm bg-red-950 p-3 rounded-lg border border-red-800">
                    Connection error: {webSocketError}
                </div>
            )}

            <Button
                onClick={handlePlayClick}
                disabled={isDisabled}
                variant={getButtonVariant()}
                size="large"
                className="w-full"
            >
                {getButtonText()}
            </Button>

            {(joinError || leaveError) && (
                <div className="text-red-400 text-sm bg-red-950 p-3 rounded-lg border border-red-800">
                    Error: {joinError?.message || leaveError?.message}
                </div>
            )}
        </div>
    );
};