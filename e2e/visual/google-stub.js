// The visual harness's Google Identity Services (Google sign-in P-4). e2e/visual/lib.mjs answers Google's script,
// https://accounts.google.com/gsi/client, with this file, so no shot ever shows Google's real iframe: its button is one
// fixed 240×40 box, with no text (no font can make a shot flaky), and nothing in it to focus or click. Plain browser
// script, not bundled; only the calls the SPA makes (src/services/googleSignIn.ts) and two Google has beside them.
window.google = {
    accounts: {
        id: {
            initialize() {},
            renderButton(parent) {
                const box = document.createElement('div');
                box.setAttribute('aria-hidden', 'true');
                box.style.cssText = 'box-sizing: border-box; width: 240px; height: 40px; border: 1px solid #dadce0; border-radius: 4px; background: #ffffff;';
                parent.replaceChildren(box);
            },
            cancel() {},
            disableAutoSelect() {},
        },
    },
};
