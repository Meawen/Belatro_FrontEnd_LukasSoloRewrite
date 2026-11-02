import { useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Panel, PixelIcon, Sheet } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { usernameRuleError } from '../auth/credentialRules';
import { authService } from '../../services/authService';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { cat, useT } from '../../i18n/t';

export interface ReturningGuestProps {
    /** The guest's name as the page knows it (GET /user/me, else the stored user's); the viewer's own, so shown raw. */
    name: string;
    /** The guest's running game (useActiveGame), or null. */
    gameId: string | null;
}

/**
 * A returning guest above the landing page's doors (spec §4): their guest name, the way back to a game in progress,
 * and the rename. Carrying on as this guest needs no button: the doors act as them (Botovi plays as this guest, Ljudi
 * signs this guest up).
 */
export function ReturningGuest({ name, gameId }: ReturningGuestProps) {
    const t = useT();
    const navigate = useNavigate();
    const headingId = useId();
    // useAuth keeps this mount's user (S8): the page shows the name the rename answered
    const [renamed, setRenamed] = useState<string | null>(null);
    const [renaming, setRenaming] = useState(false);
    const shownName = renamed ?? name;
    return (
        <>
            <Panel as="section" aria-labelledby={headingId} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h2 id={headingId} className="t-headline break-words">{t.landing.guest.continueAs(shownName)}</h2>
                    <p className="t-callout text-text-2">{gameId ? t.shell.activeGame.body : t.landing.guest.body}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                    {gameId && (
                        <Button leftIcon={<PixelIcon name="play" />} onClick={() => navigate(`/game/${gameId}`)}>
                            {t.shell.activeGame.action}
                        </Button>
                    )}
                    <Button variant="secondary" leftIcon={<PixelIcon name="user" />} onClick={() => setRenaming(true)}>
                        {t.landing.guest.rename}
                    </Button>
                </div>
            </Panel>
            <Sheet open={renaming} onClose={() => setRenaming(false)} title={t.landing.rename.title}>
                <RenameForm
                    current={shownName}
                    onRenamed={(next) => {
                        setRenamed(next);
                        setRenaming(false);
                    }}
                    onCancel={() => setRenaming(false)}
                />
            </Sheet>
        </>
    );
}

/** The guest's new name (spec §3.1): checked by the username rule first, then PATCH /user/me/guest-name (S8). */
function RenameForm({ current, onRenamed, onCancel }: { current: string; onRenamed: (name: string) => void; onCancel: () => void }) {
    const t = useT();
    const [value, setValue] = useState(current);
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    // stops a second submit that lands before React re-renders the button as disabled
    const sending = useRef(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (sending.current) return;
        // Ruling 35: checked in the form the server will see
        const next = value.trim().normalize('NFC');
        if (next === current) {
            onCancel();
            return;
        }
        const ruleError = usernameRuleError(next);
        setFieldError(ruleError);
        setSubmitError(null);
        if (ruleError) return;
        sending.current = true;
        setSaving(true);
        try {
            const response = await authService.renameGuest(next);
            // the server answers the name as it stored it (lower-cased)
            onRenamed(response.user?.username ?? next);
        } catch (e) {
            // no answer or a 5xx: its text is the browser's or Spring's, never shown as is
            setSubmitError(e instanceof ApiError && isNetworkOrServerFailure(e.status) ? cat().landing.rename.failed : errorMessage(e, cat().landing.rename.failed));
            setSaving(false);
        } finally {
            sending.current = false;
        }
    };

    // noValidate: the form shows its own errors; no maxLength, since a decomposed name is longer before NFC
    return (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <Input
                label={t.forms.username}
                value={value}
                onChange={(event) => {
                    setValue(event.target.value);
                    setFieldError(null);
                }}
                error={fieldError}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
            />
            <ErrorAlert message={submitError} />
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="quiet" onClick={onCancel} disabled={saving}>
                    {t.common.cancel}
                </Button>
                <Button type="submit" loading={saving}>
                    {t.landing.rename.save}
                </Button>
            </div>
        </form>
    );
}
