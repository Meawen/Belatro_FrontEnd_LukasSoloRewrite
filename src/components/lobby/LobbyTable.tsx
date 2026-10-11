import { useEffect, useRef } from 'react';
import { LazyMotion, domMax, m } from 'motion/react';
import type { LobbyDTO } from '../../types/lobby';
import { Avatar, Button, PixelIcon } from '../ui';
import { cx } from '../ui/cx';
import { fade, spring } from '../../motion/tokens';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { countLine, isBot } from './lobbyModel';
import { canAddBot, isHost, isReadyToStart, seatAction, seatLabel, seatedCount, tableSeats, takesBots, type SeatKey, type SeatPosition, type TableSeat } from './seats';

/**
 * The request running at the table: a seat's join, switch or bot, and what that seat reads meanwhile ("Joining…",
 * "Switching…", "Adding…"); a null key is about no one seat ("Fill with bots"). Either way nothing at the table takes a
 * tap, and everything but that seat shows disabled.
 */
export interface SeatBusy {
    key: SeatKey | null;
    label: string;
}

export interface LobbyTableProps {
    lobby: LobbyDTO;
    /** The signed-in user's id; null before the session is read. */
    viewerId: string | null;
    /** The quick-look's static copy at 60 %: no buttons and no motion; its centre counts people, then bots (`countLine`). */
    mini?: boolean;
    busy?: SeatBusy | null;
    /** A tap on a seat that has an action (seats.ts `seatAction`); the others are aria-disabled. */
    onSeat?: (seat: TableSeat) => void;
    /** The host's "+ Bot" chip on an empty seat (seats.ts `canAddBot`), a button apart from the seat's own tap; without it, no chip. */
    onAddBot?: (seat: TableSeat) => void;
    /** The match is starting: the table grows while the page goes to the game (spec §4.7 Motion). */
    launching?: boolean;
}

/**
 * Where each seat's column is anchored: the top one at the top, the bottom one at the bottom (it grows upwards), the
 * sides centred. The host's "+ Bot" is always the last line of its seat's column, centred under the name plate.
 */
const PLACE: Record<SeatPosition, string> = {
    top: 'left-1/2 top-5 -translate-x-1/2',
    bottom: 'bottom-5 left-1/2 -translate-x-1/2',
    left: 'left-3.5 top-1/2 -translate-y-1/2',
    right: 'right-3.5 top-1/2 -translate-y-1/2',
};

const PLACE_MINI: Record<SeatPosition, string> = {
    top: 'left-1/2 top-2 -translate-x-1/2',
    bottom: 'bottom-2 left-1/2 -translate-x-1/2',
    left: 'left-2 top-1/2 -translate-y-1/2',
    right: 'right-2 top-1/2 -translate-y-1/2',
};

/**
 * The lobby table (spec §4.7, D-18): a felt with a wooden rim and four seats in the board's geometry. Seats
 * glide to their new place when a poll moves someone (a Motion layoutId per username), a newcomer scales
 * in; under reduced motion they fade instead.
 */
export function LobbyTable({ lobby, viewerId, mini = false, busy = null, onSeat, onAddBot, launching = false }: LobbyTableProps) {
    const reduced = useReducedMotion();
    const seats = tableSeats(lobby, viewerId);
    // who was seated at the last render: someone new scales in; nobody does on the first render
    const known = useRef<Set<string> | null>(null);
    const names = seats.flatMap((seat) => (seat.player?.username ? [seat.player.username] : []));
    useEffect(() => {
        known.current = new Set(names);
    });
    const arrived = (name: string) => known.current !== null && !known.current.has(name);
    // a phone's felt is 330 px; the host's, in a lobby that takes bots, 348 for the "+ Bot" lines between the top and
    // bottom seats and the count. Neither changes in a lobby's life, so the table never jumps.
    const felt = mini ? 'h-[198px] md:h-[252px]' : isHost(lobby, viewerId) && takesBots(lobby) ? 'h-[348px] md:h-[420px]' : 'h-[330px] md:h-[420px]';

    return (
        <LazyMotion features={domMax}>
            <m.div
                data-testid="lobby-table"
                className={cx('felt notch-6 relative', felt)}
                animate={{ scale: launching && !reduced ? 1.06 : 1 }}
                transition={spring.felt}
            >
                <div
                    aria-hidden="true"
                    className="notch-6 pointer-events-none absolute inset-0 shadow-[inset_0_0_0_6px_var(--rim),inset_0_0_0_9px_var(--rim-hi)]"
                />
                {seats.map((seat) => (
                    <div
                        key={seat.position}
                        data-position={seat.position}
                        className={cx('absolute', mini ? PLACE_MINI[seat.position] : `flex flex-col items-center gap-1 ${PLACE[seat.position]}`)}
                    >
                        {mini ? (
                            <div className="flex w-24 flex-col items-center gap-1">
                                <SeatFace seat={seat} lobby={lobby} viewerId={viewerId} canSit={false} pressable={false} mini />
                            </div>
                        ) : (
                            <>
                                <Seat
                                    key={seat.player?.username ?? `open-${seat.key}`}
                                    seat={seat}
                                    lobby={lobby}
                                    viewerId={viewerId}
                                    busy={busy}
                                    onSeat={onSeat}
                                    arrived={seat.player?.username ? arrived(seat.player.username) : false}
                                    reduced={reduced}
                                />
                                {onAddBot && canAddBot(seat, lobby, viewerId) && <BotChip seat={seat} busy={busy !== null} onAddBot={onAddBot} />}
                            </>
                        )}
                    </div>
                ))}
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    {mini ? (
                        // the quick-look asks "is there room for me?": people of the cap, then bots, as the list says
                        <p className="t-callout whitespace-nowrap font-semibold tabular-nums">{countLine(lobby)}</p>
                    ) : (
                        // the room counts seats, bots included: what the host needs to start
                        <>
                            <p className="t-score tabular-nums">{seatedCount(lobby)}/4</p>
                            <p className="t-footnote">{isReadyToStart(lobby) ? 'Ready to deal' : 'seated'}</p>
                        </>
                    )}
                </div>
            </m.div>
        </LazyMotion>
    );
}

