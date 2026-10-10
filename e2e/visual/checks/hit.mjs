// Hit-testing with every sheet closed (spec §7.3, §3.7 "a closed sheet … never takes input"): at 1440×900 and
// 375×812, after the game menu has been opened and closed again, document.elementFromPoint at the centre of
// each bid button, and at the middle of each hand card's exposed strip (the part the next card leaves
// uncovered; the whole card for the last), returns that button. Board scenes come from /dev/board (Phase 4).
// Not the point 10 px in and 30 px down of the card's bounding box: at 1440 the fan tilts the right-hand cards
// clockwise, so that corner of their box lies on the card to their left.

const VIEWPORTS = ['1440x900', '375x812'];
const board = (at) => ({ name: `hit-${at}`, path: `/dev/board?controls=0&skip=1&effects=off&seat=carol&at=${at}`, viewports: VIEWPORTS });
// carol to bid after two passes (the bid panel up, six cards); carol to play in mid-trick (eight cards, enabled)
const SCENES = [board('bid:bob:PASS'), board('play:bob:PIK-BABA')];
const BIDS = ['Pass', 'Call Herc', 'Call Karo', 'Call Pik', 'Call Tref'];

/** Opens the game menu, closes it with Escape, and waits until it has left (unmounted after its exit). */
async function openAndCloseTheMenu(page) {
    await page.getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('dialog', { name: 'Game menu' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'Game menu' }).waitFor({ state: 'detached' });
}

/** The points to test, in page coordinates, each with what must be hit there. */
function targets(page, bidding) {
    return page.evaluate(({ bids, bidding }) => {
        const points = [];
        if (bidding) {
            for (const name of bids) {
                const button = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === name || b.textContent.trim() === name);
                if (!button) {
                    points.push({ what: `the "${name}" button`, missing: true });
                    continue;
                }
                const r = button.getBoundingClientRect();
                points.push({ what: `the "${name}" button`, x: r.x + r.width / 2, y: r.y + r.height / 2, index: -1, name });
            }
        }
        const cards = [...document.querySelectorAll('[data-testid="hand-card"]')];
        cards.forEach((card, index) => {
            const r = card.getBoundingClientRect();
            const next = cards[index + 1]?.getBoundingClientRect();
            const strip = next ? Math.max(1, next.x - r.x) : r.width;
            points.push({ what: `hand card ${card.dataset.card} in its strip's middle`, x: r.x + Math.min(strip, r.width) / 2, y: r.y + r.height / 2, index });
        });
        return { points, cards: cards.length };
    }, { bids: BIDS, bidding });
}

export default {
    name: 'hit',
    about: 'closed sheets take no input: the bid buttons and every hand card answer elementFromPoint (1440, 375)',
    async run(ctx) {
        const failures = [];
        for (const scene of SCENES) {
            for (const viewport of scene.viewports) {
                const { context, page } = await ctx.open(scene, viewport);
                try {
                    await openAndCloseTheMenu(page);
                    const bidding = scene.name.includes('bid');
                    const { points, cards } = await targets(page, bidding);
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
                    ctx.log(`${scene.name}@${viewport}: ${points.length} points`);
                } finally {
                    await context.close();
                }
            }
        }
        return failures;
    },
};
