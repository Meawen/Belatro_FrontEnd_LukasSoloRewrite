import { useSearchParams } from 'react-router-dom';
import { Page } from '../components/layout/Page';
import { CreateLobbySheet } from '../components/lobby/CreateLobbySheet';
import { LobbyList } from '../components/lobby/LobbyList';
import { Button, IconButton, PixelIcon } from '../components/ui';
import { useOpenLobbies } from '../hooks/useLobby';
import { useT } from '../i18n/t';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { useBotGame } from '../hooks/useBotGame';

/**
 * /lobbies (spec §4.6). `?create=1` (the header's "Create table") opens the create sheet. Phase 5 owns this module.
 * `?create=private` (Doma's Stol za ekipu, spec §5) opens it with Private on. The empty list offers a Stol za ekipu and
 * a bot game (spec §8).
 */
export function LobbiesPage() {
    const list = useOpenLobbies();
    const [params, setParams] = useSearchParams();
    const create = params.get('create');
    const creating = create === '1' || create === 'private';
    const t = useT();
    const bots = useBotGame();
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
            {/* spec §8: an empty Birtija still has a way on: a Stol za ekipu (as Doma's), or bots now (spec §6) */}
            <LobbyList
                lobbies={list.lobbies}
                failed={list.failed}
                pollFailed={list.pollFailed}
                onRetry={() => void list.refresh()}
                emptyAction={
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex flex-wrap justify-center gap-2">
                            <Button leftIcon={<PixelIcon name="lock" />} onClick={() => setParams({ create: 'private' }, { replace: true })}>{t.tables.privateTable}</Button>
                            <Button variant="secondary" leftIcon={<PixelIcon name="robot" />} loading={bots.starting} onClick={() => void bots.play()}>{t.tables.emptyBots}</Button>
                        </div>
                        <ErrorAlert message={bots.error} />
                    </div>
                }
            />
            <CreateLobbySheet open={creating} privateTable={create === 'private'} onClose={() => setParams({}, { replace: true })} />
        </Page>
    );
}