interface SeatProps {
    seat: TableSeat;
    lobby: LobbyDTO;
    viewerId: string | null;
    busy: SeatBusy | null;
    onSeat?: (seat: TableSeat) => void;
    arrived: boolean;
    reduced: boolean;
}

function Seat({ seat, lobby, viewerId, busy, onSeat, arrived, reduced }: SeatProps) {
    const action = seatAction(seat, lobby, viewerId);
    const inFlight = busy !== null && busy.key === seat.key;
    // while another request runs: the site's disabled look (0.45, no press); `!` because Motion holds the opacity inline
    const dimmed = busy !== null && !inFlight;
    const name = seat.player?.username;
    // FLIP keyed by username: a player who moves seat glides there (spring.ui); reduced motion fades
    const motion = reduced
        ? { initial: { opacity: 0 }, transition: fade }
        : { layoutId: name ? `lobby-seat-${name}` : undefined, initial: arrived ? { opacity: 0, scale: 0.7 } : false, transition: spring.ui };
    return (
        <m.button
            type="button"
            aria-label={inFlight ? busy.label : seatLabel(seat, lobby, viewerId)}
            aria-busy={inFlight || undefined}
            aria-disabled={action === null || dimmed || undefined}
            onClick={() => {
                if (action !== null && busy === null) onSeat?.(seat);
            }}
            className={cx('group flex w-[92px] flex-col items-center gap-1.5 text-text', dimmed ? 'cursor-not-allowed opacity-45!' : action === null && 'cursor-default')}
            animate={{ opacity: 1, scale: 1 }}
            {...motion}
        >
            <SeatFace seat={seat} lobby={lobby} viewerId={viewerId} canSit={action === 'sit'} pressable={action !== null && busy === null} busyLabel={inFlight ? busy.label : undefined} />
        </m.button>
    );
}

/**
 * The host's "+ Bot" on an empty seat: its own button, named for the team it seats the bot on, led by that team's 6-px
 * square as on the board's plates. It paints 26 px, the board plate's height, so the top and bottom seats' chips keep
 * clear of the centre's count; its tap box reaches 44 px above and below without taking layout height.
 */
function BotChip({ seat, busy, onAddBot }: { seat: TableSeat; busy: boolean; onAddBot: (seat: TableSeat) => void }) {
    return (
        <Button
            variant="secondary"
            size="sm"
            aria-label={`Add a bot to team ${seat.team}`}
            disabled={busy}
            onClick={() => onAddBot(seat)}
            className="h-6.5 min-h-0 whitespace-nowrap [--btn-inset:0] after:absolute after:inset-x-0 after:-inset-y-[9px]"
            leftIcon={
                <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className={cx('size-1.5', seat.team === 'A' ? 'bg-team-a' : 'bg-team-b')} />
                    <PixelIcon name="robot" />
                </span>
            }
        >
            Bot
        </Button>
    );
}

interface SeatFaceProps {
    seat: TableSeat;
    lobby: LobbyDTO;
    viewerId: string | null;
    canSit: boolean;
    pressable: boolean;
    busyLabel?: string;
    mini?: boolean;
}

/**
 * A 52-px tile in the team colour (the host's crown above; a bot's robot in place of the initial) or a notched outline
 * with a plus, then the name plate.
 */
function SeatFace({ seat, lobby, viewerId, canSit, pressable, busyLabel, mini = false }: SeatFaceProps) {
    const player = seat.player;
    const own = player !== null && viewerId !== null && player.id === viewerId;
    const host = player !== null && isHost(lobby, player.id);
    const bot = isBot(player);
    const title = busyLabel ?? (player ? (player.username ?? 'Unknown') : canSit ? 'Sit here' : 'Open seat');
    const tag = own ? 'You' : host ? 'Host' : bot ? 'Bot' : `Team ${seat.team}`;
    return (
        <>
            <span className={cx('relative inline-flex', pressable && 'transition-transform duration-[90ms] ease-out group-active:translate-y-0.5')}>
                {host && <PixelIcon name="crown" className="absolute -top-3 left-1/2 z-[1] -translate-x-1/2 text-accent" />}
                {player ? (
                    <Avatar
                        initial={player.username ?? '?'}
                        icon={bot ? 'robot' : undefined}
                        tone={seat.team === 'A' ? 'team-a' : 'team-b'}
                        size={mini ? 'sm' : 'lg'}
                    />
                ) : (
                    <span
                        aria-hidden="true"
                        className={cx(
                            'notch grid place-items-center bg-bg/50',
                            mini ? 'size-7' : 'size-13',
                            canSit ? 'text-accent shadow-[inset_0_0_0_2px_var(--accent)]' : 'text-text shadow-[inset_0_0_0_2px_var(--text)]',
                        )}
                    >
                        <PixelIcon name="plus" />
                    </span>
                )}
            </span>
            <span className="ink-chip notch flex max-w-full flex-col items-center px-2 py-0.5">
                <span className={cx('t-footnote max-w-full truncate font-semibold', canSit && 'text-accent')}>{title}</span>
                {!mini && <span className={cx('t-caption', own ? 'text-accent' : 'text-text-2')}>{tag}</span>}
            </span>
        </>
    );
}
