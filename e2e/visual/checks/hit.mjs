// Hit-testing with every sheet closed (spec §7.3, §3.7 "a closed sheet … never takes input"): at 1440×900 and
// 375×812, after the game menu has been opened and closed again, document.elementFromPoint at the centre of
// each bid button, and at the middle of each hand card's exposed strip (the part the next card leaves
// uncovered; the whole card for the last), returns that button. Board scenes come from /dev/board (Phase 4).
// With the coach's panel up (coach=demo, open beta §7.2, §7.3), the bid buttons, every hand card and the panel's own
// button still answer elementFromPoint, the panel scrolled to its end (a lesson's "do" line comes last), and the
// panel stays off the bid panel (board-fit's layout places it: coachSpot). coach=long brings a lesson taller than the
// panel's room (it must scroll), at 375×812 and 812×375.
// Not the point 10 px in and 30 px down of the card's bounding box: at 1440 the fan tilts the right-hand cards
// clockwise, so that corner of their box lies on the card to their left.

const VIEWPORTS = ['1440x900', '375x812'];
const board = (at, coach = null, viewports = VIEWPORTS) => ({
    name: `hit-${at}${coach === 'demo' ? '-coach' : coach ? `-coach-${coach}` : ''}`,
    path: `/dev/board?controls=0&skip=1&effects=off&seat=carol&at=${at}${coach ? `&coach=${coach}` : ''}`,
    viewports,
    coach,
});
// carol to bid after two passes (the bid panel up, six cards); carol to play in mid-trick (eight cards, enabled); both
// again with the stand-in coach's panel and marks; and bidding under a long lesson, on a portrait and a landscape phone
const SCENES = [
    board('bid:bob:PASS'), board('play:bob:PIK-BABA'), board('bid:bob:PASS', 'demo'), board('play:bob:PIK-BABA', 'demo'),
    board('bid:bob:PASS', 'long', ['375x812', '812x375']),
];
const BIDS = ['Pass', 'Call Herc', 'Call Karo', 'Call Pik', 'Call Tref'];
// The owner's hover lift (D-35) without its z-order raise (owner, Task M, 2026-11-11): with a hand card hovered, the
// middle of its right neighbour's exposed strip belongs to that neighbour, and a click there plays it (carol to play
// mid-trick, eight enabled cards; fine pointers, so the windows that lift)
const HOVER = board('play:bob:PIK-BABA', null, ['1280x720', '1440x900', '960x980']);

/** Opens the game menu, closes it with Escape, and waits until it has left (unmounted after its exit). */
async function openAndCloseTheMenu(page) {
    await page.getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('dialog', { name: 'Game menu' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'Game menu' }).waitFor({ state: 'detached' });
}

/** Scrolls the coach's panel to its end; its box, whether it scrolls, and the bid panel's box (null without one). */
function coachPanel(page) {
    return page.evaluate(() => {
        const panel = document.querySelector('.board-coach__panel');
        if (!panel) return null;
        panel.scrollTop = panel.scrollHeight;
        const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
        const bid = document.querySelector('.board-bid');
        return { ...box(panel), scrolls: panel.scrollHeight > panel.clientHeight, bid: bid ? box(bid) : null };
    });
}

/** The points to test, in page coordinates, each with what must be hit there: the buttons named `names`, and every hand card. */
function targets(page, names) {
    return page.evaluate((names) => {
        const points = [];
        for (const name of names) {
            const button = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === name || b.textContent.trim() === name);
            if (!button) {
                points.push({ what: `the "${name}" button`, missing: true });
                continue;
            }
            const r = button.getBoundingClientRect();
            points.push({ what: `the "${name}" button`, x: r.x + r.width / 2, y: r.y + r.height / 2, index: -1, name });
        }
        const cards = [...document.querySelectorAll('[data-testid="hand-card"]')];
        cards.forEach((card, index) => {
            const r = card.getBoundingClientRect();
            const next = cards[index + 1]?.getBoundingClientRect();
            const strip = next ? Math.max(1, next.x - r.x) : r.width;
            // the middle of the part above the window's bottom: sideways only 45 % of each card shows (board-fit spec §3.4)
            points.push({ what: `hand card ${card.dataset.card} in its strip's middle`, x: r.x + Math.min(strip, r.width) / 2, y: r.y + Math.min(r.height, innerHeight - r.y) / 2, index });
        });
        return { points, cards: cards.length };
    }, names);
}

