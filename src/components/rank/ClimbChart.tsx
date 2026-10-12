import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { RatingHistory } from '../../types/user';
import { ChartTooltip } from './ChartTooltip';
import { climbGeometry, type ClimbBand } from './climbGeometry';
import { rankColour } from './rankNames';
import { useElementWidth } from './useElementWidth';

export interface ClimbChartProps {
    /** At least one point. */
    history: RatingHistory;
    bands: ClimbBand[];
    /** Where the next rank starts, kept inside the range and drawn as a hairline; null for none. */
    nextMinRating: number | null;
}

/**
 * Your climb (ranks spec §8.3–8.6): your rating over your ranked games over the rank bands, the current point, and
 * the "at this pace" forecast with its luck band. One tab stop: the arrows walk the games, the forecast included.
 */
export function ClimbChart({ history, bands, nextMinRating }: ClimbChartProps) {
    const ref = useRef<HTMLDivElement>(null);
    const width = useElementWidth(ref);
    const g = useMemo(() => climbGeometry(history, width, { bands, nextMinRating }), [history, width, bands, nextMinRating]);
    const [active, setActive] = useState<number | null>(null);
    const baseline = g.plot.top + g.plot.height;

    let readout: { value: string; label: string; x: number; y: number } | null = null;
    if (active !== null) {
        if (active <= g.last) {
            const point = g.line.find((p) => p.game === active) ?? g.line[0];
            const label = active === g.g0 ? (g.g0 === 0 ? 'Start' : `Game ${g.g0}`) : `Game ${active}`;
            readout = { value: `${point.rating}`, label, x: point.x, y: point.y };
        } else if (history.pace !== null) {
            const m = active - g.last;
            const centre = history.rating + history.pace * m;
            readout = {
                value: `about ${Math.round(centre)} ± ${Math.round(history.step * Math.sqrt(m))}`,
                label: m === 1 ? 'In 1 game' : `In ${m} games`,
                x: g.x(active),
                y: g.y(centre),
            };
        }
    }

    function onKeyDown(event: KeyboardEvent) {
        const moves: Record<string, () => number | null> = {
            ArrowRight: () => (active === null ? g.last : Math.min(active + 1, g.gN)),
            ArrowLeft: () => (active === null ? g.last : Math.max(active - 1, g.g0)),
            Home: () => g.g0,
            End: () => g.gN,
            Escape: () => null,
        };
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault();
        setActive(move());
    }

    function onPointerMove(event: PointerEvent<SVGSVGElement>) {
        const left = event.currentTarget.getBoundingClientRect().left;
        const game = Math.round(g.g0 + ((event.clientX - left - g.plot.left) / g.plot.width) * (g.gN - g.g0));
        setActive(Math.min(g.gN, Math.max(g.g0, game)));
    }

    const nextKey = bands.find((band) => band.min !== null && band.min === nextMinRating)?.key;

    return (
        <div ref={ref} className="relative w-full">
            <div
                role="group"
                aria-label="Your climb: rating over your ranked games"
                tabIndex={0}
                onKeyDown={onKeyDown}
                onBlur={() => setActive(null)}
                onPointerLeave={() => setActive(null)}
                className="relative"
                style={{ height: g.height }}
            >
                <svg width={g.width} height={g.height} aria-hidden="true" className="block" onPointerMove={onPointerMove} onPointerDown={onPointerMove}>
                    {g.bands.map((band) => (
                        <g key={band.key} data-band={band.key}>
                            <rect x={g.plot.left} y={band.y0} width={g.plot.width} height={band.y1 - band.y0} style={{ fill: rankColour(band.key) }} fillOpacity={0.12} shapeRendering="crispEdges" />
                            {band.label && (
                                <text x={g.plot.left + g.plot.width - 4} y={band.y0 + 12} textAnchor="end" className="t-caption" style={{ fill: 'var(--text-2)' }}>
                                    {band.name}
                                </text>
                            )}
                        </g>
                    ))}
                    {g.ticksY.map((tick) => (
                        <g key={tick.value}>
                            <line x1={g.plot.left} x2={g.plot.left + g.plot.width} y1={tick.y} y2={tick.y} stroke="var(--edge)" strokeWidth={1} shapeRendering="crispEdges" />
                            <text x={g.plot.left - 6} y={tick.y} textAnchor="end" dominantBaseline="middle" className="t-caption tabular-nums" style={{ fill: 'var(--text-3)' }}>
                                {tick.value}
                            </text>
                        </g>
                    ))}
                    {g.next && (
                        <line x1={g.plot.left} x2={g.plot.left + g.plot.width} y1={g.next.y} y2={g.next.y} stroke={nextKey ? rankColour(nextKey) : 'var(--text-3)'} strokeWidth={1} shapeRendering="crispEdges" />
                    )}
                    <line x1={g.plot.left} x2={g.plot.left + g.plot.width} y1={baseline} y2={baseline} stroke="var(--edge)" strokeWidth={1} shapeRendering="crispEdges" />
                    {g.forecast && (
                        <>
                            <polygon
                                data-forecast-band
                                points={[...g.forecast.upper, ...[...g.forecast.lower].reverse()].map((p) => `${p.x},${p.y}`).join(' ')}
                                style={{ fill: 'var(--accent)' }}
                                fillOpacity={0.12}
                            />
                            <line
                                data-forecast-line
                                x1={g.forecast.from.x}
                                y1={g.forecast.from.y}
                                x2={g.forecast.to.x}
                                y2={g.forecast.to.y}
                                stroke="var(--accent)"
                                strokeOpacity={0.7}
                                strokeWidth={2}
                                strokeDasharray="4 3"
                            />
                        </>
                    )}
                    <polyline
                        data-history
                        points={g.line.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                    {g.dots.map((dot) => (
                        <circle key={dot.game} data-dot={dot.game} cx={dot.x} cy={dot.y} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
                    ))}
                    {g.labelsX.map((label) => (
                        <text key={label.text} x={label.x} y={baseline + 15} textAnchor={label.anchor} className="t-caption tabular-nums" style={{ fill: 'var(--text-3)' }}>
                            {label.text}
                        </text>
                    ))}
                    {readout && <line data-crosshair x1={readout.x} x2={readout.x} y1={g.plot.top} y2={baseline} stroke="var(--text-3)" strokeWidth={1} shapeRendering="crispEdges" />}
                </svg>
                {readout && <ChartTooltip x={readout.x} y={readout.y} width={g.width} value={readout.value} label={readout.label} />}
            </div>
            <p data-testid="chart-live" className="sr-only" aria-live="polite">
                {readout ? `${readout.label}: ${readout.value}` : ''}
            </p>
            <table className="sr-only">
                <caption>Your rating after each ranked game</caption>
                <thead>
                    <tr>
                        <th scope="col">Game</th>
                        <th scope="col">Rating</th>
                    </tr>
                </thead>
                <tbody>
                    {history.points.map((point) => (
                        <tr key={point.game}>
                            <td>Game {point.game}</td>
                            <td>{point.rating}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
