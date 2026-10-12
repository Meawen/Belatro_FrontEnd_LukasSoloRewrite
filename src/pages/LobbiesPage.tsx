import { useSearchParams } from 'react-router-dom';
import { Page } from '../components/layout/Page';
import { CreateLobbySheet } from '../components/lobby/CreateLobbySheet';
import { LobbyList } from '../components/lobby/LobbyList';
import { Button, IconButton, PixelIcon } from '../components/ui';
import { useOpenLobbies } from '../hooks/useLobby';

const openCount = (n: number) => (n === 1 ? '1 lobby open' : `${n} lobbies open`);

/** /lobbies (spec §4.6). `?create=1` (Home's "Create lobby") opens the create sheet. Phase 5 owns this module. */
export function LobbiesPage() {
    const list = useOpenLobbies();
    const [params, setParams] = useSearchParams();
    const creating = params.get('create') === '1';
    return (
        <Page
            title="Lobbies"
            meta={list.lobbies ? openCount(list.lobbies.length) : undefined}
            actions={
                <>
                    <Button leftIcon={<PixelIcon name="plus" />} onClick={() => setParams({ create: '1' }, { replace: true })}>
                        Create lobby
                    </Button>
                    <IconButton icon="refresh" aria-label="Refresh" variant="secondary" onClick={() => void list.refresh()} />
                </>
            }
        >
            <LobbyList lobbies={list.lobbies} failed={list.failed} pollFailed={list.pollFailed} onRetry={() => void list.refresh()} />
            <CreateLobbySheet open={creating} onClose={() => setParams({}, { replace: true })} />
        </Page>
    );
}
