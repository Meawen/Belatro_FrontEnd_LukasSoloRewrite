import { useRef, useState, type FormEvent, type RefObject } from 'react';
import { Button, Input, PixelIcon, Sheet, type IconName } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { errorMessage } from '../../utils/errorMessage';
import { useT } from '../../i18n/t';

/** One request at a time from a sheet: busy while it runs; a refusal is shown with the server's text. */
function useSheetAction(fallback: string) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (e) {
            setError(errorMessage(e, fallback));
        } finally {
            setBusy(false);
        }
    };
    return { busy, error, run };
}

export interface ConfirmSheetProps {
    open: boolean;
    onClose: () => void;
    title: string;
    body: string;
    /** The confirm button's own name, unique on the page while the sheet is open (spec §4.7). */
    confirmLabel: string;
    confirmIcon: IconName;
    cancelLabel?: string;
    /** The request; when it fails the sheet stays open with the server's message. */
    onConfirm: () => Promise<unknown>;
    /** Shown when a failure carries no message of its own. */
    fallbackError: string;
}

/** A confirmation in a sheet instead of window.confirm (spec §4.7). Focus starts on Cancel. */
export function ConfirmSheet({ open, onClose, title, ...body }: ConfirmSheetProps) {
    const cancel = useRef<HTMLButtonElement>(null);
    return (
        <Sheet open={open} onClose={onClose} title={title} initialFocus={cancel}>
            <ConfirmBody {...body} onClose={onClose} cancelRef={cancel} />
        </Sheet>
    );
}

type ConfirmBodyProps = Omit<ConfirmSheetProps, 'open' | 'title'> & { cancelRef: RefObject<HTMLButtonElement | null> };

function ConfirmBody({ body, confirmLabel, confirmIcon, cancelLabel, onConfirm, fallbackError, onClose, cancelRef }: ConfirmBodyProps) {
    const t = useT();
    const { busy, error, run } = useSheetAction(fallbackError);
    return (
        <div className="flex flex-col gap-4">
            <p className="t-body text-text-2">{body}</p>
            <ErrorAlert message={error} />
            <div className="flex flex-col gap-2">
                <Button variant="danger" block leftIcon={<PixelIcon name={confirmIcon} />} loading={busy} onClick={() => void run(onConfirm)}>
                    {confirmLabel}
                </Button>
                <Button ref={cancelRef} variant="quiet" block onClick={onClose}>
                    {cancelLabel ?? t.common.cancel}
                </Button>
            </div>
        </div>
    );
}

export interface SeatSheetProps {
    open: boolean;
    onClose: () => void;
    /** False for the host: the server refuses a leaving host (spec §4.7, AC 12). */
    canLeave: boolean;
    onStandUp: () => void;
    onLeave: () => Promise<unknown>;
}

/** The viewer's own seat: stand up ('U'), or leave the lobby. */
export function SeatSheet({ open, onClose, ...rest }: SeatSheetProps) {
    const t = useT();
    return (
        <Sheet open={open} onClose={onClose} title={t.table.seatSheet.title}>
            <SeatBody {...rest} onClose={onClose} />
        </Sheet>
    );
}

function SeatBody({ canLeave, onStandUp, onLeave, onClose }: Omit<SeatSheetProps, 'open'>) {
    const t = useT();
    const { busy, error, run } = useSheetAction(t.table.failed.leave);
    return (
        <div className="flex flex-col gap-4">
            <p className="t-body text-text-2">{canLeave ? t.table.seatSheet.bodyLeave : t.table.seatSheet.body}</p>
            <ErrorAlert message={error} />
            <div className="flex flex-col gap-2">
                <Button variant="secondary" block disabled={busy} onClick={onStandUp}>
                    {t.table.seatSheet.standUp}
                </Button>
                {canLeave && (
                    <Button variant="danger" block leftIcon={<PixelIcon name="door" />} loading={busy} onClick={() => void run(onLeave)}>
                        {t.table.leave}
                    </Button>
                )}
                <Button variant="quiet" block onClick={onClose}>
                    {t.common.cancel}
                </Button>
            </div>
        </div>
    );
}

export interface OptionsSheetProps {
    open: boolean;
    onClose: () => void;
    onCopy: () => void;
    /** Closes this sheet and asks "Close this lobby?" in its own. */
    onCloseLobby: () => void;
}

/** The host's options (spec §4.7). */
export function OptionsSheet({ open, onClose, onCopy, onCloseLobby }: OptionsSheetProps) {
    const t = useT();
    return (
        <Sheet open={open} onClose={onClose} title={t.table.options}>
            <div className="flex flex-col gap-4">
                <p className="t-body text-text-2">{t.table.optionsBody}</p>
                <div className="flex flex-col gap-2">
                    <Button variant="secondary" block leftIcon={<PixelIcon name="link" />} onClick={onCopy}>
                        {t.table.copyInvite}
                    </Button>
                    <Button variant="danger" block leftIcon={<PixelIcon name="trash" />} onClick={onCloseLobby}>
                        {t.table.close}
                    </Button>
                    <Button variant="quiet" block onClick={onClose}>
                        {t.common.cancel}
                    </Button>
                </div>
            </div>
        </Sheet>
    );
}

export interface PasswordSheetProps {
    open: boolean;
    onClose: () => void;
    /** POST /lobbies/join with this password; a refusal is shown and the field cleared. */
    onJoin: (password: string) => Promise<unknown>;
}

/** An outsider joining a private lobby from its page (spec §4.7): the submit reads "Join". */
export function PasswordSheet({ open, onClose, onJoin }: PasswordSheetProps) {
    const t = useT();
    return (
        <Sheet open={open} onClose={onClose} title={t.tables.privateTable}>
            <PasswordBody onClose={onClose} onJoin={onJoin} />
        </Sheet>
    );
}

function PasswordBody({ onClose, onJoin }: Omit<PasswordSheetProps, 'open'>) {
    const [password, setPassword] = useState('');
    const t = useT();
    const { busy, error, run } = useSheetAction(t.table.failed.join);
    const submit = (event: FormEvent) => {
        event.preventDefault();
        void run(async () => {
            try {
                await onJoin(password);
            } catch (e) {
                setPassword('');
                throw e;
            }
        });
    };
    return (
        <form onSubmit={submit} className="flex flex-col gap-4">
            <p className="t-body text-text-2">{t.table.passwordBody}</p>
            <Input label={t.forms.password} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" />
            <ErrorAlert message={error} />
            <div className="flex flex-col gap-2">
                <Button type="submit" block leftIcon={<PixelIcon name="lock" />} loading={busy}>
                    {t.table.passwordSubmit}
                </Button>
                <Button variant="quiet" block onClick={onClose}>
                    {t.common.cancel}
                </Button>
            </div>
        </form>
    );
}
