import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, PixelIcon, Sheet } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { useAuth } from '../../hooks/useAuth';
import { lobbyService } from '../../services/lobbyService';
import type { LobbyDTO } from '../../types/lobby';
import { errorMessage } from '../../utils/errorMessage';
import { LobbyTable } from './LobbyTable';
import { createdAgo, isFull, isMember, lobbyName } from './lobbyModel';

export interface LobbyQuickLookProps {
    /** The lobby as the latest poll has it (the sheet follows it by id); null: closed. */
    lobby: LobbyDTO | null;
    /** The lobby has left the open list since the sheet opened. */
    gone: boolean;
    onClose: () => void;
}

/** The quick-look (spec §4.6, D-17): what a row's lobby looks like, and the way in. */
export function LobbyQuickLook({ lobby, gone, onClose }: LobbyQuickLookProps) {
    return (
        <Sheet open={lobby !== null} onClose={onClose} title={lobby ? lobbyName(lobby) : ''}>
            {lobby && <QuickLookBody lobby={lobby} gone={gone} onClose={onClose} />}
        </Sheet>
    );
}

function QuickLookBody({ lobby, gone, onClose }: { lobby: LobbyDTO; gone: boolean; onClose: () => void }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const me = user?.id ?? null;
    const [password, setPassword] = useState('');
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const close = (
        <Button variant="quiet" onClick={onClose}>
            Close
        </Button>
    );

    if (gone) {
        return (
            <div className="flex flex-col gap-4">
                <p className="t-body text-text-2">This lobby is no longer open</p>
                <div className="flex justify-end">{close}</div>
            </div>
        );
    }

    const member = isMember(lobby, me);
    const created = createdAgo(lobby.createdAt);

    // Join, then straight into the lobby (D-19). The server adds the caller to Unassigned (idempotent for members).
    const join = async (event: FormEvent) => {
        event.preventDefault();
        if (!lobby.id) return;
        setJoining(true);
        setError(null);
        try {
            await lobbyService.joinLobby(lobby.id, { lobbyId: lobby.id, password: lobby.privateLobby ? password : null });
            navigate(`/lobby/${lobby.id}`);
        } catch (e) {
            setError(errorMessage(e, 'Failed to join lobby'));
            if (lobby.privateLobby) setPassword('');
            setJoining(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <LobbyTable lobby={lobby} viewerId={me} mini />
            <ul className="t-callout flex flex-col gap-1 text-text-2">
                <li className="flex items-center gap-2">
                    <PixelIcon name="crown" className="text-accent" />
                    <span>Host</span>
                    <strong className="font-semibold text-text">{lobby.hostUser?.username ?? 'Unknown'}</strong>
                </li>
                {created && <li>{`Created ${created}`}</li>}
                <li className="flex items-center gap-2">
                    {lobby.privateLobby && <PixelIcon name="lock" />}
                    <span>{lobby.privateLobby ? 'Private' : 'Public'}</span>
                </li>
            </ul>

            {member ? (
                <div className="flex justify-end gap-2">
                    {close}
                    <Button onClick={() => navigate(`/lobby/${lobby.id}`)}>Enter lobby</Button>
                </div>
            ) : isFull(lobby) ? (
                <div className="flex justify-end gap-2">
                    {close}
                    <Button disabled>Lobby full</Button>
                </div>
            ) : (
                <form onSubmit={join} className="flex flex-col gap-4">
                    {lobby.privateLobby && (
                        <Input label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" />
                    )}
                    <ErrorAlert message={error} />
                    <div className="flex justify-end gap-2">
                        {close}
                        <Button type="submit" loading={joining} leftIcon={lobby.privateLobby ? <PixelIcon name="lock" /> : undefined}>
                            Join lobby
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}
