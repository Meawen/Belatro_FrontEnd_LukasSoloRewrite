// The visual harness's machinery (e2e/visual.mjs and the checks in e2e/visual/checks/): the dev server, a
// signed-in browser context with the scene's API fixtures, shots, and pixel work done inside Chromium (no
// image library: spec §7.3). Nothing here runs on import.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const VISUAL = join(ROOT, 'e2e', 'visual');
export const SCENES_DIR = join(VISUAL, 'scenes');
export const CHECKS_DIR = join(VISUAL, 'checks');
export const API_DIR = join(VISUAL, 'fixtures', 'api');
export const CARDS_DIR = join(VISUAL, 'fixtures', 'cards');
export const BASELINE_DIR = join(VISUAL, 'baseline');
// The dev server's card art origin during a run; nothing is fetched from it, the harness answers it.
export const CARD_ART = 'https://card-art.visual.test/v1';
// Pages at most this wide must not scroll sideways (spec §7.3, R-37).
export const NARROW = 375;
// Every page sees this time (Date only; timers, animation frames and motion run as usual), so relative dates,
// countdowns and "Created …" lines draw the same in every run: shots compare with their baselines.
export const FROZEN_TIME = Date.parse('2026-10-10T12:00:00Z');
// …and this language and time zone, whatever the machine's.
export const LOCALE = 'en-US';
export const TIMEZONE = 'Europe/Zagreb';
// A shot fails its baseline when more than this share of its pixels differ (spec §7.3).
export const MAX_DIFF = 0.002;
const GOTO_TIMEOUT_MS = 60000;
// Sheets and toasts spring in for about 0.3 s; animations are off for the shot itself.
const SETTLE_MS = 400;
// React Query's devtools toggle (dev server only; a build has none) floats over the bottom-right corner,
// the tab bar's More included: hidden in every shot.
const DEV_ONLY_CSS = '.tsqd-open-btn-container { display: none !important; }';

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** "375x812" → { width: 375, height: 812 }; null when it is not one. */
export function parseViewport(text) {
    const match = /^(\d+)x(\d+)$/.exec(text);
    return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

/** The scene's answers, merged left to right, as rows to match; exact paths before "*" patterns. Throws on a missing file. */
export function apiTable(scene) {
    const merged = {};
    for (const source of scene.api ?? []) {
        if (typeof source !== 'string') Object.assign(merged, source);
        else if (existsSync(join(API_DIR, source))) Object.assign(merged, JSON.parse(readFileSync(join(API_DIR, source), 'utf8')));
        else throw new Error(`scene ${scene.name}: no fixture e2e/visual/fixtures/api/${source}`);
    }
    return Object.entries(merged)
        .map(([key, answer]) => {
            const [method, path] = key.split(' ');
            const segments = path.split('/').map((part) => (part === '*' ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
            return { method, pattern: new RegExp(`^${segments.join('/')}$`), exact: !path.split('/').includes('*'), answer };
        })
        .sort((a, b) => Number(b.exact) - Number(a.exact));
}

/** An unsigned JWT the SPA accepts as a live session at FROZEN_TIME: it reads `exp`, the server is never asked. */
export function fakeToken(user) {
    const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(FROZEN_TIME / 1000);
    return `${part({ alg: 'none' })}.${part({ sub: user.username, iat: now, exp: now + 7200 })}.visual`;
}

/** Runs Vite (`args` after vite.js) until `origin` answers; resolves with the child process. */
export async function startVite(args, origin, env = {}) {
    const server = spawn(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), ...args], {
        cwd: ROOT,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    server.stdout.on('data', (chunk) => (output += chunk));
    server.stderr.on('data', (chunk) => (output += chunk));
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
        if (server.exitCode !== null) throw new Error(`vite ${args[0]} stopped:\n${output}`);
        try {
            if ((await fetch(origin)).ok) return server;
        } catch {
            // not listening yet
        }
        await sleep(250);
    }
    server.kill('SIGTERM');
    throw new Error(`vite did not answer on ${origin} within 60 s:\n${output}`);
}

/** The dev server, with the card art pointing at the harness. */
export async function startDevServer(port) {
    const origin = `http://127.0.0.1:${port}`;
    const server = await startVite(['--host', '127.0.0.1', '--port', String(port), '--strictPort'], origin, { VITE_CARD_ART_BASE_URL: CARD_ART });
    return { server, origin };
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

/**
 * A fresh context for one scene at one viewport, signed in as the scene's user, its API answered, the page
 * opened and settled, the scene's setup run. Every motion animation is skipped (MotionGlobalConfig, through
 * src/main.tsx on the dev server) unless `animate`; `context` holds more context options (reducedMotion,
 * contrast, forcedColors, …). Phones (the short side at most 500 px) get a touch screen at 2× unless the scene
 * says `dpr`; `css` is a style sheet added once the page has loaded, followed by a resize event so that layouts
 * measured in script (the board's safe-area insets) measure again; it needs !important to beat the page's own.
 * The caller closes the returned `context`.
 */
export async function openScene(browser, origin, scene, viewport, { context: extra = {}, animate = false, css = null } = {}) {
    const { width, height } = parseViewport(viewport);
    const phone = Math.min(width, height) <= 500;
    const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: scene.dpr ?? (phone ? 2 : 1),
        isMobile: phone,
        hasTouch: phone,
        colorScheme: 'dark',
        locale: LOCALE,
        timezoneId: TIMEZONE,
        ...extra,
    });
    const table = apiTable(scene);
    const unanswered = new Set();
    try {
        await context.clock.setFixedTime(FROZEN_TIME);
        await context.addInitScript(({ token, user, devOnlyCss, skip }) => {
            window.__visualSkipAnimations = skip;
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
        }, { token: scene.user ? fakeToken(scene.user) : null, user: scene.user ?? null, devOnlyCss: DEV_ONLY_CSS, skip: !animate });
        await context.route('**/*', (route) => answer(route, table, unanswered, origin));
        await context.routeWebSocket(/\/ws(\/|$)/, (socket) => socket.close());
        const page = await context.newPage();
        await page.goto(origin + scene.path, { waitUntil: 'networkidle', timeout: GOTO_TIMEOUT_MS });
        await page.evaluate(() => document.fonts.ready);
        if (css) {
            await page.addStyleTag({ content: css });
            await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        }
        if (scene.setup) await scene.setup(page);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(SETTLE_MS);
        return { context, page, unanswered };
    } catch (error) {
        await context.close();
        throw error;
    }
}

/** How far the page scrolls sideways (0 when it fits). */
export const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/** One shot of `scene` at `viewport` into `file` (animations disabled); what scrolled sideways and went unanswered. */
export async function shoot(browser, origin, scene, viewport, file) {
    const { context, page, unanswered } = await openScene(browser, origin, scene, viewport);
    try {
        const over = await sideways(page);
        await page.screenshot({ path: file, fullPage: Boolean(scene.fullPage), animations: 'disabled', caret: 'hide' });
        return { file, sideways: parseViewport(viewport).width <= NARROW ? over : 0, unanswered: [...unanswered] };
    } finally {
        await context.close();
    }
}

/** The baselines' folder name: the platform and the exact Chromium (spec §7.3), e.g. "darwin-arm64-chromium151.0.7922.34". */
export const platformKey = (browser) => `${process.platform}-${process.arch}-chromium${browser.version()}`;

/**
 * Compares two PNGs inside Chromium (both drawn on a canvas, read with getImageData): the share of pixels whose
 * colour differs at all, and a diff image (the differing pixels red over a dimmed copy of `actual`).
 * `tool` is any page (about:blank is enough).
 */
export async function comparePngs(tool, expected, actual) {
    const result = await tool.evaluate(async ({ a, b }) => {
        const load = (data) => new Promise((done, fail) => {
            const image = new Image();
            image.onload = () => done(image);
            image.onerror = () => fail(new Error('not a PNG'));
            image.src = `data:image/png;base64,${data}`;
        });
        const [one, two] = await Promise.all([load(a), load(b)]);
        if (one.width !== two.width || one.height !== two.height) {
            return { sizeMismatch: `${one.width}x${one.height} vs ${two.width}x${two.height}`, ratio: 1, differing: 0, total: 0, diff: null };
        }
        const pixels = (image) => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(image, 0, 0);
            return context.getImageData(0, 0, image.width, image.height);
        };
        const first = pixels(one).data;
        const second = pixels(two);
        const out = new ImageData(second.width, second.height);
        let differing = 0;
        for (let i = 0; i < first.length; i += 4) {
            const same = first[i] === second.data[i] && first[i + 1] === second.data[i + 1] && first[i + 2] === second.data[i + 2] && first[i + 3] === second.data[i + 3];
            if (!same) differing++;
            out.data[i] = same ? second.data[i] / 4 : 255;
            out.data[i + 1] = same ? second.data[i + 1] / 4 : 0;
            out.data[i + 2] = same ? second.data[i + 2] / 4 : 0;
            out.data[i + 3] = 255;
        }
        let diff = null;
        if (differing) {
            const canvas = document.createElement('canvas');
            canvas.width = second.width;
            canvas.height = second.height;
            canvas.getContext('2d').putImageData(out, 0, 0);
            diff = canvas.toDataURL('image/png').split(',')[1];
        }
        const total = first.length / 4;
        return { sizeMismatch: null, ratio: differing / total, differing, total, diff };
    }, { a: expected.toString('base64'), b: actual.toString('base64') });
    return { ...result, diff: result.diff ? Buffer.from(result.diff, 'base64') : null };
}

/** How many pixels of `png` are each colour of `colours` ("#fbf236"), within `tolerance` per channel. Inside Chromium. */
export async function countColours(tool, png, colours, tolerance = 2) {
    return tool.evaluate(async ({ data, colours, tolerance }) => {
        const image = await new Promise((done, fail) => {
            const element = new Image();
            element.onload = () => done(element);
            element.onerror = () => fail(new Error('not a PNG'));
            element.src = `data:image/png;base64,${data}`;
        });
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, image.width, image.height).data;
        const wanted = colours.map((hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)));
        const counts = wanted.map(() => 0);
        for (let i = 0; i < pixels.length; i += 4) {
            wanted.forEach(([r, g, b], k) => {
                if (Math.abs(pixels[i] - r) <= tolerance && Math.abs(pixels[i + 1] - g) <= tolerance && Math.abs(pixels[i + 2] - b) <= tolerance) counts[k]++;
            });
        }
        return Object.fromEntries(colours.map((hex, k) => [hex, counts[k]]));
    }, { data: png.toString('base64'), colours, tolerance });
}
