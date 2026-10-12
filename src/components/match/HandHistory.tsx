import { useState } from 'react';
import { Panel, PixelIcon, Tag } from '../ui';
import { cx } from '../ui/cx';
import { BOJE, SUIT_LABEL } from '../game/gameView';
import type { ChallengeDTO, HandDTO, HandSummary, MatchDTO, TrumpCallDTO } from '../../types/match';
import { PlayerChip } from './PlayerChip';
import { TricksPlayed } from './TricksPlayed';
import { teamOfPlayer } from './trickReplay';

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A bid as a chip: the suit called, in its suit's colour (spec §3.2 suit chips); anything else as written, e.g. PASS. */
export function CallTag({ call }: { call: string | null }) {
    const suit = BOJE.find((boja) => boja === call);
    if (suit) {
        return (
            <Tag tone="trump" suit={suit}>
                {SUIT_LABEL[suit]}
            </Tag>
        );
    }
    return <Tag>{call || 'Unknown'}</Tag>;
}

/** A hand's fouls: only `legal === false` counts (R-16: null means "not known yet"). */
function illegalCount(hand: HandDTO): number {
    return (hand.tricks ?? []).reduce((count, trick) => count + (trick.moves ?? []).filter((move) => move.legal === false).length, 0);
}

/** Item 6, "Hand summary": each team's points (with declarations), tricks, trump calls, CAPOT, HAND AWARDED (PADANJE). */
function HandSummaryBox({ hand, summary }: { hand: HandDTO; summary: HandSummary }) {
    return (
        <section aria-label="Hand summary" className="notch bg-surface p-3">
            <h3 className="t-caption mb-2 text-text-2">Hand summary</h3>
            <div className="t-callout grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                <span className="text-team-a">
                    Team A: {summary.teamAPoints} pts{summary.teamADeclPoints > 0 && ` (${summary.teamADeclPoints} decl)`}
                </span>
                <span className="text-team-b">
                    Team B: {summary.teamBPoints} pts{summary.teamBDeclPoints > 0 && ` (${summary.teamBDeclPoints} decl)`}
                </span>
                <span className="text-text-2">Tricks: {hand.tricks?.length || 0}</span>
                <span className="text-text-2">Trump calls: {hand.trumpCalls?.length || 0}</span>
            </div>
            {(summary.capot || summary.padanje) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {summary.capot && <Tag tone="mode">CAPOT</Tag>}
                    {summary.padanje && <Tag tone="warn">HAND AWARDED (PADANJE)</Tag>}
                </div>
            )}
        </section>
    );
}

// A call's row carries its team's colour on the left edge
const TEAM_EDGE = { A: 'shadow-[inset_3px_0_0_var(--team-a)]', B: 'shadow-[inset_3px_0_0_var(--team-b)]' } as const;

