#!/usr/bin/env node
// The visual harness (spec §7.3): screenshots of the SPA's pages, served by the Vite dev server with a
// mocked API, for the owner's look check after every UI phase; baselines to compare them with; and the
// checks of §7.3 (hit-testing, reduced motion, more contrast, forced colours, focus, performance, …).
//
// What it does
//   - Starts the Vite dev server itself (127.0.0.1, --port, strict: a busy port fails the run), with
//     VITE_CARD_ART_BASE_URL pointing at a made-up host that the harness answers, and stops it at the end.
//   - Launches headless Chromium through playwright-core 1.62.1, installed OUTSIDE this repo (it is not
//     a project dependency), the way e2e/gameplay.mjs loads it:
//       PLAYWRIGHT_CORE_DIR=<dir>/node_modules/playwright-core node e2e/visual.mjs …
//     Chromium cannot start inside the agent sandbox on macOS: run the harness outside it.
//   - For every scene and viewport, in a fresh browser context: signs the scene's user in by seeding
//     localStorage before any script runs (a fake, unexpired JWT and the user; Table effects "off");
//     answers /backend/** from the scene's API fixtures; blocks the game socket (/ws/**) and every
//     other host; answers the card art from e2e/visual/fixtures/cards/ (a missing file is a 404, so the
//     card shows its text face); hides React Query's dev-only devtools toggle; skips every motion animation
//     (MotionGlobalConfig.skipAnimations, set by src/main.tsx on the dev server); fixes the page's clock
//     (Date only) at 2026-10-10 12:00 UTC, its language (en-US) and time zone (Europe/Zagreb); opens the
//     path, runs the scene's setup, waits for fonts and the network to settle, and saves
//     <out>/<scene name>@<W>x<H>.png (animations disabled). The machinery is e2e/visual/lib.mjs.
//   - Fails the run when a page at most 375 px wide scrolls sideways.
//   Phones (the short side at most 500 px) get a touch screen at 2× unless the scene says `dpr`; the
//   rest 1×.
//
// CLI
//   node e2e/visual.mjs [--scenes shell,lobby] [--only <scene name>] [--out <dir>] [--port 5199]
//                       [--update | --compare] [--check <name,…|all>] [--list] [--list-checks]
//     --scenes       the scene files to load (e2e/visual/scenes/<name>.mjs); default: every file there
//     --only         just the scene with this name
//     --out          where the PNGs go; default e2e/visual/out (git-ignored); created if missing
//     --port         the dev server's port; default 5199
//     --update       record: shoot the chosen scenes into the baselines of this platform and Chromium,
//                    e2e/visual/baseline/<platform>-<arch>-chromium<version>/ (spec §7.3)
//     --compare      shoot into --out, then compare every shot with its baseline inside Chromium: more
//                    than 0.2 % of its pixels differing fails it, and <name>@<W>x<H>.diff.png shows where.
//                    No baselines for this platform and Chromium fails with "re-record baselines".
//     --check        run these checks (e2e/visual/checks/<name>.mjs, or every one with "all") instead of
//                    shooting; a check may use the chosen scenes
//     --list         print the chosen scenes and exit, starting nothing (no browser needed)
//     --list-checks  print the checks and exit, starting nothing
//   Exit 0: every shot taken (and matching its baseline, with --compare) or every check passed, and nothing
//   scrolls sideways at 375 px; 1: a shot, a comparison or a check failed; 2: bad arguments, a bad scene
//   or check file.
//
// Scene format: every file in e2e/visual/scenes/ (one per UI area; a phase never edits another's)
// default-exports an array of scenes:
//   {
//     name: 'shell-home',                    // the shots' file name stem; unique across all files
//     path: '/dashboard',                    // the URL path (and query) to open
//     viewports: ['1440x900', '375x812'],    // W x H in CSS px
//     user: { id: 'u1', username: 'ana_k' }, // signed in as this user; null or absent: signed out
//     api: ['player.json', { 'GET /user/me/active-game': { json: { gameId: 'g9' } } }],
//                                            // answers, merged left to right: a file name under
//                                            // e2e/visual/fixtures/api/ or an object of the same shape.
//                                            // Keys: "METHOD /path" below /backend, without the query;
//                                            // a "*" segment matches any one segment. Values:
//                                            // { status?: number (200), json?: any }. A request nothing
//                                            // answers gets a 404 and is listed under the shot.
//     setup: async (page) => {},             // optional: clicks before the shot (Playwright Page)
//     fullPage: false,                       // optional: the whole page instead of the viewport
//     dpr: 1,                                // optional: device pixel ratio
//   }
//   A check may read more fields of a scene; each check's file says which.
//
// Check format: every file in e2e/visual/checks/ default-exports
//   { name: 'hit', about: 'one line', run: async (ctx) => string[] }   // the failures; [] passes
//   ctx: { browser, origin (the dev server), scenes (the chosen ones), scene(name) (any scene, by name), out,
//          tool (an about:blank page), countColours(png, ["#fbf236"], tolerance?) → { "#fbf236": n },
//          open(scene, viewport, { context?: more context options, animate?: false }) → { context, page,
//          unanswered } (close the context; animations are skipped unless animate), log(line) }

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    BASELINE_DIR, CHECKS_DIR, MAX_DIFF, NARROW, SCENES_DIR, VISUAL,
    apiTable, comparePngs, countColours, openScene, parseViewport, platformKey, shoot, startDevServer,
} from './visual/lib.mjs';

