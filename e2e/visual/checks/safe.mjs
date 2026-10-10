// Safe areas in landscape (Review focus; spec §3.4): headless Chromium has no notch, so the check gives the page
// one, the way an iPhone in landscape reports it (--safe-right/left 44 px, --safe-bottom 21 px for the home
// indicator), at 812×375 and at 812×340 (Safari with its toolbar). On the board every card, chip and control must
// then lie inside the safe rectangle. My hand's cards may tuck a quarter of their height below its bottom edge
// (spec §5.6.2) but keep their sides and top inside it. A docked sheet's panel runs to the screen's edge (its
// content is padded by the insets), so for sheets only their controls are checked.

const INSETS = { top: 0, right: 44, bottom: 21, left: 44 };
const VIEWPORTS = ['812x375', '812x340'];
// the share of a hand card that may tuck below the safe area (spec §5.6.2: a quarter in landscape)
const TUCK = 0.25;
const at = (label, extra = '') => `/dev/board?controls=0&skip=1&effects=off&seat=carol&at=${label}${extra}`;
const SCENES = [
    { name: 'safe-bidding', path: at('bid:bob:PASS') },
    { name: 'safe-mid-trick', path: at('play:bob:PIK-BABA') },
    { name: 'safe-hand-result', path: at('window-open') },
    { name: 'safe-end', path: at('game-over', '&scores=990,900') },
    { name: 'safe-long-names', path: at('play:bob:PIK-BABA', '&names=long') },
];
const NOTCH = `:root { ${Object.entries(INSETS).map(([side, px]) => `--safe-${side}: ${px}px !important;`).join(' ')} }`;

export default {
    name: 'safe',
    about: 'with a landscape notch and home indicator (812x375, 812x340) every card, chip and control of the board stays inside the safe area',
    async run(ctx) {
        const failures = [];
        for (const base of SCENES) {
            for (const viewport of VIEWPORTS) {
                const scene = {
                    ...base,
                    viewports: [viewport],
                };
                const { context, page } = await ctx.open(scene, viewport, { css: NOTCH });
                try {
                    const result = await page.evaluate(({ insets, tuck }) => {
                        const safe = { left: insets.left, top: insets.top, right: window.innerWidth - insets.right, bottom: window.innerHeight - insets.bottom };
                        const problems = [];
                        const seen = new Set();
                        const items = document.querySelectorAll('.board .board-card, .board [data-testid^="seat-"], .board [data-testid^="pile-"], .board button, .board [data-testid="your-turn"], .ui-sheet button');
                        for (const element of items) {
                            if (seen.has(element) || element.closest('[inert]')) continue;
                            seen.add(element);
                            const r = element.getBoundingClientRect();
                            if (r.width === 0 || r.height === 0 || getComputedStyle(element).visibility === 'hidden') continue;
                            let opacity = 1;
                            for (let node = element; node && node.nodeType === 1; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
                            if (opacity < 0.05) continue;
                            const hand = element.matches('[data-testid="hand-card"]');
                            const out = [];
                            if (r.left < safe.left - 0.5) out.push(`left ${Math.round(r.left)} < ${safe.left}`);
                            if (r.right > safe.right + 0.5) out.push(`right ${Math.round(r.right)} > ${safe.right}`);
                            if (r.top < safe.top - 0.5) out.push(`top ${Math.round(r.top)} < ${safe.top}`);
                            const shown = safe.bottom - r.top;
                            if (hand ? shown < (1 - tuck) * element.offsetHeight - 1 : r.bottom > safe.bottom + 0.5) {
                                out.push(hand ? `only ${Math.round(shown)} of ${element.offsetHeight} px above the home indicator` : `bottom ${Math.round(r.bottom)} > ${safe.bottom}`);
                            }
                            if (!out.length) continue;
                            const name = element.dataset.testid ?? element.getAttribute('aria-label') ?? element.dataset.card ?? (element.textContent.trim().slice(0, 24) || element.className);
                            problems.push(`${element.tagName.toLowerCase()} "${name}": ${out.join(', ')}`);
                        }
                        return { problems, count: seen.size };
                    }, { insets: INSETS, tuck: TUCK });
                    ctx.log(`${base.name}@${viewport}: ${result.count} elements`);
                    for (const problem of result.problems) failures.push(`${base.name}@${viewport}: ${problem}`);
                } finally {
                    await context.close();
                }
            }
        }
        return failures;
    },
};
