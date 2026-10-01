import { useEffect, useMemo, useState, useCallback } from 'react';
import { useGameWebSocket, type PublicGameView, type PrivateGameView, type Card } from './useGameWebSocket';

type TrumpSuit = 'HERC' | 'KARO' | 'PIK' | 'TREF';

export function useBelatroGame(gameId: string, onDisconnect?: () => void) {
    const [pub, setPub] = useState<PublicGameView | null>(null);
    const [prv, setPrv] = useState<PrivateGameView | null>(null);

    const ws = useGameWebSocket({
        onPublicGameUpdate: setPub,
        onPrivateGameUpdate: setPrv,
        onGameDisconnect: onDisconnect,
    });

    useEffect(() => {
        ws.ready().then(() => ws.subscribeToGame(gameId)).catch(() => undefined);
        return () => ws.unsubscribeFromGame(gameId);
    }, [ws, gameId]);

    const yourTurn = prv?.yourTurn === true;
    const hand = prv?.hand ?? [];

    const bidTrump = useCallback((suit: TrumpSuit) => {
        ws.placeBid(gameId, false, suit);
    }, [ws, gameId]);

    const passBid = useCallback(() => {
        ws.placeBid(gameId, true);
    }, [ws, gameId]);

    const play = useCallback((card: Card, declareBela = false) => {
        ws.playCard(gameId, card, declareBela);
    }, [ws, gameId]);

    const challenge = useCallback(() => ws.challenge(gameId), [ws, gameId]);
    const refresh = useCallback(() => ws.refreshGameState(gameId), [ws, gameId]);
    const cancel = useCallback(() => ws.cancelMatch(gameId), [ws, gameId]);

    return { publicView: pub, privateView: prv, yourTurn, hand, actions: { bidTrump, passBid, play, challenge, refresh, cancel } };
}