function usage(message) {
    console.error(message);
    console.error('usage: node e2e/visual.mjs [--scenes a,b] [--only <scene name>] [--out <dir>] [--port <n>] [--update | --compare] [--check <a,b|all>] [--list] [--list-checks]');
    process.exit(2);
}

function parseArgs(argv) {
    const opt = { scenes: null, only: null, out: join(VISUAL, 'out'), port: 5199, list: false, listChecks: false, update: false, compare: false, check: null };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const value = () => {
            const next = argv[++i];
            if (next === undefined) usage(`${arg} needs a value`);
            return next;
        };
        if (arg === '--scenes') opt.scenes = value().split(',').map((name) => name.trim()).filter(Boolean);
        else if (arg === '--only') opt.only = value();
        else if (arg === '--out') opt.out = resolve(value());
        else if (arg === '--port') opt.port = Number(value());
        else if (arg === '--list') opt.list = true;
        else if (arg === '--list-checks') opt.listChecks = true;
        else if (arg === '--update') opt.update = true;
        else if (arg === '--compare') opt.compare = true;
        else if (arg === '--check') opt.check = value().split(',').map((name) => name.trim()).filter(Boolean);
        else usage(`unknown argument ${arg}`);
    }
    if (!Number.isInteger(opt.port) || opt.port <= 0) usage('--port must be a port number');
    if (opt.update && opt.compare) usage('--update and --compare go one at a time');
    if (opt.check && (opt.update || opt.compare)) usage('--check runs instead of shooting: leave out --update and --compare');
    return opt;
}

async function loadScenes(opt, all = false) {
    const files = readdirSync(SCENES_DIR).filter((file) => file.endsWith('.mjs')).map((file) => basename(file, '.mjs')).sort();
    const chosenFiles = all ? files : opt.scenes ?? files;
    for (const name of chosenFiles) if (!files.includes(name)) usage(`no scene file e2e/visual/scenes/${name}.mjs`);
    const scenes = [];
    for (const file of chosenFiles) {
        const module = await import(pathToFileURL(join(SCENES_DIR, `${file}.mjs`)).href);
        for (const scene of module.default) scenes.push({ ...scene, file });
    }
    const names = new Set();
    for (const scene of scenes) {
        if (!scene.name || !scene.path || !Array.isArray(scene.viewports) || scene.viewports.length === 0) {
            usage(`a scene in ${scene.file}.mjs needs a name, a path and viewports`);
        }
        if (names.has(scene.name)) usage(`two scenes are named ${scene.name}`);
        names.add(scene.name);
        for (const viewport of scene.viewports) if (!parseViewport(viewport)) usage(`a viewport looks like 375x812, not "${viewport}"`);
        try {
            apiTable(scene);
        } catch (error) {
            usage(error.message);
        }
    }
    if (all) return scenes;
    const chosen = opt.only ? scenes.filter((scene) => scene.name === opt.only) : scenes;
    if (opt.only && chosen.length === 0) usage(`no scene named ${opt.only}`);
    return chosen;
}

async function loadChecks(names) {
    const files = existsSync(CHECKS_DIR) ? readdirSync(CHECKS_DIR).filter((file) => file.endsWith('.mjs')).sort() : [];
    const checks = [];
    for (const file of files) {
        const check = (await import(pathToFileURL(join(CHECKS_DIR, file)).href)).default;
        if (!check?.name || typeof check.run !== 'function') usage(`e2e/visual/checks/${file} must default-export { name, about, run }`);
        checks.push(check);
    }
    if (!names || names.includes('all')) return checks;
    for (const name of names) if (!checks.some((check) => check.name === name)) usage(`no check named ${name} (see --list-checks)`);
    return checks.filter((check) => names.includes(check.name));
}

