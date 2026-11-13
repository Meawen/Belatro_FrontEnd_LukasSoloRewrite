import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button, ErrorState, Input, Loader, Panel, type IconName } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { betaService, type BetaAdmin, type BetaCounts, type BetaDay } from '../../services/betaService';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { cat, useT } from '../../i18n/t';
import { formatDay, formatNumber } from '../../i18n/format';
import { StatTile } from './StatTile';

/** The field's text for a cap: empty for none. */
const capText = (cap: number | null) => (cap === null ? '' : String(cap));

/**
 * Admin (spec §2.2, US-17): the signup cap and four numbers: accounts against the cap, confirmed addresses waiting,
 * addresses not yet confirmed, and personal links sent but unused. Saving answers the fresh numbers; raising the cap
 * has emailed the next people waiting by then (D-10). Below it, the beta's counts (spec §9, US-18): people
 * coming back, tables with people, Škola bele and guest signups, as tiles and a table of the last 14 Zagreb days.
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
        <>
        <section aria-labelledby={headingId} className="flex flex-col gap-3">
            <h2 id={headingId} className="t-title">
                {t.admin.beta.title}
            </h2>
            <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {tiles.map((tile) => (
                    <StatTile key={tile.label} label={tile.label} value={tile.value} icon={tile.icon} />
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
        {beta.counts && <CountsSection counts={beta.counts} />}
        </>
    );
}

// spec §9: the tiles, in this order, with the wire's names; 7 days with today, unless the label says 28
const TILES: { key: Exclude<keyof BetaCounts, 'perDay'>; icon: IconName }[] = [
    { key: 'returning7', icon: 'refresh' },
    { key: 'returning28', icon: 'refresh' },
    { key: 'casualWithHumans7', icon: 'people' },
    { key: 'ranked7', icon: 'trophy' },
    { key: 'guideStarted7', icon: 'book' },
    { key: 'guideHand1_7', icon: 'book' },
    { key: 'guideHand2_7', icon: 'book' },
    { key: 'guestSignups7', icon: 'user' },
    { key: 'invitesSent7', icon: 'mail' },
    { key: 'invitesUsed7', icon: 'check' },
];
// the 14-day table's columns after the day, with perDay's names
const COLUMNS: Exclude<keyof BetaDay, 'day'>[] = ['casualWithHumans', 'ranked', 'guideStarted', 'guideHand1', 'guideHand2', 'guestSignups', 'invitesSent', 'invitesUsed'];

/** GET /admin/beta's counts (spec §9, US-18): a tile per number, then a row per Zagreb day, newest first. */
function CountsSection({ counts }: { counts: BetaCounts }) {
    const t = useT();
    const headingId = useId();
    const c = t.admin.beta.counts;
    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-3">
            <h2 id={headingId} className="t-title">{c.title}</h2>
            <p className="t-callout text-text-2">{c.lead}</p>
            <dl className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                {TILES.map(({ key, icon }) => (
                    <StatTile key={key} label={c.tile[key]} value={formatNumber(counts[key])} icon={icon} />
                ))}
            </dl>
            <Panel padding="none" className="overflow-x-auto">
                <table className="w-full text-left">
                    <caption className="t-caption px-4 pt-3 text-left text-text-2">{c.days}</caption>
                    <thead>
                        <tr className="t-caption text-text-2">
                            <th scope="col" className="px-4 py-3">{c.column.day}</th>
                            {COLUMNS.map((key) => <th key={key} scope="col" className="px-4 py-3">{c.column[key]}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {[...counts.perDay].reverse().map((day) => (
                            <tr key={day.day} className="border-t-2 border-edge">
                                <th scope="row" className="whitespace-nowrap px-4 py-3 font-normal">{formatDay(day.day)}</th>
                                {COLUMNS.map((key) => <td key={key} className="px-4 py-3 tabular-nums">{formatNumber(day[key])}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Panel>
        </section>
    );
}
