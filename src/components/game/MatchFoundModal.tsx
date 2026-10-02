import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

export const MatchFoundModal: React.FC = () => {
    const navigate = useNavigate();
    const { foundMatch, acceptMatch } = useEnhancedRanked();
    const [countdown, setCountdown] = useState(15);

    useEffect(() => {
        if (!foundMatch) return;

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
        if (!foundMatch) return;
        acceptMatch();
        navigate(`/game/${foundMatch.id}`);
    };

    const handleDecline = () => {
        acceptMatch(); // This clears the match state
        // Could also call leaveQueue if needed
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
                    >
                        Decline
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