const opt = parseArgs(process.argv.slice(2));
const scenes = await loadScenes(opt);
if (opt.list) {
    for (const scene of scenes) {
        console.log(`${scene.file}  ${scene.name}  ${scene.path}  ${scene.viewports.join(' ')}  ${scene.user ? `as ${scene.user.username}` : 'signed out'}`);
    }
    process.exit(0);
}
const checks = opt.listChecks || opt.check ? await loadChecks(opt.check) : [];
if (opt.listChecks) {
    for (const check of checks) console.log(`${check.name}  ${check.about ?? ''}`);
    process.exit(0);
}

let chromium;
try {
    ({ chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE_DIR ?? 'playwright-core'));
} catch {
    usage('playwright-core not found: set PLAYWRIGHT_CORE_DIR to playwright-core 1.62.1 installed outside this repo');
}
const failures = [];
let browser;
let server;
let summary = '';
try {
    browser = await chromium.launch({ headless: true });
    const key = platformKey(browser);
    const baselines = join(BASELINE_DIR, key);
    if (opt.compare && !existsSync(baselines)) {
        const found = existsSync(BASELINE_DIR) ? readdirSync(BASELINE_DIR).filter((name) => !name.startsWith('.')) : [];
        throw new Error(`re-record baselines: none for ${key} (e2e/visual/baseline/ has ${found.length ? found.join(', ') : 'nothing'}); run with --update and have the owner approve them`);
    }
    const out = opt.update ? baselines : opt.out;
    mkdirSync(out, { recursive: true });
    let origin;
    ({ server, origin } = await startDevServer(opt.port));
    const tool = await browser.newPage();
    if (checks.length) {
        const everyScene = await loadScenes(opt, true);
        const ctx = {
            browser, origin, scenes, out, tool,
            scene: (name) => {
                const found = everyScene.find((scene) => scene.name === name);
                if (!found) throw new Error(`no scene named ${name}`);
                return found;
            },
            open: (scene, viewport, options) => openScene(browser, origin, scene, viewport, options),
            countColours: (png, colours, tolerance) => countColours(tool, png, colours, tolerance),
            log: (line) => console.log(`      ${line}`),
        };
        for (const check of checks) {
            let found;
            try {
                found = await check.run(ctx);
            } catch (error) {
                found = [`${String(error.message ?? error).split('\n')[0]}`];
            }
            console.log(`check ${check.name}: ${found.length ? `${found.length} failure(s)` : 'ok'}`);
            for (const failure of found) failures.push(`${check.name}: ${failure}`);
        }
        summary = `visual: ${checks.length} check(s) run`;
    } else {
        let shots = 0;
        for (const scene of scenes) {
            for (const viewport of scene.viewports) {
                try {
                    const shot = await shoot(browser, origin, scene, viewport, join(out, `${scene.name}@${viewport}.png`));
                    shots++;
                    console.log(`shot  ${shot.file}`);
                    if (shot.unanswered.length) console.log(`      unanswered: ${shot.unanswered.join(', ')}`);
                    if (shot.sideways > 0) failures.push(`${scene.name}@${viewport} scrolls sideways by ${shot.sideways} px`);
                    if (opt.compare) {
                        const name = `${scene.name}@${viewport}.png`;
                        const expected = join(baselines, name);
                        if (!existsSync(expected)) {
                            failures.push(`${name}: no baseline for ${key} (re-record baselines with --update)`);
                            continue;
                        }
                        const result = await comparePngs(tool, readFileSync(expected), readFileSync(shot.file));
                        if (result.sizeMismatch) failures.push(`${name}: ${result.sizeMismatch} against its baseline (re-record baselines?)`);
                        else if (result.ratio > MAX_DIFF) {
                            const diff = join(out, `${scene.name}@${viewport}.diff.png`);
                            writeFileSync(diff, result.diff);
                            failures.push(`${name} differs from its baseline in ${(result.ratio * 100).toFixed(2)} % of its pixels (limit ${MAX_DIFF * 100} %): ${diff}`);
                        } else if (result.differing) console.log(`      ${(result.ratio * 100).toFixed(3)} % of pixels differ (within ${MAX_DIFF * 100} %)`);
                    }
                } catch (error) {
                    failures.push(`${scene.name}@${viewport}: ${String(error.message ?? error).split('\n')[0]}`);
                }
            }
        }
        const what = opt.update ? `recorded into e2e/visual/baseline/${key}` : opt.compare ? `compared with e2e/visual/baseline/${key}` : 'shot';
        summary = `visual: ${scenes.length} scene(s), ${shots} shot(s) ${what}, nothing scrolls sideways at ${NARROW} px`;
    }
} catch (error) {
    failures.push(String(error.message ?? error).split('\n')[0]);
} finally {
    await browser?.close();
    server?.kill('SIGTERM');
}
for (const failure of failures) console.error(`FAIL  ${failure}`);
console.log(failures.length ? `visual: ${failures.length} failure(s)` : summary);
process.exit(failures.length ? 1 : 0);
