import type { Ladder, PlayerRank, RankKey, RatingHistory } from '../../types/user';
import { FORECAST_GAMES } from './forecastText';
import { WIDE_CHART } from './ladderGeometry';
import { placedRanks } from './rankNames';

export { FORECAST_GAMES };

/** Your climb's frame around the plot, in CSS px (ranks spec §8.3). */
export const CLIMB_PAD = { top: 10, bottom: 20, left: 36, right: 8 } as const;

/** Rating padding around the data, and the step the range is widened to. */
const PAD_RATING = 20;
const ROUND_TO = 50;
/** A band is named only this tall; y ticks closer than TICK_GAP_PX are dropped. */
const LABEL_PX = 16;
const TICK_GAP_PX = 14;
/** x labels need this much room between them. */
const LABEL_GAP_PX = 64;
const END_LABEL_GAP_PX = 40;

/** A rank's rating span for the bands behind the climb: [min, max), either end open. */
export interface ClimbBand {
    key: RankKey;
    name: string;
    min: number | null;
    max: number | null;
}

export interface ClimbPoint {
    game: number;
    rating: number;
    x: number;
    y: number;
}

export interface ClimbGeometry {
    width: number;
    height: number;
    plot: { left: number; top: number; width: number; height: number };
    /** The game before the first point, the current game, and the forecast's end (= last without a forecast). */
    g0: number;
    last: number;
    gN: number;
    y0: number;
    y1: number;
    x: (game: number) => number;
    y: (rating: number) => number;
    /** The rating before the first point, then every point. */
    line: ClimbPoint[];
    current: ClimbPoint;
    dots: ClimbPoint[];
    /** The forecast: its line and its band's edges, m = 0…20 (both start at the current point). */
    forecast: { from: { x: number; y: number }; to: { x: number; y: number }; upper: { x: number; y: number }[]; lower: { x: number; y: number }[] } | null;
    bands: { key: RankKey; name: string; y0: number; y1: number; label: boolean }[];
    next: { y: number } | null;
    ticksY: { value: number; y: number }[];
    labelsX: { text: string; x: number; anchor: 'start' | 'middle' | 'end' }[];
}

/** Your climb's geometry at a container width (ranks spec §8.3). `history.points` must not be empty. */
export function climbGeometry(history: RatingHistory, width: number, { bands, nextMinRating }: { bands: ClimbBand[]; nextMinRating: number | null }): ClimbGeometry {
    const { points, pace, step, rating } = history;
    const plot = {
        left: CLIMB_PAD.left,
        top: CLIMB_PAD.top,
        width: Math.max(1, width - CLIMB_PAD.left - CLIMB_PAD.right),
        height: width >= WIDE_CHART ? 180 : 150,
    };
    const g0 = points[0].game - 1;
    const last = points[points.length - 1].game;
    const gN = Math.max(g0 + 1, pace === null ? last : last + FORECAST_GAMES);
    const start = history.startRating ?? points[0].rating;

    const ms = Array.from({ length: FORECAST_GAMES + 1 }, (_, m) => m);
    const values = [start, ...points.map((p) => p.rating)];
    if (pace !== null) for (const m of ms) values.push(rating + pace * m + step * Math.sqrt(m), rating + pace * m - step * Math.sqrt(m));
    if (nextMinRating !== null) values.push(nextMinRating);
    const y0 = Math.floor((Math.min(...values) - PAD_RATING) / ROUND_TO) * ROUND_TO;
    const y1 = Math.max(y0 + ROUND_TO, Math.ceil((Math.max(...values) + PAD_RATING) / ROUND_TO) * ROUND_TO);

    const x = (game: number) => plot.left + ((game - g0) / (gN - g0)) * plot.width;
    const y = (r: number) => plot.top + ((y1 - r) / (y1 - y0)) * plot.height;
    const at = (game: number, r: number): ClimbPoint => ({ game, rating: r, x: x(game), y: y(r) });

    const line = [at(g0, start), ...points.map((p) => at(p.game, p.rating))];
    const current = line[line.length - 1];
    const dots = points.length <= 10 ? line.slice(1) : [current];

    const forecast =
        pace === null
            ? null
            : {
                  from: { x: current.x, y: y(rating) },
                  to: { x: x(last + FORECAST_GAMES), y: y(rating + pace * FORECAST_GAMES) },
                  upper: ms.map((m) => ({ x: x(last + m), y: y(rating + pace * m + step * Math.sqrt(m)) })),
                  lower: ms.map((m) => ({ x: x(last + m), y: y(rating + pace * m - step * Math.sqrt(m)) })),
              };

    const shownBands = bands.flatMap((band) => {
        const lo = Math.max(y0, band.min ?? y0);
        const hi = Math.min(y1, band.max ?? y1);
        if (hi <= lo) return [];
        const top = y(hi);
        const bottom = y(lo);
        return [{ key: band.key, name: band.name, y0: top, y1: bottom, label: bottom - top >= LABEL_PX }];
    });

    const ticksY: { value: number; y: number }[] = [];
    for (const value of bands.map((band) => band.min).filter((v): v is number => v !== null && v > y0 && v < y1).sort((a, b) => a - b)) {
        const at2 = y(value);
        if (ticksY.length && Math.abs(at2 - ticksY[ticksY.length - 1].y) < TICK_GAP_PX) continue;
        ticksY.push({ value, y: at2 });
    }
    if (ticksY.length === 0) ticksY.push({ value: y0, y: y(y0) }, { value: y1, y: y(y1) });

    const labelsX: ClimbGeometry['labelsX'] = [];
    if (g0 + 1 !== last && x(last) - x(g0) >= LABEL_GAP_PX) labelsX.push({ text: `Game ${g0 + 1}`, x: x(g0), anchor: 'start' });
    labelsX.push({ text: `Game ${last}`, x: x(last), anchor: pace === null ? 'end' : 'middle' });
    if (pace !== null && x(gN) - x(last) >= END_LABEL_GAP_PX) labelsX.push({ text: `+${FORECAST_GAMES}`, x: x(gN), anchor: 'end' });

    return {
        width,
        height: CLIMB_PAD.top + plot.height + CLIMB_PAD.bottom,
        plot,
        g0,
        last,
        gN,
        y0,
        y1,
        x,
        y,
        line,
        current,
        dots,
        forecast,
        bands: shownBands,
        next: nextMinRating !== null && nextMinRating > y0 && nextMinRating < y1 ? { y: y(nextMinRating) } : null,
        ticksY,
        labelsX,
    };
}

/**
 * The bands behind your climb (ranks spec R-8): every placed rank from the ladder; without the ladder only your own
 * rank's span, the one the summary carries. Cucek has no span.
 */
export function climbBands(rank: PlayerRank | null | undefined, ladder: Ladder | null | undefined): ClimbBand[] {
    if (ladder) {
        const placed = placedRanks(ladder);
        return placed.map((r, i) => ({ key: r.key, name: r.name, min: r.minRating, max: placed[i + 1]?.minRating ?? null }));
    }
    if (!rank || rank.key === 'CUCEK') return [];
    return [{ key: rank.key, name: rank.name, min: rank.minRating, max: rank.nextMinRating }];
}
