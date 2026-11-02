import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Sheet, Switch } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { lobbyService } from '../../services/lobbyService';
import type { CreateLobbyDTO } from '../../types/lobby';
import { errorMessage } from '../../utils/errorMessage';
import { cat, useT } from '../../i18n/t';

export interface CreateLobbySheetProps {
    open: boolean;
    onClose: () => void;
    /** Doma's "Stol za ekipu" (spec §5): the form opens with Private on. */
    privateTable?: boolean;
}

/**
 * "Create lobby" (spec §4.6). The server makes the caller the host, seats them in Team A and fixes the
 * mode to CASUAL, so the host goes straight into the new lobby (X-5).
 */
export function CreateLobbySheet({ open, onClose, privateTable = false }: CreateLobbySheetProps) {
    const t = useT();
    return (
        <Sheet open={open} onClose={onClose} title={t.tables.create}>
            <CreateLobbyForm onCancel={onClose} privateTable={privateTable} />
        </Sheet>
    );
}

interface FormErrors {
    name?: string;
    password?: string;
    submit?: string;
}

function CreateLobbyForm({ onCancel, privateTable }: { onCancel: () => void; privateTable: boolean }) {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [privateLobby, setPrivateLobby] = useState(privateTable);
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<FormErrors>({});
    const [creating, setCreating] = useState(false);
    const t = useT();

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const c = cat().tables.form;
        const found: FormErrors = {};
        if (!name.trim()) found.name = c.nameRequired;
        if (privateLobby && !password.trim()) found.password = c.passwordRequired;
        setErrors(found);
        if (found.name || found.password) return;

        // The caller becomes the host server-side; the server also fixes the mode to CASUAL.
        const lobbyData: CreateLobbyDTO = { name: name.trim(), privateLobby, password: privateLobby ? password : null };
        setCreating(true);
        try {
            const created = await lobbyService.createLobby(lobbyData);
            navigate(`/lobby/${created.id}`);
        } catch (error) {
            setErrors({ submit: errorMessage(error, c.failed) });
            setCreating(false);
        }
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-4">
            <Input
                label={t.tables.form.nameLabel}
                value={name}
                onChange={(event) => {
                    setName(event.target.value);
                    setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                error={errors.name}
                placeholder={t.tables.form.namePlaceholder}
                maxLength={50}
                autoComplete="off"
            />

            {/* Game Mode: the server makes every lobby CASUAL; ranked games come from the queue on /play (R-34) */}
            <p className="t-callout text-text-2">{t.tables.form.casual}</p>

            <Switch label={t.tables.privateTable} checked={privateLobby} onChange={setPrivateLobby} helper={t.tables.form.privateHelper} />

            {privateLobby && (
                <Input
                    label={t.forms.password}
                    type="password"
                    value={password}
                    onChange={(event) => {
                        setPassword(event.target.value);
                        setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    error={errors.password}
                    placeholder={t.tables.form.passwordPlaceholder}
                    maxLength={20}
                    autoComplete="new-password"
                />
            )}

            <ErrorAlert message={errors.submit ?? null} />

            <div className="flex justify-end gap-2 pt-2">
                <Button variant="quiet" onClick={onCancel} disabled={creating}>
                    {t.common.cancel}
                </Button>
                <Button type="submit" loading={creating}>
                    {t.tables.form.submit}
                </Button>
            </div>
        </form>
    );
}
