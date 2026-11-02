import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../services/api';
import { startBotGame } from '../services/botGame';
import { errorMessage, isNetworkOrServerFailure } from '../utils/errorMessage';
import { cat } from '../i18n/t';

/** Why a bot game didn't start, worded as LobbyRoom's botFailure words it: no answer or a 5xx means the bots are away. */
export function botGameFailure(e: unknown): string {
    return e instanceof ApiError && isNetworkOrServerFailure(e.status) ? cat().table.botsUnavailable : errorMessage(e, cat().errors.generic);
}

/**
 * One click to a game against three bots (spec §6): Doma's "Igraj odmah", the landing page's Botovi and the
 * needs-an-account page. `before` runs first (the landing page makes a visitor a guest). A refusal is worded for the
 * page; ALREADY_IN_GAME also tells the page to look for the running game at once. `play` resolves true once the game
 * page opens, false after a refusal (Ruling 48: the landing page shows a guest it made only then).
 */
export function useBotGame({ onAlreadyInGame }: { onAlreadyInGame?: () => void } = {}): {
    play: (before?: () => Promise<unknown>) => Promise<boolean>;
    starting: boolean;
    error: string | null;
} {
    const navigate = useNavigate();
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const play = async (before?: () => Promise<unknown>) => {
        setStarting(true);
        setError(null);
        try {
            await before?.();
            const { gameId } = await startBotGame();
            navigate(`/game/${gameId}`);
            return true;
        } catch (e) {
            if (e instanceof ApiError && e.code === 'ALREADY_IN_GAME') onAlreadyInGame?.();
            setError(botGameFailure(e));
            setStarting(false);
            return false;
        }
    };

    return { play, starting, error };
}
