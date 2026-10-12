// More contrast (spec §7.3, §3.4): with prefers-contrast: more, the pixel edges (the 3-px inset box-shadow of
// panels, rows, buttons and fields, on the element or its ::before) are drawn in --edge-strong #6aa898, and
// none in the everyday --edge #2c5a52, which the same pages do show without the preference (a control).
// --text-2 and --text-3 lighten to #d8e1e5 and #b5c3ca. Scenes: the lobby list, Create lobby, Settings.

const EDGE = 'rgb(44, 90, 82)';
const STRONG = 'rgb(106, 168, 152)';
const SCENES = ['lobby-list', 'lobby-create', 'shell-settings-admin'];

/** Every 3-px inset edge on the page, by colour, and the --text-2/--text-3 values. */
function edges(page) {
    return page.evaluate(() => {
        const counts = {};
        for (const element of document.querySelectorAll('body *')) {
            for (const pseudo of [null, '::before', '::after']) {
                const shadow = getComputedStyle(element, pseudo).boxShadow;
                if (!shadow || shadow === 'none') continue;
                for (const part of shadow.split(/,(?![^(]*\))/)) {
                    if (!/inset/.test(part) || !/\b0px 0px 0px 3px\b/.test(part)) continue;
                    const colour = part.match(/rgba?\([^)]*\)/)?.[0] ?? 'none';
                    counts[colour] = (counts[colour] ?? 0) + 1;
                }
            }
        }
        const root = getComputedStyle(document.documentElement);
        return { counts, text2: root.getPropertyValue('--text-2').trim(), text3: root.getPropertyValue('--text-3').trim() };
    });
}

export default {
    name: 'contrast',
    about: 'prefers-contrast: more draws every pixel edge in --edge-strong and lightens --text-2/--text-3',
    async run(ctx) {
        const failures = [];
        for (const name of SCENES) {
            const scene = ctx.scene(name);
            for (const viewport of scene.viewports) {
                for (const contrast of ['no-preference', 'more']) {
                    const { context, page } = await ctx.open(scene, viewport, { context: { contrast } });
                    try {
                        const { counts, text2, text3 } = await edges(page);
                        const where = `${name}@${viewport} (${contrast})`;
                        ctx.log(`${where}: ${Object.entries(counts).map(([colour, n]) => `${n}× ${colour}`).join(', ')}; --text-2 ${text2}`);
                        if (contrast === 'more') {
                            if (counts[EDGE]) failures.push(`${where}: ${counts[EDGE]} edge(s) still in --edge ${EDGE}`);
                            if (!counts[STRONG]) failures.push(`${where}: no edge in --edge-strong ${STRONG}`);
                            if (text2 !== '#d8e1e5' || text3 !== '#b5c3ca') failures.push(`${where}: --text-2 ${text2}, --text-3 ${text3} (want #d8e1e5, #b5c3ca)`);
                        } else if (!counts[EDGE]) failures.push(`${where}: no --edge edge at all, so the check proves nothing here`);
                    } finally {
                        await context.close();
                    }
                }
            }
        }
        return failures;
    },
};
