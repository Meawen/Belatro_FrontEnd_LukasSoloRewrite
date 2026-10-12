// Performance (spec §7.3, §3.8): a production-mode build with the dev board (VITE_DEV_BOARD=1), served by
// `vite preview`, replays one hand at Effects Full under a 4× CPU slowdown (CDP Emulation.setCPUThrottlingRate);
// the 95th percentile of the time between animation frames must stay at or under 20 ms. The build goes to
// e2e/visual/out/perf-dist (git-ignored) and is made afresh on every run.
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { CARD_ART, ROOT, VISUAL, openScene, startVite } from '../lib.mjs';

const PORT = 5198;
const DIST = join(VISUAL, 'out', 'perf-dist');
const SCENE = { name: 'perf-replay', path: '/dev/board?effects=full&seat=carol&hands=1&speed=1', viewports: ['1440x900', '375x812'] };
const P95_LIMIT_MS = 20;
const MAX_MS = 90000;

export default {
    name: 'perf',
    about: 'a production build with the dev board replays a hand at Effects Full, 4x CPU slowdown: rAF p95 <= 20 ms',
    async run(ctx) {
        const env = { ...process.env, VITE_DEV_BOARD: '1', VITE_API_BASE_URL: 'https://api.example.test', VITE_CARD_ART_BASE_URL: CARD_ART };
        const build = spawnSync(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', DIST, '--emptyOutDir'], { cwd: ROOT, env, encoding: 'utf8' });
        if (build.status !== 0) return [`the production build failed:\n${build.stdout}${build.stderr}`];
        const origin = `http://127.0.0.1:${PORT}`;
        const server = await startVite(['preview', '--outDir', DIST, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], origin, env);
        const failures = [];
        try {
            for (const viewport of SCENE.viewports) {
                const { context, page } = await openScene(ctx.browser, origin, SCENE, viewport, { animate: true });
                try {
                    const cdp = await context.newCDPSession(page);
                    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
                    await page.getByRole('button', { name: 'Play', exact: true }).click();
                    const result = await page.evaluate((max) => new Promise((done) => {
                        const gaps = [];
                        let last = performance.now();
                        const start = last;
                        const frame = (t) => {
                            gaps.push(t - last);
                            last = t;
                            const ended = document.querySelector('[data-testid="hand-result"]');
                            if (ended || t - start > max) done({ gaps, ended: Boolean(ended), ms: t - start });
                            else requestAnimationFrame(frame);
                        };
                        requestAnimationFrame(frame);
                    }), MAX_MS);
                    const sorted = [...result.gaps].sort((a, b) => a - b);
                    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? Infinity;
                    ctx.log(`${SCENE.name}@${viewport}: ${result.gaps.length} frames in ${Math.round(result.ms)} ms, p95 ${p95.toFixed(1)} ms, worst ${sorted.at(-1)?.toFixed(1)} ms`);
                    if (!result.ended) failures.push(`${SCENE.name}@${viewport}: the hand did not end within ${MAX_MS / 1000} s`);
                    if (p95 > P95_LIMIT_MS) failures.push(`${SCENE.name}@${viewport}: rAF p95 ${p95.toFixed(1)} ms > ${P95_LIMIT_MS} ms`);
                } finally {
                    await context.close();
                }
            }
        } finally {
            server.kill('SIGTERM');
        }
        return failures;
    },
};
