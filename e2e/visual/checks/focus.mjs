// Focus (spec §7.3, §3.4, §3.9): Tab to a Button, an Input, a ListRow, a lobby seat and a hand card; the shot of
// each, focused, holds the 2-px ring: the accent #fbf236, or the ink #222034 on the yellow primary button. A
// control may hold those colours unfocused too (a yellow button, a seat's own accent), so the ring counts as
// the extra pixels of either colour against a shot of the same box with focus taken away; it must add at
// least the box's width + height (a 2-px ring all round adds about four times that).

const ACCENT = '#fbf236';
const INK = '#222034';
const TARGETS = [
    { what: 'a Button', scene: 'auth-login', selector: 'button.ui-btn' },
    { what: 'an Input', scene: 'auth-login', selector: 'input.ui-field__control', box: '.ui-field__box' },
    { what: 'a ListRow', scene: 'lobby-list', selector: '.ui-row' },
    { what: 'a lobby seat', scene: 'lobby-member', selector: '[data-testid="lobby-table"] button' },
    { what: 'a hand card', scene: 'board-mid-trick', selector: '[data-testid="hand-card"]' },
];
const VIEWPORT = '1440x900';
const MAX_TABS = 80;

export default {
    name: 'focus',
    about: 'Tab reaches a Button, Input, ListRow, lobby seat and hand card, and each shows the accent (or ink) ring',
    async run(ctx) {
        const failures = [];
        for (const target of TARGETS) {
            const { context, page } = await ctx.open(ctx.scene(target.scene), VIEWPORT);
            try {
                let reached = false;
                for (let tab = 0; tab < MAX_TABS && !reached; tab++) {
                    await page.keyboard.press('Tab');
                    reached = await page.evaluate((selector) => document.activeElement?.matches(selector) ?? false, target.selector);
                }
                if (!reached) {
                    failures.push(`${target.scene}: ${MAX_TABS} Tabs never reached ${target.what} (${target.selector})`);
                    continue;
                }
                const clip = await page.evaluate(({ box }) => {
                    const element = box ? document.activeElement.closest(box) : document.activeElement;
                    const r = element.getBoundingClientRect();
                    return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: r.width + 8, height: r.height + 8 };
                }, { box: target.box });
                const focused = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
                await page.evaluate(() => document.activeElement?.blur());
                await page.waitForTimeout(100);
                const blurred = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
                const on = await ctx.countColours(focused, [ACCENT, INK]);
                const off = await ctx.countColours(blurred, [ACCENT, INK]);
                const added = Math.max(on[ACCENT] - off[ACCENT], on[INK] - off[INK]);
                const needed = Math.round(clip.width + clip.height - 16);
                ctx.log(`${target.what} (${target.scene}): +${on[ACCENT] - off[ACCENT]} accent, +${on[INK] - off[INK]} ink px focused (need ${needed})`);
                if (added < needed) failures.push(`${target.scene}: ${target.what} focused adds ${added} ring pixels, fewer than ${needed}`);
            } finally {
                await context.close();
            }
        }
        return failures;
    },
};
