import { Panel, PixelIcon, type IconName } from '../ui';

/** One number on the admin page, inside its section's <dl>: the icon, then the value over its label (AdminStats, BetaPanel). */
export function StatTile({ label, value, icon }: { label: string; value: string; icon: IconName }) {
    return (
        <Panel padding="none" className="flex items-center gap-3 px-4 py-3">
            <PixelIcon name={icon} scale={3} className="shrink-0 text-text-3" />
            <div className="flex min-w-0 flex-col-reverse">
                <dt className="t-caption text-text-2">{label}</dt>
                <dd className="t-score tabular-nums">{value}</dd>
            </div>
        </Panel>
    );
}
