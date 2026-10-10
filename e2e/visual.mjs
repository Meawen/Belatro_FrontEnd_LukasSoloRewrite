#!/usr/bin/env node
// The visual harness (spec §7.3): screenshots of the SPA's pages, served by the Vite dev server with a
// mocked API, for the owner's look check after every UI phase (and, from Phase 10, baselines).
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
//     card shows its text face); hides React Query's dev-only devtools toggle; opens the path, runs the
//     scene's setup, waits for fonts and the network to settle, and saves <out>/<scene name>@<W>x<H>.png
//     (animations disabled).
//   - Fails the run when a page at most 375 px wide scrolls sideways.
//   Phones (the short side at most 500 px) get a touch screen at 2× unless the scene says `dpr`; the
//   rest 1×.
//
// CLI
//   node e2e/visual.mjs [--scenes shell,lobby] [--only <scene name>] [--out <dir>] [--port 5199] [--list]
//     --scenes  the scene files to load (e2e/visual/scenes/<name>.mjs); default: every file there
//     --only    just the scene with this name
//     --out     where the PNGs go; default e2e/visual/out (git-ignored); created if missing
//     --port    the dev server's port; default 5199
//     --list    print the chosen scenes and exit, starting nothing (no browser needed)
//   Exit 0: every shot taken and nothing scrolls sideways at 375 px; 1: a shot failed or a page scrolls
//   sideways; 2: bad arguments or a bad scene file.
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

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VISUAL = join(ROOT, 'e2e', 'visual');
const SCENES_DIR = join(VISUAL, 'scenes');
const API_DIR = join(VISUAL, 'fixtures', 'api');
const CARDS_DIR = join(VISUAL, 'fixtures', 'cards');
// The dev server's card art origin during a run; nothing is fetched from it, the harness answers it.
const CARD_ART = 'https://card-art.visual.test/v1';
// Pages at most this wide must not scroll sideways (spec §7.3, R-37).
const NARROW = 375;
const GOTO_TIMEOUT_MS = 60000;
// Sheets and toasts spring in for about 0.3 s; animations are off for the shot itself.
const SETTLE_MS = 400;
// React Query's devtools toggle (dev server only; a build has none) floats over the bottom-right corner,
// the tab bar's More included: hidden in every shot.
const DEV_ONLY_CSS = '.tsqd-open-btn-container { display: none !important; }';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function usage(message) {
    console.error(message);
    console.error('usage: node e2e/visual.mjs [--scenes a,b] [--only <scene name>] [--out <dir>] [--port <n>] [--list]');
    process.exit(2);
}

function parseArgs(argv) {
    const opt = { scenes: null, only: null, out: join(VISUAL, 'out'), port: 5199, list: false };
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
        else usage(`unknown argument ${arg}`);
    }
    if (!Number.isInteger(opt.port) || opt.port <= 0) usage('--port must be a port number');
    return opt;
}

function parseViewport(text) {
    const match = /^(\d+)x(\d+)$/.exec(text);
    if (!match) usage(`a viewport looks like 375x812, not "${text}"`);
    return { width: Number(match[1]), height: Number(match[2]) };
}

async function loadScenes(opt) {
    const files = readdirSync(SCENES_DIR).filter((file) => file.endsWith('.mjs')).map((file) => basename(file, '.mjs')).sort();
    const chosenFiles = opt.scenes ?? files;
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
        scene.viewports.forEach(parseViewport);
        apiTable(scene);
    }
    const chosen = opt.only ? scenes.filter((scene) => scene.name === opt.only) : scenes;
    if (opt.only && chosen.length === 0) usage(`no scene named ${opt.only}`);
    return chosen;
}

