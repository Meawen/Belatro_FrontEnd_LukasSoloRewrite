// Forced colours (spec §7.3, §3.4): with forced-colors: active (Windows High Contrast) the inset-shadow edges
// vanish, so Button, Input, ListRow and Sheet must draw a border instead (style other than none). Scene: the
// Create lobby sheet over the lobby list (rows, the "Create lobby" button, the "Lobby name" field, the sheet).
// Without forced colours the same Button has no border (a control: the media query is what adds it).

const PARTS = {
    Button: '.ui-btn',
    Input: '.ui-field__box',
    ListRow: '.ui-row',
    Sheet: '.ui-sheet',
};

function borders(page) {
    return page.evaluate((parts) => Object.fromEntries(Object.entries(parts).map(([part, selector]) => {
        const found = [...document.querySelectorAll(selector)];
        return [part, { count: found.length, none: found.filter((element) => getComputedStyle(element).borderTopStyle === 'none').length }];
    })), PARTS);
}

export default {
    name: 'forced',
    about: 'forced-colors: active gives Button, Input, ListRow and Sheet a border',
    async run(ctx) {
        const failures = [];
        const scene = ctx.scene('lobby-create');
        for (const viewport of scene.viewports) {
            for (const forcedColors of ['none', 'active']) {
                const { context, page } = await ctx.open(scene, viewport, { context: { forcedColors } });
                try {
                    const found = await borders(page);
                    const where = `lobby-create@${viewport} (forced colours ${forcedColors})`;
                    ctx.log(`${where}: ${Object.entries(found).map(([part, { count, none }]) => `${part} ${count - none}/${count} bordered`).join(', ')}`);
                    for (const [part, { count, none }] of Object.entries(found)) {
                        if (!count) failures.push(`${where}: no ${part} (${PARTS[part]}) on the page`);
                        else if (forcedColors === 'active' && none) failures.push(`${where}: ${none} of ${count} ${part} without a border`);
                    }
                    if (forcedColors === 'none' && found.Button.none === 0) failures.push(`${where}: every Button has a border even without forced colours, so the check proves nothing`);
                } finally {
                    await context.close();
                }
            }
        }
        return failures;
    },
};
