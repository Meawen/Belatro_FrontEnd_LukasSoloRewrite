import { useSearchParams } from 'react-router-dom';
import { Page } from '../components/layout/Page';
import { CreateLobbySheet } from '../components/lobby/CreateLobbySheet';
import { LobbyList } from '../components/lobby/LobbyList';
import { Button, IconButton, PixelIcon } from '../components/ui';
import { useOpenLobbies } from '../hooks/useLobby';
import { useT } from '../i18n/t';

/**
 * /lobbies (spec §4.6). `?create=1` (Home's "Create lobby") opens the create sheet. Phase 5 owns this module.
 * `?create=private` (Doma's Stol za ekipu, spec §5) opens it with Private on.
 */
export function LobbiesPage() {
    const list = useOpenLobbies();
    const [params, setParams] = useSearchParams();
    const create = params.get('create');
    const creating = create === '1' || create === 'private';
    const t = useT();
    return (
        <Page
            title={t.titles.tables}
            meta={list.lobbies ? t.tables.open(list.lobbies.length) : undefined}
            actions={
                <>
                    <Button leftIcon={<PixelIcon name="plus" />} onClick={() => setParams({ create: '1' }, { replace: true })}>
                        {t.tables.create}
                    </Button>
                    <IconButton icon="refresh" aria-label={t.common.refresh} variant="secondary" onClick={() => void list.refresh()} />
                </>
            }
        >
            <LobbyList lobbies={list.lobbies} failed={list.failed} pollFailed={list.pollFailed} onRetry={() => void list.refresh()} />
            <CreateLobbySheet open={creating} privateTable={create === 'private'} onClose={() => setParams({}, { replace: true })} />
        </Page>
    );
}
