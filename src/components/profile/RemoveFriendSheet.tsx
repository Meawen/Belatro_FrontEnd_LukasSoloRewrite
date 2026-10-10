import { Button, Sheet } from '../ui';

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
    return (
        <Sheet open={open} onClose={onClose} title={`Remove ${name}?`} dismissible={!busy}>
            <p className="t-body text-text-2">Are you sure you want to remove {name} from your friends?</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={onClose} disabled={busy}>
                    Cancel
                </Button>
                <Button variant="danger" onClick={onConfirm} loading={busy}>
                    {`Remove ${name}`}
                </Button>
            </div>
        </Sheet>
    );
}
