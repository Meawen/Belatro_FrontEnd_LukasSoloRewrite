// The owner's review page for the catalogs (spec §1.2, D-5): every string in Croatian and English beside its key,
// grouped by the catalog's top-level keys (one per screen or area).
// Usage: node scripts/catalog-review.mjs <out.html>
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Sample arguments per function key ('dotted.key': [[…args], …]); a function without an entry is shown for the
 * counts 1, 2 and 5. A later task that adds a function taking something other than a count adds its samples here.
 */
export const SAMPLES = {
    'common.pager.pageOf': [[1, 3], [2, 3]],
    'shell.unverified.confirm': [['ana@example.com']],
    'settings.account.pending': [['ana@example.com']],
    'settings.account.emailNotice': [['ana@example.com']],
    'settings.signedInAs': [['ana']],
    'friends.removeSheet.title': [['ana']],
    'friends.removeSheet.body': [['ana']],
    'friends.removeSheet.confirm': [['ana']],
    'friends.since': [['30. 10. 2026.']],
    'friends.requested': [['30. 10. 2026.']],
    'leaderboard.noMatch': [['matic']],
    'table.refreshFailed': [['Service Unavailable']],
    'leaderboard.games': [[1], [2], [5], [11], [21], [22]],
    'leaderboard.found': [[1], [2], [5], [11], [21], [22]],
    'common.team': [['A'], ['B']],
    'common.teamCaps': [['A'], ['B']],
    'table.seat.team': [['A'], ['B']],
    'table.seat.tagBot': [['A'], ['B']],
    'table.addBot': [['A'], ['B']],
    'table.onTeam': [['A'], ['B']],
    'matchDetails.final': [['A'], ['B']],
    'tables.host': [['mira_z']],
    'table.removeTitle': [['bob']],
    'table.removeConfirm': [['bob']],
    'table.seat.remove': [['Bot-Ana']],
    'table.notSeatedYet': [['tea_r']],
    'tables.count': [[3, 4]],
    'tables.created': [['prije 5 minuta'], ['maloprije']],
    'table.followFailed': [['Internal Server Error']],
    'ranked.connectionError': [['Internal Server Error']],
    'ranked.error': [['Internal Server Error']],
    'ranked.minutesSeconds': [[2, 5]],
    'ranked.seconds': [[45]],
    'matches.today': [['14:05']],
    'matches.form.line': [[2, 1], [1, 0], [5, 22]],
    'matches.perPage': [[10]],
    'matchDetails.result.wins': [['B', 870, 1001], ['A', 1001, 420]],
    'matchDetails.result.byBelot': [['B', 870, 1001], ['A', 1001, 420]],
    'matchDetails.result.byForfeit': [['B']],
    'matchDetails.matchId': [['f70ffc4dfa74']],
    'matchDetails.teamPoints': [['A', 252], ['B', 0], ['A', 81]],
    'matchDetails.zvanja.said': [['ivo 20 (up to Baba), mara –', 'B', 20]],
    'matchDetails.zvanja.belot': [['cy held all eight Pik']],
    'matchDetails.trump': [['Tref']],
    'rank.placement': [[3, 10]],
    'rank.top': [['Kajkavac']],
    'rank.toNext': [[120, 'Majster']],
    'rank.progressTo': [['Majster']],
    'rank.forecast.luck': [[139, 20], [22, 20]],
    'rank.forecast.far': [['Majster', 100]],
    'rank.forecast.gapBefore': [[148], [22], [1]],
    'rank.climb.about': [[1480, 38]],
    'rank.climb.game': [[57]],
    'rank.ladder.ahead': [[49]],
    'tables.open': [[1], [2], [5], [11], [21], [22]],
    'tables.bots': [[1], [2], [5], [11], [21], [22]],
    'matches.count': [[1], [2], [5], [11], [21], [22]],
    'matchDetails.handCount': [[1], [2], [5], [11], [21], [22]],
    'ranked.found.autoAccept': [[1], [2], [5], [11], [21], [22]],
    'rank.ladder.placing': [[1], [2], [5], [11], [21], [22]],
    'rank.ladder.players': [[1], [2], [5], [11], [21], [22]],
    'admin.users.found': [[1], [2], [5], [11], [21], [22]],
};

const DEFAULT_SAMPLES = [[1], [2], [5]];

const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const isNode = (value) => value !== null && typeof value === 'object';

/** Every leaf as [dotted.path, value], depth-first in the object's order. */
function leaves(node, prefix = '') {
    return Object.entries(node).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return isNode(value) ? leaves(value, path) : [[path, value]];
    });
}

/** The value at a dotted path, or undefined. */
const at = (catalog, path) => path.split('.').reduce((node, key) => (isNode(node) ? node[key] : undefined), catalog);

/** A cell: a string as is, a function once per sample, one line each. A sample that throws fails the review. */
function cell(value, path, samples) {
    if (typeof value !== 'function') return escape(value);
    return (samples[path] ?? DEFAULT_SAMPLES)
        .map((args) => {
            const shown = JSON.stringify(args).slice(1, -1);
            try {
                return escape(`(${shown}) → ${value(...args)}`);
            } catch (error) {
                throw new Error(`${path} throws on (${shown}): ${error.message}`);
            }
        })
        .join('<br>');
}

const MISSING = '<span style="color:#b00020;font-weight:bold">MISSING</span>';

/** The review page: per top-level key of `en`, a table of HR | EN | key. Deterministic: no timestamp. */
export function renderReview(en, hr, samples = SAMPLES) {
    const sections = Object.keys(en).map((area) => {
        const rows = leaves({ [area]: en[area] }).map(([path, enValue]) => {
            const hrValue = at(hr, path);
            const hrCell = hrValue === undefined || typeof hrValue !== typeof enValue ? MISSING : cell(hrValue, path, samples);
            return `<tr><td>${hrCell}</td><td>${cell(enValue, path, samples)}</td><td><code>${escape(path)}</code></td></tr>`;
        });
        return [`<h2>${escape(area)}</h2>`, '<table>', '<tr><th>HR</th><th>EN</th><th>key</th></tr>', ...rows, '</table>'].join('\n');
    });
    return [
        '<!doctype html>',
        '<html lang="hr">',
        '<head>',
        '<meta charset="utf-8">',
        '<title>Stiglja: catalog review</title>',
        '<style>body{font-family:system-ui,sans-serif;margin:2rem}table{border-collapse:collapse;width:100%;margin-bottom:2rem}th,td{border:1px solid #ccc;padding:.4rem .6rem;text-align:left;vertical-align:top}</style>',
        '</head>',
        '<body>',
        '<h1>Stiglja: catalog review</h1>',
        `<p>${leaves(en).length} keys</p>`,
        ...sections,
        '</body>',
        '</html>',
        '',
    ].join('\n');
}

async function main(out) {
    if (!out) {
        console.error('usage: node scripts/catalog-review.mjs <out.html>');
        process.exit(2);
    }
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    // Vite (already a devDependency) loads the TypeScript catalogs; no config file, since plain modules need no plugins
    const { runnerImport } = await import('vite');
    const load = async (file) =>
        (await runnerImport(resolve(root, 'src/i18n/catalog', file), { configFile: false, root, logLevel: 'error' })).module;
    const { en } = await load('en.ts');
    const { hr } = await load('hr.ts');
    let html;
    try {
        html = renderReview(en, hr);
    } catch (error) {
        // a half review page is worse than none
        console.error(`catalog-review: ${error.message}`);
        process.exit(1);
    }
    writeFileSync(out, html);
    console.log(`${leaves(en).length} keys → ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main(process.argv[2]);
