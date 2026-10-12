// Reduced motion (spec §7.3, §3.8): with prefers-reduced-motion, a /dev/board replay at Effects Full moves no
// card while it can be seen. Every animation frame records each card element's box and its opacity (its own
// times its ancestors'); a card whose box changes between two frames must be invisible (opacity 0) in one of
// them: fade out, jump, fade in, never a slide. The particle canvas stays Off and draws nothing that moves,
// and the felt never shows a cross-fade (no felt layer at an opacity between 0 and 1).

const SCENE = { name: 'reduced-replay', path: '/dev/board?controls=0&effects=full&seat=carol&hands=1&play=1&speed=2', viewports: ['1440x900'] };
// one hand at speed 2: the deal, the bids, the trump call, 32 cards, the sweeps, the hand result
const RECORD_MS = 20000;

export default {
    name: 'reduced',
    about: 'prefers-reduced-motion: in a /dev/board replay no card moves while visible, no particle moves, the felt switches at once',
    async run(ctx) {
        const failures = [];
        for (const viewport of SCENE.viewports) {
            const { context, page } = await ctx.open(SCENE, viewport, { context: { reducedMotion: 'reduce' }, animate: true });
            try {
                const result = await page.evaluate((ms) => new Promise((done) => {
                    const ids = new WeakMap();
                    let next = 0;
                    const last = new Map();
                    const moves = [];
                    const felts = [];
                    let frames = 0;
                    let canvasChanges = 0;
                    let canvasState = null;
                    let canvasMode = null;
                    const opacity = (element) => {
                        let value = 1;
                        for (let node = element; node && node.nodeType === 1; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
                        return value;
                    };
                    const canvasHash = () => {
                        const canvas = document.querySelector('[data-testid="arena"] canvas');
                        if (!canvas || !canvas.width || !canvas.height) return 'none';
                        canvasMode = canvas.dataset.effects;
                        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                        let hash = 0;
                        for (let i = 3; i < data.length; i += 16) hash = (hash * 31 + data[i] + data[i - 1]) | 0;
                        return hash;
                    };
                    const start = performance.now();
                    const frame = (t) => {
                        frames++;
                        for (const element of document.querySelectorAll('.board-card')) {
                            if (!ids.has(element)) ids.set(element, next++);
                            const id = ids.get(element);
                            const box = element.getBoundingClientRect();
                            const seen = { x: box.x, y: box.y, w: box.width, h: box.height, o: opacity(element), t };
                            const before = last.get(id);
                            if (before) {
                                const moved = Math.abs(before.x - seen.x) > 0.5 || Math.abs(before.y - seen.y) > 0.5 || Math.abs(before.w - seen.w) > 0.5 || Math.abs(before.h - seen.h) > 0.5;
                                if (moved && before.o > 0.01 && seen.o > 0.01) {
                                    moves.push(`${element.dataset.card ?? element.className} moved (${Math.round(before.x)},${Math.round(before.y)}) → (${Math.round(seen.x)},${Math.round(seen.y)}) at opacity ${before.o.toFixed(2)}/${seen.o.toFixed(2)} after ${Math.round(t - start)} ms`);
                                }
                            }
                            last.set(id, seen);
                        }
                        for (const felt of document.querySelectorAll('.board-arena__felt')) {
                            const value = Number(getComputedStyle(felt).opacity);
                            if (value > 0.01 && value < 0.99) felts.push(`a felt layer at opacity ${value.toFixed(2)} after ${Math.round(t - start)} ms`);
                        }
                        if (frames % 10 === 0) {
                            const hash = canvasHash();
                            if (canvasState !== null && hash !== canvasState) canvasChanges++;
                            canvasState = hash;
                        }
                        if (t - start < ms) requestAnimationFrame(frame);
                        else done({ frames, cards: next, moves, felts, canvasChanges, canvasMode, season: document.querySelector('[data-testid="arena"]')?.dataset.season ?? null });
                    };
                    requestAnimationFrame(frame);
                }), RECORD_MS);
                ctx.log(`${SCENE.name}@${viewport}: ${result.frames} frames, ${result.cards} card elements, season ${result.season}, particles ${result.canvasMode}`);
                if (result.cards < 32) failures.push(`${SCENE.name}@${viewport}: only ${result.cards} card elements seen; the replay did not run`);
                if (result.season === 'none' || result.season === null) failures.push(`${SCENE.name}@${viewport}: no trump was called during the replay`);
                for (const move of result.moves.slice(0, 10)) failures.push(`${SCENE.name}@${viewport}: ${move}`);
                if (result.moves.length > 10) failures.push(`${SCENE.name}@${viewport}: … and ${result.moves.length - 10} more visible moves`);
                for (const felt of result.felts.slice(0, 3)) failures.push(`${SCENE.name}@${viewport}: ${felt}`);
                if (result.canvasMode !== 'off') failures.push(`${SCENE.name}@${viewport}: the particles are "${result.canvasMode}", not off`);
                if (result.canvasChanges) failures.push(`${SCENE.name}@${viewport}: the particle canvas changed ${result.canvasChanges} times`);
            } finally {
                await context.close();
            }
        }
        return failures;
    },
};