/** Item 6, "Trump declarations": who said what, PASS or the suit. */
function Declarations({ calls, match, me }: { calls: TrumpCallDTO[]; match: MatchDTO; me: string | null }) {
    return (
        <section aria-label="Trump declarations" className="notch bg-surface p-3">
            <h3 className="t-caption mb-2 text-text-2">Trump declarations</h3>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {calls.map((call, i) => {
                    const team = teamOfPlayer(match, call.player);
                    return (
                        <li key={i} className={cx('notch t-callout flex items-center justify-between gap-2 bg-bg px-2.5 py-2', team && TEAM_EDGE[team])}>
                            <PlayerChip player={call.player} match={match} me={me} />
                            <CallTag call={call.trump} />
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/** Item 6, "Challenges": who challenged, and whether it held. */
function Challenges({ challenges, match, me }: { challenges: ChallengeDTO[]; match: MatchDTO; me: string | null }) {
    return (
        <section aria-label="Challenges" className="notch bg-surface p-3">
            <h3 className="t-caption mb-2 text-text-2">Challenges</h3>
            <ul className="flex flex-col gap-1.5">
                {challenges.map((challenge, i) => (
                    <li key={i} className="notch t-callout flex items-center justify-between gap-2 bg-bg px-2.5 py-2">
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className={cx('notch grid size-7 shrink-0 place-items-center', challenge.success ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger-text')}>
                                <PixelIcon name={challenge.success ? 'check' : 'x'} />
                            </span>
                            <span>Challenge by</span>
                            <PlayerChip player={challenge.player} match={match} me={me} />
                        </span>
                        <Tag tone={challenge.success ? 'win' : 'bad'}>{challenge.success ? 'SUCCESS' : 'FAIL'}</Tag>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/** Item 5: one hand's row, and its details while it is open. */
function HandRow({ hand, index, match, me }: { hand: HandDTO; index: number; match: MatchDTO; me: string | null }) {
    const [open, setOpen] = useState(false);
    const number = hand.handNo || index + 1;
    const summary = hand.handSummary;
    const calls = hand.trumpCalls ?? [];
    const illegal = illegalCount(hand);
    // the row's text would run together ("Hand 1PADANJE…"): its name says the same with commas
    const name = [
        `Hand ${number}`,
        summary?.padanje && 'PADANJE',
        illegal > 0 && `${illegal} ILLEGAL`,
        summary && `${summary.finalScoreA || 0} - ${summary.finalScoreB || 0}`,
    ].filter(Boolean).join(', ');
    return (
        <li className="notch bg-bg">
            <button
                type="button"
                aria-expanded={open}
                aria-label={name}
                onClick={() => setOpen(!open)}
                className="press focus-inside flex min-h-14 w-full items-center gap-3 p-3 text-left"
            >
                <span aria-hidden="true" className="notch t-caption grid size-8 shrink-0 place-items-center bg-surface-2">
                    {number}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="t-headline flex flex-wrap items-center gap-1.5">
                        Hand {number}
                        {summary?.padanje && <Tag tone="warn">PADANJE</Tag>}
                        {illegal > 0 && <Tag tone="bad">{illegal} ILLEGAL</Tag>}
                    </span>
                    {summary && (
                        <span className="t-score tabular-nums text-text-2">
                            {summary.finalScoreA || 0} - {summary.finalScoreB || 0}
                        </span>
                    )}
                </span>
                {calls.length > 0 && (
                    <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                        {calls.slice(0, 2).map((call, i) => (
                            <CallTag key={i} call={call.trump} />
                        ))}
                        {calls.length > 2 && <span className="t-footnote text-text-3">+{calls.length - 2}</span>}
                    </span>
                )}
                <PixelIcon name="chevron" className={cx('shrink-0 text-text-3 motion-safe:transition-transform', open && 'rotate-90')} />
            </button>
            {open && (
                <div className="flex flex-col gap-2 px-2 pb-3 sm:px-3">
                    {summary && <HandSummaryBox hand={hand} summary={summary} />}
                    {calls.length > 0 && <Declarations calls={calls} match={match} me={me} />}
                    {(hand.challenges ?? []).length > 0 && <Challenges challenges={hand.challenges ?? []} match={match} me={me} />}
                    {(hand.tricks ?? []).length > 0 && <TricksPlayed hand={hand} match={match} me={me} />}
                </div>
            )}
        </li>
    );
}

/** Item 5: "Game history ({n} hands)", one collapsible row per hand (spec §4.9); `me` is my username. */
export function HandHistory({ hands, match, me }: { hands: HandDTO[]; match: MatchDTO; me: string | null }) {
    return (
        <Panel as="section" aria-label="Game history" padding="none" className="p-3 sm:p-4">
            <h2 className="t-title mb-3">
                Game history <span className="t-footnote text-text-3">({counted(hands.length, 'hand', 'hands')})</span>
            </h2>
            <ul className="flex flex-col gap-2">
                {hands.map((hand, index) => (
                    <HandRow key={index} hand={hand} index={index} match={match} me={me} />
                ))}
            </ul>
        </Panel>
    );
}