export default {
    name: 'hit',
    about: 'closed sheets take no input: the bid buttons and every hand card answer elementFromPoint (1440, 375); with the '
        + "coach's panel up, the bid buttons, every hand card and the panel's own button still do, and a long lesson scrolls "
        + 'above the bid panel (375, 812×375)',
    async run(ctx) {
        const failures = [];
        for (const scene of SCENES) {
            for (const viewport of scene.viewports) {
                const { context, page } = await ctx.open(scene, viewport);
                try {
                    await openAndCloseTheMenu(page);
                    let coachLine = '';
                    if (scene.coach) {
                        const panel = await coachPanel(page);
                        if (!panel) failures.push(`${scene.name}@${viewport}: no coach panel`);
                        else {
                            const { bid } = panel;
                            if (bid && panel.left < bid.right && bid.left < panel.right && panel.top < bid.bottom && bid.top < panel.bottom) {
                                failures.push(`${scene.name}@${viewport}: the coach panel (${['left', 'top', 'right', 'bottom'].map((k) => Math.round(panel[k])).join(', ')}) meets the bid panel (${['left', 'top', 'right', 'bottom'].map((k) => Math.round(bid[k])).join(', ')})`);
                            }
                            if (scene.coach === 'long' && !panel.scrolls) failures.push(`${scene.name}@${viewport}: the long lesson fits without scrolling, so the scene proves nothing`);
                            coachLine = `; coach panel ${Math.round(panel.left)},${Math.round(panel.top)}–${Math.round(panel.right)},${Math.round(panel.bottom)}${panel.bid === null ? '' : `, bid panel ${Math.round(panel.bid.left)},${Math.round(panel.bid.top)}–${Math.round(panel.bid.right)},${Math.round(panel.bid.bottom)}`}${panel.scrolls ? ', scrolled to its end' : ''}`;
                        }
                    }
                    const bidding = scene.name.includes('bid');
                    const { points, cards } = await targets(page, [...(bidding ? BIDS : []), ...(scene.coach ? ['Coach preview'] : [])]);
                    if (cards !== (bidding ? 6 : 8)) failures.push(`${scene.name}@${viewport}: ${cards} hand cards, expected ${bidding ? 6 : 8}`);
                    for (const point of points) {
                        if (point.missing) {
                            failures.push(`${scene.name}@${viewport}: no ${point.what}`);
                            continue;
                        }
                        const hit = await page.evaluate(({ x, y, index, name }) => {
                            const element = document.elementFromPoint(x, y);
                            const wanted = index >= 0
                                ? document.querySelectorAll('[data-testid="hand-card"]')[index]
                                : [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === name || b.textContent.trim() === name);
                            if (wanted?.contains(element)) return null;
                            if (!element) return 'nothing';
                            return `${element.tagName.toLowerCase()}${element.className && typeof element.className === 'string' ? `.${element.className.trim().split(/\s+/).join('.')}` : ''}${element.closest('[inert]') ? ' (inside an inert layer)' : ''}`;
                        }, point);
                        if (hit) failures.push(`${scene.name}@${viewport}: ${point.what} (${Math.round(point.x)}, ${Math.round(point.y)}) hits ${hit}`);
                    }
                    ctx.log(`${scene.name}@${viewport}: ${points.length} points${coachLine}`);
                } finally {
                    await context.close();
                }
            }
        }
        for (const viewport of HOVER.viewports) {
            const { context, page } = await ctx.open({ ...HOVER, name: 'hit-hover' }, viewport);
            try {
                // the middle of card i's own strip and of card i+1's, 40 px under the higher top of the two
                const strips = (i) => page.$$eval('[data-testid="hand-card"]', (els, i) => {
                    const r = (k) => els[k].getBoundingClientRect();
                    const a = r(i), b = r(i + 1), c = els[i + 2] ? r(i + 2) : null;
                    const y = Math.max(a.top, b.top) + 40;
                    return { own: [(a.left + b.left) / 2, y], next: [(b.left + (c ? c.left : b.right)) / 2, y] };
                }, i);
                const cardAt = ([x, y]) => page.evaluate(([x, y]) => {
                    const card = document.elementFromPoint(x, y)?.closest('[data-testid="hand-card"]');
                    return card ? [...document.querySelectorAll('[data-testid="hand-card"]')].indexOf(card) : -1;
                }, [x, y]);
                const n = await page.$$eval('[data-testid="hand-card"]', (els) => els.length);
                for (let i = 0; i < n - 1; i++) {
                    const { own, next } = await strips(i);
                    await page.mouse.move(...own);
                    await page.waitForTimeout(250);
                    await page.mouse.move(...next);
                    await page.waitForTimeout(250);
                    const at = await cardAt(next);
                    if (at !== i + 1) failures.push(`hit-hover@${viewport}: card ${i} hovered, its right neighbour's strip (${next.map(Math.round).join(', ')}) answers card ${at}, not ${i + 1}`);
                    await page.mouse.move(1, 1);
                    await page.waitForTimeout(200);
                }
                // a click: card 2 hovered, then a click in card 3's strip plays card 3 (it goes pending)
                const { own, next } = await strips(2);
                await page.mouse.move(...own);
                await page.waitForTimeout(250);
                await page.mouse.click(...next);
                await page.waitForTimeout(300);
                const pending = await page.evaluate(() => [...document.querySelectorAll('[data-testid="hand-card"]')].findIndex((card) => card.querySelector('.board-card__pend[data-pending]')));
                if (pending !== 3) failures.push(`hit-hover@${viewport}: a click in card 3's strip with card 2 hovered played card ${pending}`);
                ctx.log(`hit-hover@${viewport}: ${n - 1} neighbour strips and one click`);
            } finally {
                await context.close();
            }
        }
        return failures;
    },
};
