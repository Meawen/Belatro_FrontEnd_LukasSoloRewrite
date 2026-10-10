// Phase 9's legal scenes (spec §4.15): Rules, Privacy and Terms, signed out, the whole page each, in the 680-px
// reading frame. Phase 2's `shell-rules` shows the top of Rules signed in with a game in progress.

const BOTH = ['1440x900', '375x812'];

export default [
    { name: 'legal-rules', path: '/rules', viewports: BOTH, user: null, fullPage: true },
    { name: 'legal-privacy', path: '/privacy', viewports: BOTH, user: null, fullPage: true },
    { name: 'legal-terms', path: '/terms', viewports: BOTH, user: null, fullPage: true },
];
