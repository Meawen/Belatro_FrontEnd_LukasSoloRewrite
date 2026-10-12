import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Ladder } from '../../types/user';
import { Tag } from '../ui';
import { ChartTooltip } from './ChartTooltip';
import { ladderGeometry } from './ladderGeometry';
import { rankColour } from './rankNames';
import { useElementWidth } from './useElementWidth';

export interface LadderChartProps {
    ladder: Ladder;
    /** Your Elo when you are placed, else null (no marker). */
    you: number | null;
}

const range = (from: number, size: number) => `${from}–${from + size - 1}`;
const players = (count: number) => (count === 1 ? '1 player' : `${count} players`);

/**
 * The ladder (ranks spec §7.3–7.6): placed players per rating band, each bar in its rank's colour over the rank
 * bands, you marked. One tab stop: the arrows walk the bars, and a hidden table carries every number.
 */
export function LadderChart({ ladder, you }: LadderChartProps) {
    const ref = useRef<HTMLDivElement>(null);
    const width = useElementWidth(ref);
    const g = useMemo(() => ladderGeometry(ladder, width, { you }), [ladder, width, you]);
    const [active, setActive] = useState<number | null>(null);
    const bar = active === null ? null : (g.bars[active] ?? null);
    const last = g.bars.length - 1;
    const baseline = g.plot.top + g.plot.height;

    function onKeyDown(event: KeyboardEvent) {
        const moves: Record<string, () => number | null> = {
            ArrowRight: () => (active === null ? 0 : Math.min(active + 1, last)),
            ArrowLeft: () => (active === null ? last : Math.max(active - 1, 0)),
            Home: () => 0,
            End: () => last,
            Escape: () => null,
        };
        const move = moves[event.key];
        if (!move || last < 0) return;
        event.preventDefault();
        setActive(move());
    }

    return (
        <div ref={ref} className="relative w-full">
            <div
                role="group"
                aria-label="The ladder: players by rating"
                tabIndex={0}
                onKeyDown={onKeyDown}
                onBlur={() => setActive(null)}
                onPointerLeave={() => setActive(null)}
                className="relative"
                style={{ height: g.height }}
            >
                <svg width={g.width} height={g.height} aria-hidden="true" className="block">
                    {g.bands.map((band) => (
                        <g key={band.key}>
                            <rect x={band.x0} y={g.plot.top} width={band.x1 - band.x0} height={g.plot.height} style={{ fill: rankColour(band.key) }} fillOpacity={0.12} shapeRendering="crispEdges" />
                            {band.label && (
                                <text x={band.x0 + 4} y={g.plot.top + 12} className="t-caption" style={{ fill: 'var(--text-2)' }}>
                                    {band.name}
                                </text>
                            )}
                        </g>
                    ))}
                    {g.grid.map((line) => (
                        <g key={line.value}>
                            <line x1={g.plot.left} x2={g.plot.left + g.plot.width} y1={line.y} y2={line.y} stroke="var(--edge)" strokeWidth={1} shapeRendering="crispEdges" />
                            <text x={g.plot.left - 6} y={line.y} textAnchor="end" dominantBaseline="middle" className="t-caption tabular-nums" style={{ fill: 'var(--text-3)' }}>
                                {line.value}
                            </text>
                        </g>
                    ))}
                    <line x1={g.plot.left} x2={g.plot.left + g.plot.width} y1={baseline} y2={baseline} stroke="var(--edge)" strokeWidth={1} shapeRendering="crispEdges" />
                    {g.bars.map((b, i) => (
                        <rect
                            key={b.from}
                            data-bar={b.from}
                            x={b.x}
                            y={b.y}
                            width={b.w}
                            height={b.h}
                            style={{ fill: rankColour(b.key) }}
                            fillOpacity={active === null || active === i ? 1 : 0.55}
                            shapeRendering="crispEdges"
                        />
                    ))}
                    {g.ticks.map((tick) => (
                        <text key={tick.value} x={tick.x} y={baseline + 15} textAnchor="middle" className="t-caption tabular-nums" style={{ fill: 'var(--text-3)' }}>
                            {tick.value}
                        </text>
                    ))}
                    {g.you && <line x1={g.you.x} x2={g.you.x} y1={g.plot.top - 2} y2={baseline} stroke="var(--accent)" strokeWidth={2} />}
                    {g.bars.map((b, i) => (
                        <rect
                            key={`slot-${b.from}`}
                            data-slot={b.from}
                            x={b.slotX}
                            y={g.plot.top}
                            width={b.slotW}
                            height={g.plot.height}
                            fill="transparent"
                            onPointerMove={() => setActive(i)}
                            onPointerDown={() => setActive(i)}
                        />
                    ))}
                </svg>
                {g.you && (
                    <span className="pointer-events-none absolute top-0.5 -translate-x-1/2" style={{ left: Math.min(Math.max(g.you.x, 20), g.width - 20) }}>
                        <Tag tone="you">You</Tag>
                    </span>
                )}
                {bar && <ChartTooltip x={bar.x + bar.w / 2} y={bar.y} width={g.width} value={players(bar.count)} label={range(bar.from, ladder.binSize)} />}
            </div>
            <p data-testid="chart-live" className="sr-only" aria-live="polite">
                {bar ? `${range(bar.from, ladder.binSize)}: ${players(bar.count)}` : ''}
            </p>
            <table className="sr-only">
                <caption>Players by rating</caption>
                <thead>
                    <tr>
                        <th scope="col">Rating</th>
                        <th scope="col">Players</th>
                    </tr>
                </thead>
                <tbody>
                    {ladder.bins.map((bin) => (
                        <tr key={bin.from}>
                            <td>{range(bin.from, ladder.binSize)}</td>
                            <td>{bin.count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <table className="sr-only">
                <caption>Players by rank</caption>
                <thead>
                    <tr>
                        <th scope="col">Rank</th>
                        <th scope="col">Players</th>
                    </tr>
                </thead>
                <tbody>
                    {ladder.ranks.map((rank) => (
                        <tr key={rank.key}>
                            <td>{rank.name}</td>
                            <td>{rank.count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
