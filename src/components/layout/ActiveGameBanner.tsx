import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { isExpired } from '../../services/tokenRenewal';
import { Banner, Button } from '../ui';

/** How often a signed-in page asks again whether the player has a seat in a running game. */
export const ACTIVE_GAME_POLL_MS = 30_000;

/**
 * "Return to your game" on every app page but the game itself (R-33) and Home, whose own card
 * stands in for it (spec §2.5). Asks GET /user/me/active-game on each navigation and every 30 s
 * while signed in; a failed check keeps the last answer, because a failure is not "no game".
 */
export const ActiveGameBanner: React.FC = () => {
    const { isAuthenticated, token } = useAuth();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [gameId, setGameId] = useState<string | null>(null);
    const onGamePage = pathname.startsWith('/game/');
    // Home shows the "Return to your game" card in the banner's place and asks for itself (spec §2.5 R-33)
    const onHome = pathname === '/dashboard';
    // No token, or an expired one: its 401 would sign the tab out, and on /rules, /privacy and /terms
    // send a reader who needs no session to /login. App pages end a dead session on their own requests.
    const canAsk = isAuthenticated && !!token && !isExpired(token);

    useEffect(() => {
        // That game may end while it is on screen: leaving starts from no banner until the next check answers
        if (onGamePage) setGameId(null);
        if (!canAsk || onGamePage || onHome) return;
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
    }, [canAsk, onGamePage, onHome, pathname]);

    if (!isAuthenticated || onGamePage || onHome || !gameId) return null;

    return (
        <Banner
            label="Game in progress"
            icon="play"
            action={
                <Button size="sm" onClick={() => navigate(`/game/${gameId}`)}>
                    Return to your game
                </Button>
            }
        >
            You have a game in progress.
        </Banner>
    );
};
