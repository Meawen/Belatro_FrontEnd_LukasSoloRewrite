// The longest real names (Review focus): in every scene that lists `longNames` (e2e/visual/scenes/names.mjs:
// 20-character usernames, 50-character lobby names with Croatian letters), at each of its viewports, the page
// does not scroll sideways, and every element whose own text holds one of the names keeps it inside: the
// nearest box around the text (its first ancestor that isn't display: inline) is not wider inside than out
// (scrollWidth ≤ clientWidth), unless it cuts the text with an ellipsis (text-overflow: ellipsis on a box
// that clips), that box ends inside the viewport (or inside a container that scrolls sideways itself), and no
// two such boxes overlap (two seat chips running into each other across the table).

export default {
    name: 'names',
    about: 'the longest names (20-character users, 50-character lobbies) never overflow their chip, row or header, nor the page',
    async run(ctx) {
        const failures = [];
        const scenes = ctx.scenes.filter((scene) => Array.isArray(scene.longNames));
        if (!scenes.length) return ['no scene lists longNames (e2e/visual/scenes/names.mjs is not among the chosen scenes)'];
        for (const scene of scenes) {
            for (const viewport of scene.viewports) {
                const { context, page } = await ctx.open(scene, viewport);
                try {
                    const result = await page.evaluate((names) => {
                        const problems = [];
                        const width = window.innerWidth;
                        const sideways = document.documentElement.scrollWidth - width;
                        if (sideways > 0) problems.push(`the page scrolls sideways by ${sideways} px`);
                        const describe = (element) => {
                            const label = element.getAttribute('aria-label') || element.textContent.trim().replace(/\s+/g, ' ');
                            return `<${element.tagName.toLowerCase()}${element.dataset.testid ? ` data-testid="${element.dataset.testid}"` : ''}> "${label.slice(0, 40)}${label.length > 40 ? '…' : ''}"`;
                        };
                        const scrolls = (element) => ['auto', 'scroll'].includes(getComputedStyle(element).overflowX);
                        const boxes = [];
                        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                            if (!names.some((name) => node.textContent.includes(name))) continue;
                            let box = node.parentElement;
                            while (box && getComputedStyle(box).display === 'inline') box = box.parentElement;
                            if (!box || box.closest('[aria-hidden="true"], .sr-only')) continue;
                            const style = getComputedStyle(box);
                            if (style.visibility === 'hidden' || box.getClientRects().length === 0) continue;
                            if (!boxes.includes(box)) boxes.push(box);
                            const ellipsis = style.textOverflow === 'ellipsis' && ['hidden', 'clip'].includes(style.overflowX);
                            if (box.scrollWidth > box.clientWidth + 1 && !ellipsis) {
                                problems.push(`${describe(box)} overflows its box by ${box.scrollWidth - box.clientWidth} px`);
                                continue;
                            }
                            const rect = box.getBoundingClientRect();
                            let scroller = box.parentElement;
                            while (scroller && scroller !== document.body && !scrolls(scroller)) scroller = scroller.parentElement;
                            const inScroller = scroller && scroller !== document.body;
                            if (!inScroller && (rect.right > width + 0.5 || rect.left < -0.5)) problems.push(`${describe(box)} sticks out of the viewport (${Math.round(rect.left)}…${Math.round(rect.right)} of ${width})`);
                        }
                        const rects = boxes.map((box) => box.getBoundingClientRect());
                        for (let i = 0; i < boxes.length; i++) {
                            for (let j = i + 1; j < boxes.length; j++) {
                                if (boxes[i].contains(boxes[j]) || boxes[j].contains(boxes[i])) continue;
                                // a sheet lies over the page: only boxes on the same layer can run into each other
                                if (boxes[i].closest('.ui-sheet') !== boxes[j].closest('.ui-sheet')) continue;
                                const a = rects[i];
                                const b = rects[j];
                                const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                                const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                                if (w > 1 && h > 1) problems.push(`${describe(boxes[i])} and ${describe(boxes[j])} overlap (${Math.round(w)}×${Math.round(h)} px)`);
                            }
                        }
                        return { problems, seen: boxes.length };
                    }, scene.longNames);
                    ctx.log(`${scene.name}@${viewport}: ${result.seen} elements with a long name`);
                    if (!result.seen) failures.push(`${scene.name}@${viewport}: no long name on the page; the fixture did not reach it`);
                    for (const problem of result.problems) failures.push(`${scene.name}@${viewport}: ${problem}`);
                } finally {
                    await context.close();
                }
            }
        }
        return failures;
    },
};
