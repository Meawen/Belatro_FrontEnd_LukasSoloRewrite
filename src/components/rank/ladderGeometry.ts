import type { Ladder, RankKey } from '../../types/user';
import { placedRanks } from './rankNames';

/** The ladder's frame around the plot, in CSS px (ranks spec §7.3): the "You" tag above, the ticks below. */
export const LADDER_PAD = { top: 26, bottom: 20, left: 28, right: 4 } as const;

/** Plot heights: 110 px in a container at least this wide, else 96 (owner 2026-10-11: a tighter ladder). */
export const WIDE_CHART = 768;

/** A caption character's width, for "does the name fit" (caption: 12 px, 600, upper case, +0.04em; measured). */
export const CAPTION_CHAR_PX = 8.5;

/** Ticks closer than this to the previous one are dropped. */
const TICK_GAP_PX = 36;

/** The smallest 1, 2 or 5 × 10ⁿ at or above n (at least 1). */
export function niceCeil(n: number): number {
    if (n <= 1) return 1;
    const power = 10 ** Math.floor(Math.log10(n));
    for (const step of [1, 2, 5, 10]) {
        if (step * power >= n) return step * power;
    }
    return 10 * power;
}

/** The placed rank a bin belongs to: the last one whose start is at or below the bin (Dečec has none). */
export function rankOfBin(from: number, ranks: Ladder['ranks']): RankKey {
    let key: RankKey = 'DECEC';
    for (const rank of ranks) {
        if (rank.key === 'CUCEK') continue;
        if (rank.minRating === null || rank.minRating <= from) key = rank.key;
    }
    return key;
}

/** "Ahead of {p}%": the players in lower bins plus half of your own bin, over every placed player (spec §7.3). */
export function aheadPercent(ladder: Ladder, elo: number): number {
    if (ladder.players <= 0) return 0;
    const mine = Math.floor(elo / ladder.binSize) * ladder.binSize;
    let below = 0;
    let own = 0;
    for (const bin of ladder.bins) {
        if (bin.from < mine) below += bin.count;
        else if (bin.from === mine) own = bin.count;
    }
    return Math.round((100 * (below + own / 2)) / ladder.players);
}

export interface LadderBar {
    from: number;
    count: number;
    key: RankKey;
    /** The bar. */
    x: number;
    y: number;
    w: number;
    h: number;
    /** Its slot: the hit area's left edge and width. */
    slotX: number;
    slotW: number;
}

export interface LadderGeometry {
    width: number;
    height: number;
    plot: { left: number; top: number; width: number; height: number };
    lo: number;
    hi: number;
    slot: number;
    yMax: number;
    /** x of a shown rating. */
    x: (rating: number) => number;
    bars: LadderBar[];
    bands: { key: RankKey; name: string; x0: number; x1: number; label: boolean }[];
    ticks: { value: number; x: number }[];
    grid: { value: number; y: number }[];
    you: { x: number } | null;
}

/** The ladder chart's geometry at a container width (ranks spec §7.3). */
export function ladderGeometry(ladder: Ladder, width: number, { you }: { you: number | null }): LadderGeometry {
    const { binSize } = ladder;
    const plot = {
        left: LADDER_PAD.left,
        top: LADDER_PAD.top,
        width: Math.max(1, width - LADDER_PAD.left - LADDER_PAD.right),
        height: width >= WIDE_CHART ? 110 : 96,
    };
    const yourBin = you === null ? null : Math.floor(you / binSize) * binSize;
    const starts = [...ladder.bins.map((bin) => bin.from), ...(yourBin === null ? [] : [yourBin])];
    const lo = starts.length ? Math.min(...starts) : 0;
    const hi = starts.length ? Math.max(...starts) + binSize : binSize;
    const slot = plot.width / ((hi - lo) / binSize);
    const x = (rating: number) => plot.left + ((rating - lo) / binSize) * slot;
    const yMax = niceCeil(Math.max(0, ...ladder.bins.map((bin) => bin.count)));
    const baseline = plot.top + plot.height;
    // each bar fills its slot, 2 px from the next (owner 2026-10-11)
    const barW = Math.max(1, slot - 2);

    const bars = ladder.bins.map((bin) => {
        const h = (bin.count / yMax) * plot.height;
        return {
            from: bin.from,
            count: bin.count,
            key: rankOfBin(bin.from, ladder.ranks),
            x: x(bin.from) + (slot - barW) / 2,
            y: baseline - h,
            w: barW,
            h,
            slotX: x(bin.from),
            slotW: slot,
        };
    });

    const youX = you === null ? null : x(you);
    const placed = placedRanks(ladder);
    const bands = placed.flatMap((rank, i) => {
        const start = Math.max(lo, rank.minRating ?? lo);
        const nextStart = placed[i + 1]?.minRating;
        const end = Math.min(hi, nextStart ?? hi);
        if (end <= start) return [];
        const x0 = x(start);
        const x1 = x(end);
        const labelW = rank.name.length * CAPTION_CHAR_PX + 8;
        // the name sits at the band's top left; the "You" line would cut through it there
        const crossed = youX !== null && youX >= x0 && youX <= x0 + labelW;
        return [{ key: rank.key, name: rank.name, x0, x1, label: x1 - x0 >= labelW && !crossed }];
    });

    const ticks: { value: number; x: number }[] = [];
    for (const rank of placed) {
        const value = rank.minRating;
        if (value === null || value <= lo || value >= hi) continue;
        const at = x(value);
        if (ticks.length && at - ticks[ticks.length - 1].x < TICK_GAP_PX) continue;
        ticks.push({ value, x: at });
    }

    const grid = (yMax >= 2 ? [yMax / 2, yMax] : [yMax]).map((value) => ({ value, y: baseline - (value / yMax) * plot.height }));

    return {
        width,
        height: LADDER_PAD.top + plot.height + LADDER_PAD.bottom,
        plot,
        lo,
        hi,
        slot,
        yMax,
        x,
        bars,
        bands,
        ticks,
        grid,
        you: you === null ? null : { x: Math.min(plot.left + plot.width, Math.max(plot.left, x(you))) },
    };
}
