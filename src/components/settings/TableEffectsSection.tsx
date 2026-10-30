import { useId } from 'react';
import { Panel, Segmented } from '../ui';
import { useTableEffects, type TableEffects } from '../../settings/tableEffects';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { useT } from '../../i18n/t';

/**
 * Table effects (spec §4.13 item 1): how much the table animates, kept per device. Under reduced motion the
 * board draws no particles whatever the pick (§3.8), and the note says so.
 */
export function TableEffectsSection() {
    const [effects, setEffects] = useTableEffects();
    const reduced = useReducedMotion();
    const headingId = useId();
    const t = useT();
    const options: { value: TableEffects; label: string }[] = [
        { value: 'full', label: t.settings.tableEffects.full },
        { value: 'calm', label: t.settings.tableEffects.calm },
        { value: 'off', label: t.settings.tableEffects.off },
    ];
    return (
        <Panel as="section" padding="lg" aria-labelledby={headingId} className="flex flex-col gap-3">
            <h2 id={headingId} className="t-title">
                {t.settings.tableEffects.heading}
            </h2>
            <p className="t-callout text-text-2">
                {t.settings.tableEffects.body}
            </p>
            <Segmented label={t.settings.tableEffects.heading} options={options} value={effects} onChange={setEffects} className="self-start" />
            {reduced && (
                <p className="t-footnote text-text-2">
                    {t.settings.tableEffects.reduced}
                </p>
            )}
        </Panel>
    );
}
