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

    return (
        <div className="space-y-6">
            {!isAuthenticated && (
                <div className="flex items-center gap-3 text-amber-400 bg-gradient-to-r from-amber-950/50 to-orange-950/50 p-4 rounded-xl border border-amber-800/50 backdrop-blur-sm">
                    <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                        <svg className="w-3 h-3 text-amber-900" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <span className="font-medium">Please log in to play ranked matches</span>
                </div>
            )}

            {isWebSocketConnecting && (
                <div className="flex items-center gap-3 text-emerald-400 bg-gradient-to-r from-emerald-950/50 to-teal-950/50 p-4 rounded-xl border border-emerald-800/50 backdrop-blur-sm">
                    <Loading size="small" />
                    <span className="font-medium">Connecting to game server...</span>
                </div>
            )}

            {webSocketError && !isWebSocketConnecting && (
                <div className="flex items-center gap-3 text-red-400 bg-gradient-to-r from-red-950/50 to-pink-950/50 p-4 rounded-xl border border-red-800/50 backdrop-blur-sm">
                    <div className="w-5 h-5 rounded-full bg-red-400 flex items-center justify-center">
                        <svg className="w-3 h-3 text-red-900" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <span className="font-medium">Connection error: {webSocketError}</span>
                </div>
            )}

            <Button
                onClick={handlePlayClick}
                disabled={isDisabled}
                variant={getButtonVariant()}
                size="large"
                className={`w-full transition-all duration-200 ${
                    isInQueue
                        ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                } ${!isDisabled && 'hover:scale-105 hover:shadow-lg'}`}
            >
                {getButtonText()}
            </Button>

            {(joinError || leaveError) && (
                <div className="flex items-center gap-3 text-red-400 bg-gradient-to-r from-red-950/50 to-pink-950/50 p-4 rounded-xl border border-red-800/50 backdrop-blur-sm">
                    <div className="w-5 h-5 rounded-full bg-red-400 flex items-center justify-center">
                        <svg className="w-3 h-3 text-red-900" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <span className="font-medium">Error: {joinError?.message || leaveError?.message}</span>
                </div>
            )}
        </div>
    );
};