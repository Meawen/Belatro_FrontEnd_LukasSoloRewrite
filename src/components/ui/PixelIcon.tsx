import { ICONS, type IconName } from './icons';
import { cx } from './cx';

export interface PixelIconProps {
    name: IconName;
    /** Device-independent pixels per icon pixel: ×2 (16–18 px) or ×3. */
    scale?: 2 | 3;
    /** Only for an icon that stands alone; an icon beside text stays hidden from assistive tech. */
    label?: string;
    className?: string;
}

interface Run {
    x: number;
    y: number;
    width: number;
}

const runsCache = new Map<IconName, { runs: Run[]; width: number; height: number }>();

/** One rect per horizontal run of filled pixels. */
function runsOf(name: IconName) {
    let cached = runsCache.get(name);
    if (!cached) {
        const rows: readonly string[] = ICONS[name];
        const runs: Run[] = [];
        rows.forEach((row, y) => {
            for (const match of row.matchAll(/#+/g)) runs.push({ x: match.index ?? 0, y, width: match[0].length });
        });
        cached = { runs, width: Math.max(...rows.map((row) => row.length)), height: rows.length };
        runsCache.set(name, cached);
    }
    return cached;
}

/** A pixel icon (spec §3.5): SVG rects on the icon's grid, crisp at whole-number scales. */
export function PixelIcon({ name, scale = 2, label, className }: PixelIconProps) {
    const { runs, width, height } = runsOf(name);
    return (
        <svg
            className={cx('inline-block shrink-0', className)}
            width={width * scale}
            height={height * scale}
            viewBox={`0 0 ${width} ${height}`}
            fill="currentColor"
            shapeRendering="crispEdges"
            focusable="false"
            {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
        >
            {runs.map((run) => (
                <rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.width} height={1} />
            ))}
        </svg>
    );
}