/** The scene's answers, merged left to right, as rows to match; exact paths before "*" patterns. */
function apiTable(scene) {
    const merged = {};
    for (const source of scene.api ?? []) {
        if (typeof source !== 'string') Object.assign(merged, source);
        else if (existsSync(join(API_DIR, source))) Object.assign(merged, JSON.parse(readFileSync(join(API_DIR, source), 'utf8')));
        else usage(`scene ${scene.name}: no fixture e2e/visual/fixtures/api/${source}`);
    }
    return Object.entries(merged)
        .map(([key, answer]) => {
            const [method, path] = key.split(' ');
            const segments = path.split('/').map((part) => (part === '*' ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
            return { method, pattern: new RegExp(`^${segments.join('/')}$`), exact: !path.split('/').includes('*'), answer };
        })
        .sort((a, b) => Number(b.exact) - Number(a.exact));
}

/** An unsigned JWT the SPA accepts as a live session: it reads `exp`, the server is never asked. */
function fakeToken(user) {
    const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    return `${part({ alg: 'none' })}.${part({ sub: user.username, iat: now, exp: now + 7200 })}.visual`;
}

async function startDevServer(port) {
    const server = spawn(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
        cwd: ROOT,
        env: { ...process.env, VITE_CARD_ART_BASE_URL: CARD_ART },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    server.stdout.on('data', (chunk) => (output += chunk));
    server.stderr.on('data', (chunk) => (output += chunk));
    const origin = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
        if (server.exitCode !== null) throw new Error(`the dev server stopped:\n${output}`);
        try {
            if ((await fetch(origin)).ok) return { server, origin };
        } catch {
            // not listening yet
        }
        await sleep(250);
    }
    server.kill('SIGTERM');
    throw new Error(`the dev server did not answer on ${origin} within 60 s:\n${output}`);
}

/** Every request of the page: card art and the API from fixtures, the app from Vite, nothing else. */
function answer(route, table, unanswered, origin) {
    const request = route.request();
    const url = new URL(request.url());
    if (url.href.startsWith(`${CARD_ART}/`)) {
        const file = join(CARDS_DIR, basename(decodeURIComponent(url.pathname)));
        if (existsSync(file)) return route.fulfill({ status: 200, contentType: 'image/png', body: readFileSync(file) });
        return route.fulfill({ status: 404, body: '' });
    }
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/ws' || url.pathname.startsWith('/ws/')) return route.abort();
    if (url.pathname.startsWith('/backend/')) {
        const path = url.pathname.slice('/backend'.length);
        const row = table.find(({ method, pattern }) => method === request.method() && pattern.test(path));
        if (!row) {
            unanswered.add(`${request.method()} ${path}`);
            return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'no fixture' }) });
        }
        const { status = 200, json } = row.answer;
        return route.fulfill({ status, contentType: 'application/json', body: json === undefined ? '' : JSON.stringify(json) });
    }
    return route.continue();
}

async function shoot(browser, origin, scene, viewport, out) {
    const { width, height } = parseViewport(viewport);
    const phone = Math.min(width, height) <= 500;
    const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: scene.dpr ?? (phone ? 2 : 1),
        isMobile: phone,
        hasTouch: phone,
        colorScheme: 'dark',
    });
    const table = apiTable(scene);
    const unanswered = new Set();
    try {
        await context.addInitScript(({ token, user, devOnlyCss }) => {
            try {
                localStorage.setItem('stiglja:table-effects', 'off');
                if (token) {
                    localStorage.setItem('authToken', token);
                    localStorage.setItem('user', JSON.stringify(user));
                }
            } catch {
                // about:blank has no storage
            }
            document.addEventListener('DOMContentLoaded', () => {
                const style = document.createElement('style');
                style.textContent = devOnlyCss;
                document.head.append(style);
            });
        }, { token: scene.user ? fakeToken(scene.user) : null, user: scene.user ?? null, devOnlyCss: DEV_ONLY_CSS });
        await context.route('**/*', (route) => answer(route, table, unanswered, origin));
        await context.routeWebSocket(/\/ws(\/|$)/, (socket) => socket.close());
        const page = await context.newPage();
        await page.goto(origin + scene.path, { waitUntil: 'networkidle', timeout: GOTO_TIMEOUT_MS });
        await page.evaluate(() => document.fonts.ready);
        if (scene.setup) await scene.setup(page);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(SETTLE_MS);
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const file = join(out, `${scene.name}@${width}x${height}.png`);
        await page.screenshot({ path: file, fullPage: Boolean(scene.fullPage), animations: 'disabled', caret: 'hide' });
        return { file, sideways: width <= NARROW ? sideways : 0, unanswered: [...unanswered] };
    } finally {
        await context.close();
    }
}

const opt = parseArgs(process.argv.slice(2));
const scenes = await loadScenes(opt);
if (opt.list) {
    for (const scene of scenes) {
        console.log(`${scene.file}  ${scene.name}  ${scene.path}  ${scene.viewports.join(' ')}  ${scene.user ? `as ${scene.user.username}` : 'signed out'}`);
    }
    process.exit(0);
}

let chromium;
try {
    ({ chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE_DIR ?? 'playwright-core'));
} catch {
    usage('playwright-core not found: set PLAYWRIGHT_CORE_DIR to playwright-core 1.62.1 installed outside this repo');
}
mkdirSync(opt.out, { recursive: true });
const { server, origin } = await startDevServer(opt.port);
const failures = [];
let browser;
try {
    browser = await chromium.launch({ headless: true });
    for (const scene of scenes) {
        for (const viewport of scene.viewports) {
            try {
                const shot = await shoot(browser, origin, scene, viewport, opt.out);
                console.log(`shot  ${shot.file}`);
                if (shot.unanswered.length) console.log(`      unanswered: ${shot.unanswered.join(', ')}`);
                if (shot.sideways > 0) failures.push(`${scene.name}@${viewport} scrolls sideways by ${shot.sideways} px`);
            } catch (error) {
                failures.push(`${scene.name}@${viewport}: ${String(error.message ?? error).split('\n')[0]}`);
            }
        }
    }
} finally {
    await browser?.close();
    server.kill('SIGTERM');
}
for (const failure of failures) console.error(`FAIL  ${failure}`);
console.log(failures.length ? `visual: ${failures.length} failure(s)` : `visual: ${scenes.length} scene(s) shot, nothing scrolls sideways at ${NARROW} px`);
process.exit(failures.length ? 1 : 0);
