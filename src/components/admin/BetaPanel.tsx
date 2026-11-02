import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button, ErrorState, Input, Loader, Panel, PixelIcon, type IconName } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { betaService, type BetaAdmin } from '../../services/betaService';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { cat, useT } from '../../i18n/t';
import { formatNumber } from '../../i18n/format';

/** The field's text for a cap: empty for none. */
const capText = (cap: number | null) => (cap === null ? '' : String(cap));

/**
 * Admin (spec §2.2, US-17): the signup cap and four numbers: accounts against the cap, confirmed addresses waiting,
 * addresses not yet confirmed, and personal links sent but unused. Saving answers the fresh numbers; raising the cap
 * has emailed the next people waiting by then (D-10). S15 adds the counts (spec §9).
 */
export function BetaPanel() {
    const t = useT();
    const headingId = useId();
    const [beta, setBeta] = useState<BetaAdmin | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    // the field's text; empty means no cap
    const [cap, setCap] = useState('');
    const [capError, setCapError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    // no answer lands after unmount
    const mounted = useRef(true);

    const load = useCallback(() => {
        setLoadFailed(false);
        betaService.getBeta().then(
            (answer) => {
                if (!mounted.current) return;
                setBeta(answer);
                setCap(capText(answer.cap));
            },
            () => {
                if (mounted.current) setLoadFailed(true);
            },
        );
    }, []);

    useEffect(() => {
        mounted.current = true;
        load();
        return () => {
            mounted.current = false;
        };
    }, [load]);

    const clearNotes = () => {
        setSaved(false);
        setCapError(null);
        setSaveError(null);
    };

    const save = async (e: FormEvent) => {
        e.preventDefault();
        clearNotes();
        const text = cap.trim();
        // B7's rule (CAP_INVALID): a whole number, 0 or more; empty removes the cap
        if (text !== '' && !/^\d{1,9}$/.test(text)) {
            setCapError(cat().errors.codes.CAP_INVALID);
            return;
        }
        setSaving(true);
        try {
            const fresh = await betaService.setCap(text === '' ? null : Number(text));
            if (!mounted.current) return;
            setBeta(fresh);
            setCap(capText(fresh.cap));
            setSaved(true);
        } catch (error) {
            if (!mounted.current) return;
            const status = error instanceof ApiError ? error.status : 0;
            // their text is the browser's or Spring's; the server's CAP_INVALID has its line
            setSaveError(isNetworkOrServerFailure(status) ? cat().admin.beta.saveFailed : errorMessage(error, cat().admin.beta.saveFailed));
        } finally {
            if (mounted.current) setSaving(false);
        }
    };

    if (loadFailed) {
        return (
            <Panel>
                <ErrorState title={t.admin.beta.loadFailed} action={<Button variant="secondary" onClick={load}>{t.common.retry}</Button>} />
            </Panel>
        );
    }

    if (!beta) {
        return <Loader text={t.admin.beta.loading} />;
    }

    const tiles: { label: string; value: string; icon: IconName }[] = [
        {
            label: t.admin.beta.accounts,
            value: beta.cap === null ? formatNumber(beta.accounts) : `${formatNumber(beta.accounts)} / ${formatNumber(beta.cap)}`,
            icon: 'people',
        },
        { label: t.admin.beta.waiting, value: formatNumber(beta.waiting), icon: 'list' },
        { label: t.admin.beta.unconfirmed, value: formatNumber(beta.unconfirmed), icon: 'mail' },
        { label: t.admin.beta.invites, value: formatNumber(beta.invitesOutstanding), icon: 'link' },
    ];

    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-3">
            <h2 id={headingId} className="t-title">
                {t.admin.beta.title}
            </h2>
            <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {tiles.map((tile) => (
                    <Panel key={tile.label} padding="none" className="flex items-center gap-3 px-4 py-3">
                        <PixelIcon name={tile.icon} scale={3} className="shrink-0 text-text-3" />
                        <div className="flex min-w-0 flex-col-reverse">
                            <dt className="t-caption text-text-2">{tile.label}</dt>
                            <dd className="t-score tabular-nums">{tile.value}</dd>
                        </div>
                    </Panel>
                ))}
            </dl>
            <Panel>
                <form onSubmit={save} className="flex flex-col items-start gap-3" noValidate>
                    <Input
                        label={t.admin.beta.cap}
                        name="cap"
                        inputMode="numeric"
                        autoComplete="off"
                        value={cap}
                        onChange={(e) => {
                            setCap(e.target.value);
                            clearNotes();
                        }}
                        helper={t.admin.beta.capHelper}
                        error={capError ?? undefined}
                        className="w-full"
                    />
                    <Button type="submit" loading={saving}>
                        {t.admin.beta.save}
                    </Button>
                    {saved && (
                        <p role="status" className="t-callout text-success">
                            {t.admin.beta.saved}
                        </p>
                    )}
                    <ErrorAlert message={saveError} />
                </form>
            </Panel>
        </section>
    );
}
