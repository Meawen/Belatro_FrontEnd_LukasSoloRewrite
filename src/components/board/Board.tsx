import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { AnimatePresence, LazyMotion, domMax } from 'motion/react';
import { hold } from '../../motion/tokens';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { ErrorAlert } from '../common/ErrorAlert';
import { cardLabel } from '../game/gameView';
import { cx } from '../ui/cx';
import { Sheet } from '../ui/Sheet';
import { showToast } from '../ui/toastStore';
import { Arena } from './Arena';
import { BelaPrompt } from './BelaPrompt';
import { BidPanel } from './BidPanel';
import { BlokColumn, BlokTable, BLOK_HINT } from './BelaBlok';
import { EndSheet } from './EndSheet';
import { GameMenu } from './GameMenu';
import { HandResult } from './HandResult';
import { BackCard, SweepCard, TrickCard } from './Cards';
import { Hand } from './Hand';
import { Hud } from './Hud';
import { Peek } from './Peek';
import { Piles } from './Piles';
import { Seats } from './Seats';
import { Summary } from './Summary';
import { announce, seatName, toastFor } from './announce';
import { cardTargets, layoutFor, type Layout, type Targets } from './model/cardTargets';
import { answerBela, pendingUntil, pressBid, pressCard, unlock, type InputResult, type Move } from './model/input';
import { dropLeaving, emptyStage, landTrick, settleStage, shownPiles, stepStage, sweepHeld, tableTrick, withInput, type Stage } from './stage';
import { useBoardViewport } from './useBoardViewport';
import type { BoardState } from './model/accept';
import type { Boja } from '../../types/game';
import type { BoardModel, Team } from './model/boardModel';
import type { GameActions } from '../../hooks/useGameViews';
import type { MatchHands } from '../../hooks/useMatchHands';
import type { RematchState } from '../../hooks/useRematch';
import './board.css';

/** A recovered 4th card lands before its trick sweeps; a sweep or fade is over after this long. */
const LAND_MS = 350;
const GONE_MS = 800;

/** The hold, landing and sweep timers of the stage: they only decide when cards leave, never input (spec §5.5). */
function useStageTimers(stage: Stage, setStage: Dispatch<SetStateAction<Stage>>) {
    const timers = useRef(new Map<string, number>());
    useEffect(() => {
        const wanted = new Map<string, [number, (s: Stage) => Stage]>();
        const held = stage.held;
        if (held) wanted.set(`hold:${held.key}`, [hold.trick, (s) => sweepHeld(s, held.key)]);
        for (const one of stage.leaving) {
            if (one.at === 'table') wanted.set(`land:${one.key}`, [LAND_MS, (s) => landTrick(s, one.key)]);
            else wanted.set(`gone:${one.key}`, [GONE_MS, (s) => dropLeaving(s, one.key)]);
        }
        for (const [name, id] of timers.current) {
            if (wanted.has(name)) continue;
            window.clearTimeout(id);
            timers.current.delete(name);
        }
        for (const [name, [ms, run]] of wanted) {
            if (timers.current.has(name)) continue;
            timers.current.set(name, window.setTimeout(() => {
                timers.current.delete(name);
                setStage(run);
            }, ms));
        }
    }, [stage.held, stage.leaving, setStage]);
    useEffect(() => {
        const running = timers.current;
        return () => {
            running.forEach((id) => window.clearTimeout(id));
            running.clear();
        };
    }, []);
}

