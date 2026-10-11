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
    /** A seat can take a bot (seats.ts `fillableSeats` > 0). */
    canFill?: boolean;
    filling?: boolean;
    joining?: boolean;
    privateLobby?: boolean;
    /** A member is following the started match into the game. */
    following?: boolean;
    onOptions?: () => void;
    onStart?: () => void;
    /** The host's "Fill with bots"; without it the button is not shown (a ranked lobby takes no bots). */
    onFill?: () => void;
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
                'material-bar sticky z-(--z-bar) -mx-4 flex min-h-[68px] flex-wrap items-center gap-3 px-4 py-3 md:mx-0',
                tabBar ? 'bottom-[calc(64px+var(--safe-bottom))]' : 'bottom-0 pb-[calc(12px+var(--safe-bottom))]',
            )}
        >
            <BarContent {...props} />
        </div>
    );
}

function BarContent(props: LobbyActionBarProps) {
    const { role, line, canStart = false, starting = false, canFill = false, filling = false, joining = false, privateLobby = false, following = false } = props;
    const { onOptions, onStart, onFill, onLeave, onJoin } = props;
    if (following) {
        return (
            <div role="status" className="flex-1">
                <Loader layout="inline" text="Opening the match…" />
            </div>
        );
    }
    if (role === 'host') {
        const start = (
            <Button className={cx(onFill && 'flex-1 md:flex-none')} leftIcon={<PixelIcon name="play" />} disabled={!canStart} loading={starting} onClick={onStart}>
                Start match
            </Button>
        );
        return (
            <>
                <IconButton icon="more" aria-label="Lobby options" variant="secondary" onClick={onOptions} />
                <p className="t-footnote min-w-0 flex-1 text-text-2">{line}</p>
                {onFill ? (
                    // on a phone the two buttons share a row of their own
                    <div className="flex w-full gap-2 md:w-auto">
                        <Button variant="secondary" className="flex-1 md:flex-none" leftIcon={<PixelIcon name="robot" />} disabled={!canFill} loading={filling} onClick={onFill}>
                            Fill with bots
                        </Button>
                        {start}
                    </div>
                ) : (
                    start
                )}
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
