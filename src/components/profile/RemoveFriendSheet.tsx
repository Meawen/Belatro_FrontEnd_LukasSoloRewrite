import { Button, Sheet } from '../ui';
import { useT } from '../../i18n/t';

export interface RemoveFriendSheetProps {
    open: boolean;
    /** The friend's username. */
    name: string;
    /** The removal is on its way: the sheet stays until it answers. */
    busy: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

/** "Remove {name}?" (spec §4.10, §4.11): today's confirm question, in a sheet instead of window.confirm. */
export function RemoveFriendSheet({ open, name, busy, onConfirm, onClose }: RemoveFriendSheetProps) {
    const t = useT();
    return (
        <Sheet open={open} onClose={onClose} title={t.friends.removeSheet.title(name)} dismissible={!busy}>
            <p className="t-body text-text-2">{t.friends.removeSheet.body(name)}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={onClose} disabled={busy}>
                    {t.common.cancel}
                </Button>
                <Button variant="danger" onClick={onConfirm} loading={busy}>
                    {t.friends.removeSheet.confirm(name)}
                </Button>
            </div>
        </Sheet>
    );
}