/** The trick region (spec §5.10): `trick-card` with `data-card` and `data-seat`, and the trick in words (§5.8). */
function TrickRegion({ stage, model, targets, reduced }: { stage: Stage; model: BoardModel; targets: Targets; reduced: boolean }) {
    const trick = tableTrick(stage);
    const instant = stage.events === null;
    const cards = (trick?.plays ?? []).map((play) => {
        const target = targets.cards[play.id];
        if (!target) return null;
        const entrance = stage.entrances[play.id] ?? null;
        return (
            <TrickCard
                key={reduced ? `${stage.deal}:${play.id}@trick` : `${stage.deal}:${play.id}`}
                card={play.card}
                id={play.id}
                playerId={play.playerId}
                layoutId={reduced ? undefined : `${stage.deal}:${play.id}`}
                target={target}
                entrance={entrance}
                from={entrance ? targets.anchors[entrance.from] ?? null : null}
                instant={instant}
                reduced={reduced}
                winner={trick!.complete && play.playerId === trick!.winnerId}
            />
        );
    });
    const words = trick && trick.plays.length > 0
        ? `Trick: ${trick.plays.map((play) => `${seatName(model, play.playerId)} ${cardLabel(play.card)}`).join(', ')}`
        : '';
    return (
        <div className="board-region board-trick">
            <p className="sr-only">{words}</p>
            {reduced ? <AnimatePresence>{cards}</AnimatePresence> : cards}
        </div>
    );
}

/** The sweep layer (spec §5.10): tricks on their way to a pile, or fading; no test ids. */
function SweepLayer({ stage, model, layout, targets, reduced }: { stage: Stage; model: BoardModel; layout: Layout; targets: Targets; reduced: boolean }) {
    const cards: ReactNode[] = [];
    for (const one of stage.leaving) {
        // under reduced motion a swept or faded trick just fades out of the trick region; only a landing shows here
        if (reduced && one.at !== 'table') continue;
        const slots = cardTargets({ ...model, hand: [], trick: one.trick }, layout).cards;
        one.trick.plays.forEach((play) => {
            const slot = slots[play.id];
            if (!slot) return;
            const entering = one.enter === play.id ? stage.entrances[play.id] ?? null : null;
            cards.push(
                <SweepCard
                    key={`${one.key}:${play.id}`}
                    card={play.card}
                    layoutId={one.at === 'fade' || reduced ? undefined : `${one.deal}:${play.id}`}
                    slot={slot}
                    pile={one.team ? targets.piles[one.team] : null}
                    order={play.order}
                    mode={one.at}
                    entrance={entering}
                    from={entering ? targets.anchors[entering.from] ?? null : null}
                    reduced={reduced}
                />,
            );
        });
    }
    return <div className="board-region board-sweep">{reduced ? <AnimatePresence>{cards}</AnimatePresence> : cards}</div>;
}

/** The opponents' hands: their backs, fanned per seat. */
function Backs({ stage, model, targets, reduced }: { stage: Stage; model: BoardModel; targets: Targets; reduced: boolean }) {
    const instant = stage.events === null;
    return (
        <div className="board-region board-backs">
            <AnimatePresence>
                {model.seats.filter((seat) => !seat.isMe).flatMap((seat) => Array.from({ length: seat.cardsLeft }, (_, i) => {
                    const key = `back:${seat.id}:${i}`;
                    const target = targets.cards[key];
                    if (!target) return null;
                    const entrance = stage.entrances[key] ?? null;
                    return (
                        <BackCard
                            key={reduced ? `${stage.deal}:${key}@${Math.round(target.left)},${Math.round(target.top)}` : `${stage.deal}:${key}`}
                            target={target}
                            entrance={entrance}
                            from={entrance ? targets.anchors[entrance.from] ?? null : null}
                            instant={instant}
                            reduced={reduced}
                        />
                    );
                }))}
            </AnimatePresence>
        </div>
    );
}

/** "Your turn" over my hand (spec §5.3.3 `your-turn`): only while I can bid or play, never in HAND_COMPLETE. */
function YourTurn({ model, targets, layout }: { model: BoardModel; targets: Targets; layout: Layout }) {
    if (!model.yourTurn) return null;
    const tops = model.hand.map((card) => targets.cards[card.id]?.top ?? layout.board.h);
    const top = (tops.length ? Math.min(...tops) : layout.board.h - layout.hand.h) - 40;
    return <span data-testid="your-turn" className="board-your-turn notch t-footnote font-semibold" style={{ top }}>Your turn</span>;
}

