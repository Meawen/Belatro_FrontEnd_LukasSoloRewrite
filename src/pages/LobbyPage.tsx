import { useParams } from 'react-router-dom';
import { LobbyDetails } from '../components/lobby/LobbyDetails';
import { Page } from '../components/layout/Page';

/** /lobby/:lobbyId (spec §4.7). The content still renders its own h1 (the lobby's name); Phase 5 owns this module. */
export function LobbyPage() {
    const { lobbyId } = useParams<{ lobbyId: string }>();
    return (
        <Page title="Lobby" heading={null}>
            <LobbyDetails lobbyId={lobbyId ?? ''} />
        </Page>
    );
}
