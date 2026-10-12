import { useId } from 'react';
import { Panel, Segmented } from '../ui';
import { useTableEffects, type TableEffects } from '../../settings/tableEffects';
import { useReducedMotion } from '../../motion/useReducedMotion';

const OPTIONS: { value: TableEffects; label: string }[] = [
    { value: 'full', label: 'Full' },
    { value: 'calm', label: 'Calm' },
    { value: 'off', label: 'Off' },
];

/**
 * Table effects (spec §4.13 item 1): how much the table animates, kept per device. Under reduced motion the
 * board draws no particles whatever the pick (§3.8), and the note says so.
 */
export function TableEffectsSection() {
    const [effects, setEffects] = useTableEffects();
    const reduced = useReducedMotion();
    const headingId = useId();
    return (
        <Panel as="section" padding="lg" aria-labelledby={headingId} className="flex flex-col gap-3">
            <h2 id={headingId} className="t-title">
                Table effects
            </h2>
            <p className="t-callout text-text-2">
                The season and its particles when trump is called. Calm and Off suit slower phones. Kept on this device.
            </p>
            <Segmented label="Table effects" options={OPTIONS} value={effects} onChange={setEffects} className="self-start" />
            {reduced && (
                <p className="t-footnote text-text-2">
                    Your device asks for reduced motion, so the table shows no particles, whatever you pick here.
                </p>
            )}
        </Panel>
    );
}
