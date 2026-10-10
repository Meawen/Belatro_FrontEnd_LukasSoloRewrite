import { useEffect, useMemo, useState } from 'react';
import { MotionGlobalConfig } from 'motion/react';
import { Board } from '../components/board/Board';
import { NOTHING_ACCEPTED, acceptFrame, type Accepted } from '../components/board/model/accept';
import { endedHand } from '../components/board/model/hands';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import { Select } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import { MotionProvider } from '../motion/MotionProvider';
import { useTableEffects, writeTableEffects, type TableEffects } from '../settings/tableEffects';
import { LAYOUTS, SEATS, devHands, devStream, devTable, frameOf, parseDevOptions, resolveAt, type DevLayout, type DevOptions } from './devTable';
import type { GameActions } from '../hooks/useGameViews';
import type { MatchHands } from '../hooks/useMatchHands';
import type { RematchState } from '../hooks/useRematch';

const STEP_MS = 400;
const BAR = 56;
const SPEEDS = [0.5, 1, 2, 4];

/** Moves go nowhere: the table is a script. Each "goes out", so a played card lifts and waits. */
const ACTIONS: GameActions = { bidTrump: () => true, passBid: () => true, play: () => true, challenge: () => true };
const REMATCH: RematchState = { votes: 1, cancelledBy: null, expired: false, playAgain: () => {}, leave: () => {} };

/** The accepted state after a snapshot of fan-out `index` (the jump), and where the stream goes on from. */
function jumpTo(options: DevOptions, index: number, now: number) {
    const table = devTable(options, now, index);
    const stream = devStream(table, options.seat, options.chaos);
    const accepted = acceptFrame(NOTHING_ACCEPTED, frameOf({ channel: 'snapshot', body: table[index].private[options.seat] }), now);
    const cursor = stream.findIndex((step) => step.fanOut > index);
    return { table, stream, accepted, cursor: cursor < 0 ? stream.length : cursor, fanOut: index };
}

function fromStart(options: DevOptions, now: number) {
    const table = devTable(options, now, 0);
    return { table, stream: devStream(table, options.seat, options.chaos), accepted: NOTHING_ACCEPTED as Accepted, cursor: 0, fanOut: 0 };
}

function useWindowSize() {
    const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
    useEffect(() => {
        const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);
    return size;
}

/**
 * The dev board playground (spec §4.17, D-27): Phase 3's fixture sequences replayed through the real
 * board, frame by frame through the real acceptance rule. Built only in dev or with VITE_DEV_BOARD=1.
 */
export default function DevBoardPage() {
    const [options, setOptions] = useState<DevOptions>(() => {
        const parsed = parseDevOptions(window.location.search);
        MotionGlobalConfig.skipAnimations = parsed.skip;
        if (parsed.effects) writeTableEffects(parsed.effects);
        return parsed;
    });
    const [run, setRun] = useState(() => {
        const now = Date.now();
        const table = devTable(options, now, 0);
        const at = resolveAt(table, options.at);
        return options.at ? jumpTo(options, at, now) : fromStart(options, now);
    });
    const [playing, setPlaying] = useState(options.play);
    const [jump, setJump] = useState(String(run.fanOut));
    const [effects, setEffects] = useTableEffects();
    const windowSize = useWindowSize();

    const step = () => setRun((r) => {
        const next = r.stream[r.cursor];
        if (!next) return r;
        return { ...r, accepted: acceptFrame(r.accepted, frameOf(next.delivery), Date.now()), cursor: r.cursor + 1, fanOut: next.fanOut };
    });

    useEffect(() => {
        if (!playing) return;
        const timer = window.setInterval(step, STEP_MS / options.speed);
        return () => window.clearInterval(timer);
    }, [playing, options.speed]);

    useEffect(() => {
        if (run.cursor >= run.stream.length) setPlaying(false);
    }, [run.cursor, run.stream.length]);

    const restart = (next: DevOptions) => {
        setOptions(next);
        setRun(fromStart(next, Date.now()));
    };
    const doJump = () => setRun(jumpTo(options, resolveAt(run.table, jump), Date.now()));

    const state = run.accepted.state;
    const hands = useMemo<MatchHands>(() => {
        const stored = devHands(run.table, run.fanOut);
        const view = state?.publicView;
        const ended = view && (view.gameState === 'HAND_COMPLETE' || view.gameState === 'COMPLETED')
            ? endedHand(stored, { a: view.teamAScore, b: view.teamBScore })
            : null;
        return { hands: stored, ended, loading: false, error: null, refresh: () => {} };
    }, [run.table, run.fanOut, state]);

    const preset = options.layout === 'fit' ? null : options.layout.split('x').map(Number);
    const viewport = preset
        ? { width: preset[0], height: preset[1] }
        : options.controls ? { width: windowSize.width, height: Math.max(0, windowSize.height - BAR) } : undefined;
    const label = run.table[run.fanOut]?.label ?? '';

    return (
        <div className="min-h-dvh bg-bg text-text">
            {options.controls && (
                <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-surface t-footnote" style={{ minHeight: BAR }}>
                    <strong className="font-pix text-xl">Dev board</strong>
                    <Select label="Seat" hideLabel value={options.seat} options={SEATS.map((seat) => ({ value: seat, label: seat }))} onChange={(seat) => restart({ ...options, seat })} />
                    <Button size="sm" variant="secondary" onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</Button>
                    <Button size="sm" variant="secondary" onClick={step}>Step</Button>
                    <Select label="Speed" hideLabel value={String(options.speed)} options={SPEEDS.map((speed) => ({ value: String(speed), label: `${speed}×` }))} onChange={(speed) => setOptions({ ...options, speed: Number(speed) })} />
                    <Switch label="Chaos" checked={options.chaos} onChange={(chaos) => restart({ ...options, chaos })} />
                    <label className="inline-flex items-center gap-1">
                        <span>Jump to</span>
                        <input className="w-28 bg-surface-2 px-2 py-1 text-text" value={jump} onChange={(event) => setJump(event.target.value)} aria-label="Fan-out index or label" />
                    </label>
                    <Button size="sm" variant="secondary" onClick={doJump}>Jump</Button>
                    <Select label="Layout" hideLabel value={options.layout} options={LAYOUTS.map((layout) => ({ value: layout, label: layout }))} onChange={(layout) => setOptions({ ...options, layout: layout as DevLayout })} />
                    <Segmented<TableEffects> label="Effects" value={effects} options={[{ value: 'full', label: 'Full' }, { value: 'calm', label: 'Calm' }, { value: 'off', label: 'Off' }]} onChange={setEffects} />
                    <Switch label="Reduced motion" checked={options.reduced} onChange={(reduced) => setOptions({ ...options, reduced })} />
                    <span className="text-text-2">{`${run.fanOut}/${run.table.length - 1} ${label} · ${run.cursor}/${run.stream.length}`}</span>
                </div>
            )}
            {state ? (
                <div className={preset ? 'overflow-auto' : undefined}>
                    <MotionProvider reducedMotion={options.reduced ? 'always' : 'user'}>
                        <Board
                            key={`${options.seat}:${options.chaos}`}
                            state={state}
                            me={options.seat}
                            actions={ACTIONS}
                            error={null}
                            isConnected
                            hands={hands}
                            rematch={REMATCH}
                            onLeave={() => {}}
                            viewport={viewport}
                        />
                    </MotionProvider>
                </div>
            ) : (
                <p className="p-4 text-text-2">Press Play or Step: no frame has arrived yet.</p>
            )}
        </div>
    );
}
