import { Button, IconButton, Loader, PixelIcon } from '../ui';
import { cx } from '../ui/cx';
import { TAB_BAR_QUERY } from '../layout/nav';
import { useMediaQuery } from '../layout/useMediaQuery';

export type LobbyRole = 'host' | 'member' | 'outsider';

export interface LobbyActionBarProps {
    role: LobbyRole;
    /** The host's reason line (seats.ts `startReadiness`) or a member's status line (`memberStatus`). */
    line: string;
    /** 2 + 2 seated and nobody unassigned. */
    canStart?: boolean;
    starting?: boolean;
    joining?: boolean;
    privateLobby?: boolean;
    /** A member is following the started match into the game. */
    following?: boolean;
    onOptions?: () => void;
    onStart?: () => void;
    onLeave?: () => void;
    onJoin?: () => void;
}

/**
 * The lobby's action bar (spec §4.7): a material bar stuck to the bottom of the screen, above the phone tab bar
 * (64 px + the safe area), across the content column.
 */
export function LobbyActionBar(props: LobbyActionBarProps) {
    const tabBar = useMediaQuery(TAB_BAR_QUERY);
    return (
        <div
            role="region"
            aria-label="Lobby actions"
            className={cx(
                'material-bar sticky z-(--z-bar) -mx-4 flex min-h-[68px] items-center gap-3 px-4 py-3 md:mx-0',
                tabBar ? 'bottom-[calc(64px+var(--safe-bottom))]' : 'bottom-0 pb-[calc(12px+var(--safe-bottom))]',
            )}
        >
            <BarContent {...props} />
        </div>
    );
}

function BarContent({ role, line, canStart = false, starting = false, joining = false, privateLobby = false, following = false, onOptions, onStart, onLeave, onJoin }: LobbyActionBarProps) {
    if (following) {
        return (
            <div role="status" className="flex-1">
                <Loader layout="inline" text="Opening the match…" />
            </div>
        );
    }
    if (role === 'host') {
        return (
            <>
                <IconButton icon="more" aria-label="Lobby options" variant="secondary" onClick={onOptions} />
                <p className="t-footnote min-w-0 flex-1 text-text-2">{line}</p>
                <Button leftIcon={<PixelIcon name="play" />} disabled={!canStart} loading={starting} onClick={onStart}>
                    Start match
                </Button>
            </>
        );
    }
    if (role === 'member') {
        return (
            <>
                <p className="t-footnote min-w-0 flex-1 text-text-2">{line}</p>
                <Button variant="quiet" leftIcon={<PixelIcon name="door" />} onClick={onLeave}>
                    Leave
                </Button>
            </>
        );
    }
    return (
        <>
            <span className="flex-1" />
            <Button leftIcon={privateLobby ? <PixelIcon name="lock" /> : undefined} loading={joining} onClick={onJoin}>
                Join lobby
            </Button>
        </>
    );
}
