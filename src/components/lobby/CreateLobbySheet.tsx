import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Sheet, Switch } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { lobbyService } from '../../services/lobbyService';
import type { CreateLobbyDTO } from '../../types/lobby';
import { errorMessage } from '../../utils/errorMessage';

export interface CreateLobbySheetProps {
    open: boolean;
    onClose: () => void;
}

/**
 * "Create lobby" (spec §4.6). The server makes the caller the host, seats them in Team A and fixes the
 * mode to CASUAL, so the host goes straight into the new lobby (X-5).
 */
export function CreateLobbySheet({ open, onClose }: CreateLobbySheetProps) {
    return (
        <Sheet open={open} onClose={onClose} title="Create lobby">
            <CreateLobbyForm onCancel={onClose} />
        </Sheet>
    );
}

interface FormErrors {
    name?: string;
    password?: string;
    submit?: string;
}

function CreateLobbyForm({ onCancel }: { onCancel: () => void }) {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [privateLobby, setPrivateLobby] = useState(false);
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<FormErrors>({});
    const [creating, setCreating] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const found: FormErrors = {};
        if (!name.trim()) found.name = 'Lobby name is required';
        if (privateLobby && !password.trim()) found.password = 'Password is required for private lobbies';
        setErrors(found);
        if (found.name || found.password) return;

        // The caller becomes the host server-side; the server also fixes the mode to CASUAL.
        const lobbyData: CreateLobbyDTO = { name: name.trim(), privateLobby, password: privateLobby ? password : null };
        setCreating(true);
        try {
            const created = await lobbyService.createLobby(lobbyData);
            navigate(`/lobby/${created.id}`);
        } catch (error) {
            setErrors({ submit: errorMessage(error, 'Failed to create lobby') });
            setCreating(false);
        }
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-4">
            <Input
                label="Lobby name"
                value={name}
                onChange={(event) => {
                    setName(event.target.value);
                    setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                error={errors.name}
                placeholder="Enter lobby name..."
                maxLength={50}
                autoComplete="off"
            />

            {/* Game Mode: the server makes every lobby CASUAL; ranked games come from the queue on /play (R-34) */}
            <p className="t-callout text-text-2">Lobby games are casual: they don't change your rating.</p>

            <Switch label="Private lobby" checked={privateLobby} onChange={setPrivateLobby} helper="Private lobbies require a password to join" />

            {privateLobby && (
                <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(event) => {
                        setPassword(event.target.value);
                        setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    error={errors.password}
                    placeholder="Enter lobby password..."
                    maxLength={20}
                    autoComplete="new-password"
                />
            )}

            <ErrorAlert message={errors.submit ?? null} />

            <div className="flex justify-end gap-2 pt-2">
                <Button variant="quiet" onClick={onCancel} disabled={creating}>
                    Cancel
                </Button>
                <Button type="submit" loading={creating}>
                    Create
                </Button>
            </div>
        </form>
    );
}
