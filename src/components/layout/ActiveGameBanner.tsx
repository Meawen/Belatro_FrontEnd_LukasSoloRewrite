import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';

/** How often a signed-in page asks again whether the player has a seat in a running game. */
export const ACTIVE_GAME_POLL_MS = 30_000;

/**
 * "Return to your game" on every app page but the game itself (R-33). Asks
 * GET /user/me/active-game on each navigation and every 30 s while signed in; a failed
 * check keeps the last answer, because a failure is not "no game".
 */
export const ActiveGameBanner: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [gameId, setGameId] = useState<string | null>(null);
    const onGamePage = pathname.startsWith('/game/');

    useEffect(() => {
        // That game may end while it is on screen: leaving starts from no banner until the next check answers
        if (onGamePage) setGameId(null);
        if (!isAuthenticated || onGamePage) return;
        let current = true;
        const check = () => {
            userService.getActiveGame().then(
                (id) => {
                    if (current) setGameId(id);
                },
                () => {
                    // keep what we knew
                },
            );
        };
        check();
        const timer = window.setInterval(check, ACTIVE_GAME_POLL_MS);
        return () => {
            current = false;
            window.clearInterval(timer);
        };
    }, [isAuthenticated, onGamePage, pathname]);

    if (!isAuthenticated || onGamePage || !gameId) return null;

    return (
        <div
            role="region"
            aria-label="Game in progress"
            className="bg-amber-600/20 border-b border-amber-500/40 px-6 py-3 flex flex-wrap items-center gap-3 text-sm text-amber-100"
        >
            <span>You have a game in progress.</span>
            <button
                type="button"
                onClick={() => navigate(`/game/${gameId}`)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-emerald-950 font-semibold hover:bg-amber-400 transition-colors"
            >
                Return to your game
            </button>
        </div>
    );
};
