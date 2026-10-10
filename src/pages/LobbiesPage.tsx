import { LobbyList } from '../components/lobby/LobbyList';
import { Page } from '../components/layout/Page';

/** /lobbies (spec §4.6). Phase 5 owns this module. */
export function LobbiesPage() {
    return (
        <Page title="Lobbies">
            <LobbyList />
        </Page>
    );
}
