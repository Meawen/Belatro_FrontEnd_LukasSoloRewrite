import type { CSSProperties } from 'react';
import { Avatar, Chip, PixelIcon, PlayingCard, Tag } from '../ui';
import { cx } from '../ui/cx';
import { handTrump } from '../board/model/hands';
import { SUIT_LABEL } from '../game/gameView';
import type { Boja } from '../../types/game';
import type { HandDTO, MatchDTO } from '../../types/match';
import { replayColumns, replayTricks, type ReplayCell, type ReplayColumn } from './trickReplay';
import './trickGrid.css';
import { useT } from '../../i18n/t';
import { displayName } from '../common/displayName';

const TINT = { A: 'mh-team-a', B: 'mh-team-b' } as const;
// a trump's ring around the card, in its suit's colour (spec §3.2 suit tokens)
const SUIT_RING: Record<Boja, string> = { HERC: 'var(--suit-herc)', KARA: 'var(--suit-karo)', PIK: 'var(--suit-pik)', TREF: 'var(--suit-tref)' };

/** A column's head: the avatar, the name, "YOU · TEAM A" / "TEAM B", tinted with the team's top edge. */
function ColumnHead({ column }: { column: ReplayColumn }) {
    const t = useT();
    const team = column.team ? t.common.teamCaps(column.team) : '';
    return (
        <div className={cx('mh-tile flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-center', column.team && TINT[column.team])}>
            <Avatar initial={displayName(column.player)} tone={column.team === 'A' ? 'team-a' : column.team === 'B' ? 'team-b' : 'neutral'} size="sm" />
            <span className="t-footnote w-full truncate font-semibold">{displayName(column.player)}</span>
            <span className="t-caption text-text-2">{column.me ? `${t.common.youCaps} · ${team}` : team}</span>
        </div>
    );
}

/** One player's card in one trick, or an outlined empty cell when they have none. */
function Cell({ cell, column, trump }: { cell: ReplayCell | null; column: ReplayColumn; trump: Boja | null }) {
    const t = useT();
    if (!cell) return <div data-testid="trick-cell" data-player={column.player} className="mh-tile mh-cell--empty" />;
    const ring = cell.trump && trump ? ({ '--mh-suit': SUIT_RING[trump] } as CSSProperties) : undefined;
    return (
        <div
            data-testid="trick-cell"
            data-player={cell.player}
            className={cx('mh-tile flex flex-col items-center gap-1.5 px-1 pb-2 pt-6', column.team && TINT[column.team], cell.won && 'mh-cell--won')}
        >
            <span title={t.matchDetails.playOrder} className="notch t-caption absolute left-1 top-1 grid h-[18px] min-w-[18px] place-items-center bg-ink px-[3px] text-text-2">
                {cell.order}
            </span>
            {cell.won && <PixelIcon name="crown" label={t.matchDetails.wonTrick} className="absolute right-1.5 top-1.5 text-accent" />}
            <span className={cx('mh-card', ring && 'mh-card--trump')} style={ring}>
                <PlayingCard card={cell.card} size="thumb" />
            </span>
            <span className="flex min-h-5 flex-wrap justify-center gap-1">
                {cell.trump && trump && (
                    <Tag tone="trump" suit={trump} className="mh-tag">
                        {t.matchDetails.trumpTag}
                    </Tag>
                )}
                {cell.illegal && (
                    <Tag tone="bad" className="mh-tag" title={t.matchDetails.illegalHint}>
                        {t.matchDetails.illegalTag}
                    </Tag>
                )}
            </span>
        </div>
    );
}

/**
 * Item 6, "Tricks played" (spec §4.9; D-31): the trump banner, the four players in seat order from me, one
 * row per trick with each card in its player's column, its play order, the winner's crown and gold cell ring,
 * a trump's suit ring and chip, ILLEGAL with its reason; the legend at the end.
 */
export function TricksPlayed({ hand, match, me }: { hand: HandDTO; match: MatchDTO; me: string | null }) {
    const trump = handTrump(hand);
    const columns = replayColumns(hand, match, me);
    const tricks = replayTricks(hand, columns);
    const t = useT();
    return (
        <section aria-label={t.matchDetails.tricksPlayed} className="notch bg-surface p-2 sm:p-3">
            <h3 className="t-caption mb-2 text-text-2">{t.matchDetails.tricksPlayed}</h3>
            {trump && (
                <Chip tone="trump" suit={trump} className="mb-2">
                    {t.matchDetails.trump(SUIT_LABEL[trump])}
                </Chip>
            )}
            <div className="mh-cols">
                {columns.map((column) => (
                    <ColumnHead key={column.player} column={column} />
                ))}
            </div>
            <ol className="flex flex-col gap-3">
                {tricks.map((trick) => (
                    <li key={trick.trickNo}>
                        <div role="group" aria-label={t.matchDetails.trick(trick.trickNo)}>
                            <div className="t-callout mb-1.5 flex flex-wrap items-center gap-2">
                                <span aria-hidden="true" className="notch t-caption grid size-[22px] place-items-center bg-surface-2">
                                    {trick.trickNo}
                                </span>
                                <span>{t.matchDetails.trick(trick.trickNo)}</span>
                                <span className="t-footnote text-text-3">({t.matchDetails.cardCount(trick.cards)})</span>
                                {trick.partial && <Tag tone="warn">{t.matchDetails.partial}</Tag>}
                            </div>
                            <div className="mh-plays">
                                {columns.map((column, i) => (
                                    <Cell key={column.player} cell={trick.cells[i]} column={column} trump={trump} />
                                ))}
                            </div>
                        </div>
                    </li>
                ))}
            </ol>
            <p className="t-footnote mt-3 text-text-3">{t.matchDetails.legend}</p>
        </section>
    );
}
