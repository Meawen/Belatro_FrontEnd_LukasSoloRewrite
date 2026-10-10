import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { LobbyRoom } from '../components/lobby/LobbyRoom';
import { preloadCardArt } from '../services/cardArt';

/** /lobby/:lobbyId (spec §4.7). Entering a lobby preloads the card art for the game (§3.6). Phase 5 owns this module. */
export function LobbyPage() {
    const { lobbyId = '' } = useParams<{ lobbyId: string }>();
    useEffect(() => {
        void preloadCardArt();
    }, []);
    // a different lobby is a different room: its state starts afresh
    return <LobbyRoom key={lobbyId} lobbyId={lobbyId} />;
}