export interface BoardProps {
    /** The accepted state (useGameViews().view). */
    state: BoardState;
    /** The signed-in player's username (the backend's player id). */
    me: string;
    /** The game's moves; each returns false when the socket is down. */
    actions: GameActions;
    /** A rejected move or "Not sent — reconnecting" (R-30). */
    error: string | null;
    isConnected: boolean;
    /** The structured moves (useMatchHands): Bela Blok, the peek, the hand result. */
    hands?: MatchHands | null;
    /** The rematch after the game (R-45). Without it a finished game offers only the way back. */
    rematch?: RematchState;
    /** "Back to lobbies". */
    onLeave: () => void;
    /** A fixed size instead of the window: the dev board's layout presets. */
    viewport?: { width: number; height: number };
}

/**
 * The board (spec §5): renders the newest accepted state, derives every animation from the difference
 * to the previous one (stepStage), and snaps on a snapshot or an unexplainable change. Nothing here
 * waits for an animation: the timers only decide when finished tricks leave the table.
 */
export function Board(props: BoardProps) {
    const { state, me, actions, error, isConnected, hands, rematch, onLeave, viewport } = props;
    const [stage, setStage] = useState(() => emptyStage(me));
    let current = stage;
    if (stage.state !== state) {
        // a new accepted state: step now, so this very render shows it (no frame of the old one)
        current = stepStage(stage, state, Date.now());
        setStage(current);
    }
    useStageTimers(current, setStage);
    const latest = useRef(current);
    latest.current = current;

    // Input (spec §5.3.5): a press acts on the newest model at once; one move in flight. If it didn't go
    // out ("Not sent — reconnecting") the lock clears, so the player can try again.
    const send = (move: Move) => (move.kind === 'play' ? actions.play(move.card, move.declareBela) : move.trump ? actions.bidTrump(move.trump) : actions.passBid());
    const apply = (result: InputResult) => {
        const input = result.move && !send(result.move) ? unlock(result.input) : result.input;
        setStage((s) => withInput(s, input));
    };
    const onCard = (id: string) => apply(pressCard(latest.current.model!, latest.current.local.input, id, Date.now()));
    const onBela = (declareBela: boolean) => apply(answerBela(latest.current.model!, latest.current.local.input, declareBela, Date.now()));
    const onBid = (call: Boja | 'PASS') => apply(pressBid(latest.current.model!, latest.current.local.input, call, Date.now()));
    const closeBela = () => setStage((s) => withInput(s, { ...s.local.input, belaCardId: null }));

    // the menu, Bela Blok (a sheet on phones) and the peek; opening a panel of stored hands asks for fresh ones
    const [panel, setPanel] = useState<'menu' | 'blok' | 'peek' | null>(null);
    const open = (next: 'blok' | 'peek') => {
        hands?.refresh();
        setPanel(next);
    };
    const onPile = (team: Team) => {
        if (team === (latest.current.model?.myTeam ?? 'A')) open('peek');
        else showToast("You can only look at your team's tricks");
    };

    // one polite message per event (spec §5.8), and a toast for every challenge result (O-4)
    const [said, setSaid] = useState<{ seq: number; lines: string[] }>({ seq: 0, lines: [] });
    useEffect(() => {
        const events = current.events;
        if (!events || events.length === 0 || !current.model) return;
        const lines = announce(events, current.model, hands?.ended?.handNo ?? null);
        if (lines.length) setSaid({ seq: current.seq, lines });
        for (const event of events) {
            const toast = toastFor(event);
            if (toast) showToast(toast);
        }
        // once per step
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current.seq]);

    // the 2-s lift: the card drops back, the lock holds until the server answers (O-2)
    const liftEnds = pendingUntil(current.local.input);
    useEffect(() => {
        if (liftEnds === null) return;
        const timer = window.setTimeout(() => setStage((s) => settleStage(s, Date.now())), Math.max(0, liftEnds - Date.now()));
        return () => window.clearTimeout(timer);
    }, [liftEnds]);

    // a reconnect: a move sent before the drop may be lost, so nothing stays locked
    const wasConnected = useRef(isConnected);
    useEffect(() => {
        if (isConnected && !wasConnected.current) setStage((s) => withInput(s, unlock(s.local.input)));
        wasConnected.current = isConnected;
    }, [isConnected]);
    const reduced = useReducedMotion();
    const box = useBoardViewport(viewport);
    const layout = useMemo(() => layoutFor(box.viewport), [box.viewport]);
    const model = current.model!;
    const targets = useMemo(() => cardTargets(model, layout), [model, layout]);
    const instant = current.events === null;
    const piles = shownPiles(current);
    const called = current.events?.find((event) => event.type === 'TrumpCalled');

    return (
        <LazyMotion features={domMax}>
            <section
                aria-label="Game table"
                className={cx('board', viewport ? 'board--framed' : 'board--screen')}
                data-layout={layout.kind}
                data-phase={model.phase}
                style={viewport ? { width: viewport.width, height: viewport.height } : undefined}
            >
                <Arena season={model.season} burst={current.calls} instant={instant} calm={model.finished} />
                <div className="board-stage" style={{ left: box.insets.left, top: box.insets.top, width: box.viewport.width, height: box.viewport.height }}>
                    <div className="board-area" style={{ left: layout.board.x, top: layout.board.y, width: layout.board.w, height: layout.board.h }}>
                        <Backs stage={current} model={model} targets={targets} reduced={reduced} />
                        {piles && <Piles counts={piles} targets={targets} myTeam={model.myTeam ?? 'A'} onTap={onPile} />}
                        <TrickRegion stage={current} model={model} targets={targets} reduced={reduced} />
                        <Hand cards={model.hand} targets={targets} deal={current.deal} entrances={current.entrances} instant={instant} reduced={reduced} onPress={onCard} />
                        <Seats model={model} targets={targets} layout={layout} instant={instant} />
                        <YourTurn model={model} targets={targets} layout={layout} />
                        <BidPanel model={model} onBid={onBid} />
                        {model.belaPrompt && targets.cards[model.belaPrompt.id] && (
                            <BelaPrompt card={model.belaPrompt} target={targets.cards[model.belaPrompt.id]} onAnswer={onBela} onDismiss={closeBela} />
                        )}
                        <SweepLayer stage={current} model={model} layout={layout} targets={targets} reduced={reduced} />
                        <Hud model={model} instant={instant} calledBy={called?.type === 'TrumpCalled' ? called.playerId : null} calls={current.calls} onChallenge={actions.challenge}
                            onMenu={() => setPanel('menu')} onBlok={layout.blok ? null : () => open('blok')} />
                        {error && <div className="board-error"><ErrorAlert message={error} /></div>}
                    </div>
                    {layout.blok && <BlokColumn model={model} hands={hands} />}
                </div>
                <Summary model={model} />
                {/* both rise once the last trick has left the table (spec §5.3.4 HandCompleted, Ended) */}
                <HandResult model={model} open={model.handComplete && current.held === null} hands={hands} delta={current.handDelta} onChallenge={actions.challenge} />
                <EndSheet model={model} open={model.end !== null && current.held === null} rematch={rematch} onLeave={onLeave} />
                <GameMenu model={model} open={panel === 'menu'} onClose={() => setPanel(null)} onBlok={layout.blok ? null : () => open('blok')} />
                <Sheet open={panel === 'blok' && !layout.blok} onClose={() => setPanel(null)} title="Bela Blok" showClose data-testid="bela-blok">
                    <BlokTable model={model} hands={hands} />
                    <p className="t-footnote text-text-3 mt-3">{BLOK_HINT}</p>
                </Sheet>
                <Peek model={model} hands={hands} open={panel === 'peek'} onClose={() => setPanel(null)} />
                <div role="log" aria-live="polite" className="sr-only">
                    {said.lines.map((line, i) => <p key={`${said.seq}:${i}`}>{line}</p>)}
                </div>
            </section>
        </LazyMotion>
    );
}
