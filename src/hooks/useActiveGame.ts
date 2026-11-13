import { useCallback, useEffect, useRef, useState } from 'react';
import { ACTIVE_GAME_POLL_MS } from '../components/layout/ActiveGameBanner';
import { userService } from '../services/userService';

/**
 * The player's running game (spec §2.5 R-33), for Doma's "Return to your game" card and a returning guest on the
 * landing page: asked on arrival and every 30 s like the shell's banner; a failed check keeps the last answer.
 * `recheck` asks at once (a bot game refused with ALREADY_IN_GAME). Off, it asks nothing.
 */
export function useActiveGame(enabled = true): { gameId: string | null; recheck: () => void } {
    const [gameId, setGameId] = useState<string | null>(null);
    const checkRef = useRef<(() => void) | null>(null);
    useEffect(() => {
        if (!enabled) return;
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
        checkRef.current = check;
        check();
        const timer = window.setInterval(check, ACTIVE_GAME_POLL_MS);
        return () => {
            current = false;
            checkRef.current = null;
            window.clearInterval(timer);
        };
    }, [enabled]);
    const recheck = useCallback(() => checkRef.current?.(), []);
    return { gameId, recheck };
}
