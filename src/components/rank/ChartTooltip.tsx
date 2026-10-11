/** Keeps a tooltip's centre this far from the chart's edges, so it never hangs outside the panel. */
const EDGE_PX = 64;

export interface ChartTooltipProps {
    /** The point it points at, in the chart's px: centred above it. */
    x: number;
    y: number;
    /** The chart's width, to keep the tooltip inside. */
    width: number;
    /** The number: strong, first (the dataviz skill: values lead, labels follow). */
    value: string;
    /** What it is: secondary. */
    label: string;
}

/** A chart's tooltip (ranks spec §7.5, §8.5): static, no animation, never takes the pointer. */
export function ChartTooltip({ x, y, width, value, label }: ChartTooltipProps) {
    const left = Math.min(Math.max(x, EDGE_PX), Math.max(EDGE_PX, width - EDGE_PX));
    return (
        <div
            data-testid="chart-tooltip"
            className="notch pointer-events-none absolute z-10 flex flex-col items-center whitespace-nowrap bg-ink px-2 py-1"
            style={{ left, top: y - 6, transform: 'translate(-50%, -100%)' }}
        >
            <span className="t-callout font-semibold tabular-nums text-text">{value}</span>
            <span className="t-caption tabular-nums text-text-2">{label}</span>
        </div>
    );
}
