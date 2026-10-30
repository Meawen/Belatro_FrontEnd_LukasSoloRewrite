import type { PlayerRank, RatingHistory } from '../../types/user';
import { PLACEMENT_GAMES } from './rankNames';
import { cat } from '../../i18n/t';

/** The forecast's length in games (primer decision 2: kept short, luck swamps it). */
export const FORECAST_GAMES = 20;

/** Past this many games "in about n games" becomes "more than 100 games away". */
const FAR_GAMES = 100;

export interface ForecastLines {
    /** The line under the chart as [before, the rank name in bold ('' for none), after]; null for no line. */
    primary: [string, string, string] | null;
    /** "Luck alone can move you about ±{n} points over 20 games."; null when no forecast is drawn. */
    luck: string | null;
}

/**
 * The texts under your climb (ranks spec §8.4, primer decision 2). They say "about", never promise a rank and
 * never shame a drop. `nextName` is the next rank's name from the ladder (R-3); without it, "the next rank".
 */
export function forecastLines(history: RatingHistory, rank: PlayerRank | null | undefined, nextName: string | null): ForecastLines {
    const { rating, pace, step } = history;
    const c = cat().rank;
    const luck = pace === null ? null : c.forecast.luck(Math.round(step * Math.sqrt(FORECAST_GAMES)), FORECAST_GAMES);
    if (!rank) return { primary: null, luck };
    if (rank.key === 'CUCEK' || pace === null) {
        const primary: ForecastLines['primary'] = rank.key === 'CUCEK' ? [c.placement(history.rankedGamesPlayed, PLACEMENT_GAMES), '', ''] : null;
        return { primary, luck };
    }
    if (rank.nextMinRating === null) return { primary: [c.top(rank.name), '', ''], luck };

    const next = nextName ?? c.next;
    const gap = rank.nextMinRating - rating;
    // the history can be fresher than the profile: already there, say nothing rather than "in about 0 games"
    if (gap <= 0) return { primary: null, luck };
    if (pace > 0) {
        const n = Math.ceil(gap / pace);
        return { primary: n > FAR_GAMES ? [c.forecast.far(next, FAR_GAMES), '', ''] : [`${c.forecast.atPace} `, next, ` ${c.forecast.inAbout(n)}`], luck };
    }
    return { primary: [`${c.forecast.gapBefore(gap)} `, next, c.forecast.gapAfter(Math.ceil(gap / step))], luck };
}
