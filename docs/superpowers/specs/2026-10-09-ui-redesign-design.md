# Stiglja SPA redesign: design spec

**Date:** 2026-10-09
**Status:**
- written after the owner interview of 2026-10-09 (session 1 of 3);
- revised after an independent review (53 findings, `RUN/explore/spec-review.md`);
- revised again in session 2 (the plan session, which owns the spec from 2026-10-09) after a second review (`RUN/explore/spec-review-2.md`) and the owner's decisions O-1…O-4 (`progress.md`, session 2, step 4);
- approved for planning (session 2, P-1).

**Repos:**
- SPA `Meawen/Belatro_FrontEnd_LukasSoloRewrite`, worktree `stiglja-lanes/ui-frontend`, branch `ui-redesign`, based on `fca13bb` (the verified pre-deploy SPA). It rebases onto `origin/master` once the pre-deploy PR merges.
- Backend `Meawen/stiglja` for §6. It branches from `pre-deploy` after the ultrareview wave (U-1…U-10) lands, or from the merged main, and never from `pd-backend`.

**Run folder** (`RUN/` below): `/Users/lmiholic/IdeaProjects/Belatro/.superpowers/sdd/2026-10-09-ui-redesign/`.
- `progress.md`: the ledger, with every decision, date and reason.
- `explore/`:
  - `game-data.md`: the wire contract, with `file:line`;
  - `routes-code.md`: every route, test and harness selector;
  - `realistic-board.md`: the demo board and the card-art facts;
  - `motion-research.md`;
  - `apple-design-SKILL.md`;
  - `spec-review.md`, `spec-review-2.md`.
- `proto/`: the approved prototypes, the visual reference. Where this text and a prototype disagree, the text wins.
  - `c.css`, `pix.js`: tokens, pixel icons, springs;
  - `lobby.html`, `board.html`, `matches.html`, `fonts.html`, `tokens.html`.
- `ref/today/`, `ref/proto/`: screenshots at 1440 and 375.

**Words used here:**
- **The board** is the new game page.
- **A view** is one `PublicGameView` or `PrivateGameView` frame.
- **R-n** is a requirement of the pre-deploy spec (`stiglja/docs/superpowers/specs/2026-10-04-pre-deploy-readiness-design.md`; R-46…R-49 are in its plan).
- **U-n** is an item of `pd-backend/docs/superpowers/specs/2026-10-09-ultrareview-followups-design.md`.
- **The harness** is `e2e/gameplay.mjs`, the release gate (R-44).
- **`LOGS/`** is `/Users/lmiholic/IdeaProjects/stiglja-lanes/logs/pre-deploy/` (`bots.mjs`, `rig.sh`, `landscape-menu.mjs`).

---

## 1. Goal and definition of done

**Goal.** Replace the vibe-coded SPA with one deliberate design:
- minimalist, with motion and feel per the apple-design skill;
- the emerald feel of bela kept;
- the 8-bit card art as the visual source;
- the game played on an animated board that runs only on the server's views.

The beta deploy (pre-deploy Phase 9) waits for this redesign (D-0).

**Done means** (the owner's definition, D-34):
1. Every route of §4 runs on the design system of §3. `/play/mock`, `/play/realistic`, `src/MockComponents/` and GSAP are gone.
2. The board (§5) runs on real views, follows every rule in §5, and keeps every behaviour in §5.9.
3. Tests:
   - every behaviour pinned by today's Vitest suite (baseline **60 files / 395 tests**) still has a test (§7.1);
   - the new tests of §7.2 pass;
   - the Playwright checks of §7.3 pass: visual at 1440×900 and 375×812, plus 812×375 for the board; hit-testing; reduced motion; performance; bundle size.
4. The backend changes of §6 are merged with their tests. The backend build is green on JDK 21.
5. The full release gate runs green on the local rig, with the harness updated (§7.4):
   - against the combined release: the new SPA, plus backend `pre-deploy`, the U-wave and §6;
   - six runs: badinvite, full, xhr, renewal, restart, mobile; the mobile run includes the landscape check.
6. **The owner plays a whole game with the bots on the rig and signs off.** It's recorded in the ledger. It comes last, after the pull requests are open and green (E-4); the merge is the owner's.

---

## 2. Scope, deferred items and decisions

### 2.1 In scope
- **The design system** (§3).
- **Every route and the app shell** (§4), with simple layouts for low-traffic pages.
- **The board on real data** (§5).
- **Backend** (§6): additive game-view fields, a leaderboard sort option, and the structured-moves trick fix.
- **Harness, tests, checks and CI** (§7).

### 2.2 Deferred (written down so nothing is lost)
| # | Item | Why deferred |
|---|---|---|
| T-1 | **Chat** in the game | No chat backend; it needs destinations, storage, rate limits and moderation. Owner: "leave chat as a to do" |
| T-2 | **Sound and haptics** | Owner: not now |
| T-3 | **Live-move leak**: any signed-in user can read every played trick of a live game via `GET /matches/{id}/moves` and `/structured-moves` (R-16 hides only the foul flag) | A behaviour change, not additive; needs its own spec. Its fix must keep Bela Blok and the won-trick peek (§5) working for participants, e.g. participants read their own team's tricks of the current hand |
| T-4 | Drag-to-play | Not asked for. Tap covers the game, and a drag needs velocity hand-off and rubber-banding |
| T-5 | A shared auth context | Today's "Check your inbox" panel and logout-as-full-load depend on per-instance `useAuth` (`routes-code.md` §0) |
| T-6 | Lobby STOMP topic | Owner chose faster polling |
| T-7 | Practice mode vs bots | Owner chose to delete the demo routes |
| T-8 | **A challenged hand's second END_HAND** shifts the stored hand numbers of everything after it (a successful challenge in HAND_COMPLETE runs `recordHandEnd` again), so Match details shows an extra hand holding only the corrected summary and the challenge | Changes hand numbering in Match details; needs its own rig check. The board is unaffected: it finds the ended hand by its final scores (§5.3.3) and Bela Blok deduplicates by `handNo` |

### 2.3 Decisions (question → owner's answer → consequence)

| # | Question | Answer | Consequence |
|---|---|---|---|
| D-0 | Redesign vs beta deploy | **Merge pre-deploy now, hold the deploy until the redesign lands** | The base is `fca13bb`, rebased onto `origin/master` after the merge. Backend changes are allowed but alter the verified RC, so the **full** release gate re-runs on the combined release before Phase 9 |
| D-1 | Visual direction | **C · Pixel Accent** | §3 |
| D-2 | Typography | **System font, plus a pixel face for accents only** | §3.3 |
| D-3 | Pixel face | **Jersey 10** (OFL) | Pixelify Sans was rejected: its "5" reads as "S" |
| D-4 | Motion engine | **`motion`**, after the research on how web card games animate | `motion` added and pinned to **13.4.4** (2026-09-25, the newest 13.x at least two weeks old when planned; the prototypes ran 13.3.0). `gsap`, `@gsap/react` and `@types/gsap` removed. Stated reason: springs that re-target from the on-screen value and velocity, plus shared-layout (`layoutId`) flights between containers, which GSAP lacks |
| D-5 | Scope | **Everything, one release** | §4 |
| D-6 | Card art hosting | **R2 behind a custom domain** | §3.6; a Phase 9 DNS step |
| D-7 | Card art licence | **Owner-made, full rights** | No attribution file |
| D-8 | Board data | **Expose + version** | §6.1 |
| D-9 | Your card play | **Lift now, fly on confirm** | §5.3.5 |
| D-10 | Side panels | **Bela Blok** and the **won-trick peek** in scope; **Chat** deferred; the demo's **Game History log was not chosen** and is dropped | The live region (§5.8) announces events; the trick-by-trick replay lives in Match details |
| D-11 | Peek scope | **My team's tricks, current hand** | §5.3.3 |
| D-12 | Hand order | **Frozen random suit groups per hand, strength order within a suit** | §5.3.6 |
| D-13 | Live-move leak | **To-do** | T-3 |
| D-14 | Lobby: what's disliked | "Reads like an admin form", "off-brand look" | §4.7 |
| D-15 | Lobby joining | **Keep the popup flow**, plus a join control on `/lobby/:id` | Fixes "no way in" |
| D-16 | Lobby liveness | **Faster polling**: 2 s lobby, 5 s list, paused in hidden tabs | — |
| D-17 | Lobby list tap | **Quick-look popup** | §4.6 |
| D-18 | Lobby layout | **Table** | §4.7 |
| D-19 | After Join | **Straight into `/lobby/:id`** | — |
| D-20 | Return path | **Back to the protected in-app path after sign-in/up** | §4.1 |
| D-21 | Board layout | **A · felt to the edges** | §5.6 |
| D-22 | Seasons | **Stronger, like the demo** | §5.7 |
| D-23 | Card size | **Per screen density** | §3.6 |
| D-24 | Phone landscape | **Compact landscape layout** | §5.6.2 |
| D-25 | Navigation | **Phone tab bar + slim desktop sidebar** | Amends R-37 |
| D-26 | Dashboard | **A "play" home** | §4.4 |
| D-27 | Demo routes | **Delete; dev-only `/dev/board`** | §4.17 |
| D-28 | Leaderboard | **Real, by Elo**; players with at least one game are ranked first, accounts with no games follow unnumbered as "Unranked" (O-3) | §6.2, §4.12 |
| D-29 | Match details | **Own page `/matches/:id`, keeping every feature** of today's Match History/Details | §4.9 |
| D-30 | Match list | **One list, scores on rows, "Recent form" strip** | Amends R-9's AC (§2.5) |
| D-31 | Trick replay colours | **Fixed player columns, team tints, Team B rose, crown for the winner, trumps clearly marked** | §4.9 |
| D-32 | Profile vs Settings | **Split**: the profile is public (stats, recent matches, friend actions); Settings holds Table effects + account | Amends R-34 |
| D-33 | Sound | **Deferred** | T-2 |
| D-34 | Done | **Gate + owner play-test** | §1 |
| D-35 | Hand hover, trump arena | **Keep both; may improve; keep the flair** | §5.6.5, §5.7 |
| D-36 | Emoji | **None anywhere** | §3.5, guard test |
| D-37 | Language | **English UI; Croatian game terms kept** | — |

### 2.4 Defaults chosen without a question (the owner may veto any at review)

| # | Default | Reason |
|---|---|---|
| X-1 | Sign-in, sign-up and the e-mail pages share one centred panel on a dithered-felt band, with the pixel wordmark and a static fan of three real cards. Every string and behaviour is kept | Off-brand purple and the emoji logo go |
| X-2 | `/login` ↔ `/signup` switching changes the URL | Clearer links and Back |
| X-3 | `/play`: one calm panel; the marketing blocks go; "MMR" is labelled "Elo" | Truthful, minimal |
| X-4 | Match Found is a full-screen, non-dismissible sheet with a dialog role and focus; the no-op × goes | Today: light-theme text, a dead × |
| X-5 | Creating a lobby takes the host straight into it | The host is already a member |
| X-6 | The lobby list's "Most players" sort is fixed (`LobbyList.tsx:57`) | Bug |
| X-7 | Admin: fake System Status removed; Active lobbies = the open-lobby count; a failed delete shows an error | Truthfulness |
| X-8 | The active-game and unverified-e-mail banners are hidden on `/game/:id`; Reconnecting stays | Focus on the table |
| X-9 | Desktop sidebar labels at ≥ 1024 px; icons only at 768–1023 px | Space |
| X-10 | The game page has a menu: Bela Blok (phones), "This hand", Rules, "Back to home" | Today a player can only leave by browser navigation |
| X-11 | E-mail management links ("Open your profile" in the banner, the resend button's "Add or change your email address", confirm-email's "your profile") point to **Settings → Account**, with the link text "Settings" where it named the profile | E-mail management moved (D-32) |
| X-12 | Avatars are the initial on a notched tile in the team colour (the accent on your own profile) | No avatar data exists |
| X-13 | The opponents' card back is `CardBack1` (red) | As in the demo |
| X-14 | Dead code goes with its screens: `App.css`, `LobbyCard.tsx`, `JoinLobbyModal.tsx`, `AuthGuard.tsx` + its tests (§7.1), `GameSidebar.tsx`, `SystemStatus.tsx`, `useRanked.ts`, `useWebSocket.ts`, `useLocalStorage.ts`, unused `useMatch*`, the undefined `badge*` classes, `vite.svg`, `react.svg`, and every `console.log` in touched files | `routes-code.md` §9 |
| X-15 | The unused React Query provider stays | Data-layer change is out of scope |
| X-16 | The favicon becomes a pixel "S" SVG at the same path `/favicon.svg`. `index.html` keeps `<title>Stiglja</title>`, `lang="en"` and the description (R-39); pages set `document.title` to "{Page} · Stiglja" | Brand coherence; the `brand.test` stays green |

### 2.5 Amended pre-deploy requirements
- **R-9 (AC2, the Quick/Detailed switch):** replaced. The list fetches **only** the summary; the details page fetches one match (§4.9). The speed-up is kept.
- **R-29 label:** the fallback keeps "Go to dashboard". `/dashboard` stays and is titled "Home".
- **R-31 hint text:** keeps `CHALLENGE_HINT` as it is in code ("…for this hand", `gameView.ts:60-61`), which matches the backend. R-31's "for this game" was a spec slip (`game-data.md` §8 #15).
- **R-33:** on `/dashboard` the "Return to your game" **card** replaces the banner. Every other page except the game keeps the banner.
- **R-34:** "the nav has no Settings". Settings returns because it's a real page now (D-32). The test becomes "Settings leads to a page with Table effects and Account".
- **R-37:**
  - **What changes:** the drawer is replaced by the **tab bar**, shown when width < 768 px **or** (landscape **and** height ≤ 500 px) (D-25).
  - **New ACs:** no horizontal scroll at 375 px; every destination in ≤ 2 taps; the board fits 375×812 and 812×375.
  - **Kept:** the `window.location.href` grep test.
- **R-39:** the brand rules stay (§2.4 X-16).
- **R-40 footer:** at the bottom of every app page **except `/game/:id`**, and on the public pages and the auth panel. The routed-links test stays.
- **R-43 (CI):** the workflow gains `VITE_CARD_ART_BASE_URL`, a post-build guard, and a bundle-size check (§7.5).

---

## 3. Design system

### 3.1 Principles (the apple-design skill, applied)
1. **Respond on press.** Every control shows feedback on pointer-down within the same frame. Nothing on the input path waits for an animation, debounce or timer, except the one-move-in-flight lock (D-9, §5.3.5).
2. **Motion is a spring that starts from what's on screen.** Interrupting any move re-targets it from its current value. Only `transform` and `opacity` animate (plus `scaleX` for progress bars).
3. **Interruptible always.** A newer state replaces motion in flight; input is never queued behind it.
4. **Spatial consistency.** Things leave the way they came: sheets go back down, detail pages slide back right, cards return to where they came from.
5. **Restraint.** No decorative loops: no pulsing dots, bouncing badges or shimmer. **Status indicators** may animate: the `Loader` blink, the queue's searching row, the turn countdown. So may the table's season (§5.7). All of them are static under reduced motion, except the countdown, which is information.
6. **Purpose, simplicity, craft.** No fake numbers, placeholder pages or marketing filler. Every value comes from a token.

### 3.2 Colour tokens
They live in `src/index.css` as custom properties exposed through Tailwind 4 `@theme`. Components use tokens only; raw palette classes (`emerald-*`, `slate-*`, `purple-*`, `gray-*`…) are removed, and a guard test enforces it.

| Token | Value | Use | Contrast (WCAG, computed) |
|---|---|---|---|
| `--bg` | `#0a1916` | App background | |
| `--surface` | `#11292a` | Panels, rows | |
| `--surface-2` | `#17363a` | Raised controls, chips | |
| `--surface-3` | `#1e4448` | Selected segment (text on it: `--text` or `--text-2` only) | |
| `--edge` | `#2c5a52` | 3-px pixel edges | |
| `--edge-strong` | `#6aa898` | Edges under `prefers-contrast: more`; **always** the edge of `Input`, `Select`, `Switch` and the `Segmented` track (O-4: a control's boundary needs ≥ 3:1) | 5.6 surface |
| `--ink` | `#222034` | DB32 ink: text on accent, HUD chips | |
| `--text` | `#f2f0e6` | Primary text | 15.8 bg · 13.4 surface · 11.3 surface-2 |
| `--text-2` | `#9badb7` | Secondary text | 7.8 · 6.6 · 5.6 |
| `--text-3` | `#8aa2ad` | Tertiary text (not on `--surface-3`) | ≥ 4.8 on bg, surface, surface-2 |
| `--accent` | `#fbf236` | Primary action, your turn, the winner's crown and cell ring, "you" | 15.3 · 13.0 · 11.0; ink on it 13.5 |
| `--accent-ledge` | `#8f974a` | The primary button's bottom edge | |
| `--success` | `#99e550` | Victory, success | ≥ 8.4 |
| `--danger` | `#d95763` | Fills and borders only | |
| `--danger-text` | `#f08a94` | Error text | ≥ 5.4 |
| `--danger-fill` | `#ac3232` | Tags (ILLEGAL, FAIL) with `--text` | 5.6 |
| `--warn-fill` | `#8f563b` | Tags (PADANJE, PARTIAL) with `--text` | ≥ 4.5 (token test) |
| `--team-a` | `#5fcde4` | Team A | ≥ 6.9 |
| `--team-b` | `#d77bba` | Team B (rose, D-31) | 6.4 bg · 5.4 surface |
| `--team-b-text` | `#e08ac6` | Team B text on `--surface-2` | 5.3 |
| `--suit-herc` / `-karo` / `-pik` / `-tref` | `#ac3232` / `#fbf236` / `#4b692f` / `#df7126` | Suit chips and trump rings (DB32) | Text on them: `--text` on herc and pik (5.6, 5.5); `--ink` on karo and tref (13.5, 4.9) |
| `--felt-a`/`--felt-b` | `#1b6b4c`/`#1a6449` | Neutral felt (dither pair) | |
| `--rim`/`--rim-hi` | `#663931`/`#8f563b` | The table's wooden rim | |
| Season felts | spring `#2f8f4e/#2b8448` · summer `#9a7a1e/#8f711b` · autumn `#8a4a1f/#7f441c` · winter `#1d2f52/#1a2a4a` | §5.7 | |

- **Contrast thresholds:** text ≥ 4.5:1 (body), ≥ 3:1 for ≥ 24 px or bold ≥ 18.66 px. The **token test computes** each text/background pair actually used and asserts its threshold; it doesn't trust the rounded figures here.
- **Why DB32:** the card art uses exactly the DawnBringer 32 palette (`realistic-board.md` §7).

### 3.3 Typography
- **Families:**
  - `--font-sys: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` for everything readable.
  - `--font-pix: "Jersey 10", var(--font-sys)` for the wordmark, page titles and score numerals only.
  - Jersey 10's woff2 is **imported from `src/assets/fonts/`**, so Vite hashes it into `/assets/` (the immutable cache rule of R-28), with `font-display: swap`. Its OFL licence file sits beside it.
- **Scale.** Size, leading and tracking are a set; sizes are in `rem`.

| Token | Family | Size / line-height | Tracking | Weight | Use |
|---|---|---|---|---|---|
| `display` | pix | 2.625rem / 1.0 | +0.01em | 400 | Wordmark, page titles |
| `title` | pix | 1.75rem / 1.05 | +0.01em | 400 | Section and sheet titles |
| `score-xl` | pix | 3rem / 1.0 | 0 | 400 | Hero and end-sheet scores |
| `score` | pix | 1.5rem / 1.0 | 0 | 400 | HUD and list scores |
| `headline` | sys | 1.0625rem / 1.3 | −0.01em | 600 | Row titles |
| `body` | sys | 1rem / 1.5 | 0 | 400 | Text |
| `callout` | sys | 0.9375rem / 1.45 | 0 | 400–600 | Buttons, secondary text |
| `footnote` | sys | 0.8125rem / 1.4 | +0.005em | 400 | Meta lines |
| `caption` | sys | 0.75rem / 1.35 | +0.04em | 600, uppercase | Labels, tags |

- **Numerals:** `font-variant-numeric: tabular-nums`.
- **Never** in the pixel face: body text, buttons or form labels.
- **Strings:**
  - existing strings keep their exact characters, including "..." where code has three dots today (e.g. "Loading lobby...");
  - new strings use the ellipsis "…".

### 3.4 Space, corners, elevation, materials, layers
- **Space:** a 4-pt grid (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). The phone gutter is 16 px.
- **Max widths:** 880 px for list and detail pages, 680 px for prose (Rules, Privacy, Terms), 1100 px for the board area.
- **Corners:** no `border-radius`. Pixel notches with `clip-path`:
  - `--notch: polygon(0 3px, 3px 3px, 3px 0, calc(100% - 3px) 0, calc(100% - 3px) 3px, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 3px calc(100% - 3px), 0 calc(100% - 3px))`
  - `--notch-6`: the same with 6 px (the table and sheets).
- **Edges and elevation:** surface steps plus a 3-px inset edge (`box-shadow: inset 0 0 0 3px var(--edge)`), with no blurred shadows. Cards and chips on the felt carry a static hard shadow (`drop-shadow(0 3px 0 rgba(0,0,0,.35))`).
- **Clip-path clips outlines and filters too.** Notched interactive elements draw their focus ring **inside** the clip (`outline: 2px solid var(--accent); outline-offset: -5px`), in `--ink` on accent fills (the primary button); the `Switch` rings its whole label row instead (a ring inside its 26-px track would cross the knob); a hard shadow sits on an unclipped wrapper.
- **Forced colours** (`@media (forced-colors: active)`): every control, row, panel and sheet gets `border: 1px solid` (the system colour applies), because forced colours remove the inset-shadow edges.
- **Safe areas:** `index.html`'s viewport meta has `viewport-fit=cover`. `--safe-top/right/bottom/left` default to `env(safe-area-inset-*)` and pad the tab bar, phone sheets, the hand, piles and name chips (bottom), the HUD (top), and in landscape the side seats and HUD chips (left/right). Full-height layouts use `100dvh`. The hand's 25 % tuck below the edge (§5.6.2) is measured from the safe area's bottom; its sides and top stay inside.
- **Materials.** Translucency only on chrome that floats over scrolling content:
  - `material-bar`: `rgba(10,25,22,.86)` + `backdrop-filter: blur(16px) saturate(140%)`, with a 2-px top edge. Used by the tab bar, the lobby action bar and sticky headers.
  - `ink-chip`: `rgba(34,32,52,.88)`, no blur. Used by HUD and seat chips on the felt.
  - **`prefers-reduced-transparency: reduce`:** both opaque, no blur.
  - **`prefers-contrast: more`:** `--edge-strong` edges; `--text-2` and `--text-3` become `#d8e1e5` and `#b5c3ca`.
- **Layers (z-index tokens):**

  | z | Layer |
  |---|---|
  | 0 | Felt |
  | 1 | Particles canvas |
  | 10 | Piles |
  | 20 | Trick region |
  | 30 | Hand toolbar |
  | 40 | Seat and HUD chips |
  | 50 | Bid panel, bela prompt |
  | 60 | Sweep layer (cards in flight to a pile) |
  | 70 | Non-modal sheets |
  | 80 | Scrim |
  | 90 | Modal sheets |
  | 100 | Toasts |

  Off the board: the tab bar and action bars 40, sheets as above.

### 3.5 Iconography
- **No emoji anywhere** (D-36); no icon library.
- **Pixel icons:** SVG `rect`s on an 8–9 px grid, `shape-rendering: crispEdges`, scaled ×2 or ×3. The source format is the row strings in `RUN/proto/pix.js`.
- **Icon set:**
  - from the prototypes: lock, crown, door, trash, x, plus, link, check, back, chevron, more, user, eye, play, refresh;
  - added: home, cards, list, people, trophy, gear, book, shield, search, copy, logout, mail, warning, info.
- **Suit icons:** the art's PNGs (at the source Herc 52×49, Karo 52×52, Pik 61×61, Tref 64×64 px), drawn inside a 17×16 or 34×32 box with their proportions kept (`object-fit: contain`) and `image-rendering: pixelated`.
- **Labelling:** icons beside text are `aria-hidden`. Icon-only buttons have an `aria-label`.

### 3.6 Card art
- **Source.**
  - New config `VITE_CARD_ART_BASE_URL`, read like `VITE_API_BASE_URL` in `vite.config.ts` through a helper in `src/apiBase.ts` beside `apiBaseForBuild`:
    - **`vite build` requires it** (blank or unset fails the build) and bakes it in without trailing slashes;
    - the **dev server** defaults to `https://pub-35c6a55a85654bcaa462dcc5f31c7c71.r2.dev/v1`;
    - CI sets it (§7.5), and so does the rig's SPA build command;
    - production uses the owner's custom domain, e.g. `https://cards.stiglja.com/v1`.
  - Files: `<Suit> <Rank>.png`, `CardBack1–3.png`, `{herc,kara,pik,tref}Icon.png`.
  - Phase 9 gains a step: connect the custom domain to the bucket, set the Pages variable, deploy, then disable public `r2.dev` access — **only once no rollback target needs it** (today's SPA hard-codes r2.dev), and then `npm run dev` sets the variable to the custom domain too (`RUN/phase9-amendment.md`).
- **Grid:** every face is a **71×95 art-pixel grid drawn at 3×**. It's rendered with `image-rendering: pixelated`.
- **Sizes (D-23).** The card's CSS width is `71 × s / dpr`, where `s` is a whole number of device pixels per art pixel.
  - **Intended sizes at integer DPRs:**
    - phones (≤ 1023 px wide): 71×95 for the hand and the trick;
    - desktop on ≥ 2× screens: 106.5×142.5 for the hand and the trick;
    - desktop on 1× screens: the hand at 142×190, the trick at 71×95;
    - thumbnails: 47.33×63.33 (≤ 420 px wide) or 71×95, and 35.5×47.5 in sheets.
  - **At non-integer DPRs** (e.g. 2.625, 1.25), `s` is the integer nearest to `intendedCssWidth × dpr / 71`, so cards stay crisp at a size close to the intended one. When that integer would be 0 (small thumbnails on 1× screens), the intended width is used and the card is slightly soft.
  - The opponents' backs are drawn by `scale(.5)` of a 71-wide card. That's acceptable softness on a moving back.
- **Loading.**
  - On entering `/lobby/:id` or `/game/:id`, all 39 images are preloaded and decoded (`img.decode()`), with no React state per image. Today's `useCards` is replaced.
  - **Until a face has decoded**, and if it fails, `PlayingCard` shows a pixel-framed text card ("As Herc"), never a broken or blank image; backs show their colour. The swap causes no layout change. A `SuitIcon` whose PNG fails keeps its slot and shows the suit's letter (H, K, P, T).

### 3.7 Components
They live in `src/components/ui/`. Variants are props, not per-call class overrides. Each has a test (§7.2).

| Component | Variants / props | Behaviour |
|---|---|---|
| `Button` | `primary`, `secondary`, `quiet`, `danger`; `size: md` (44 px) / `sm` (36 px visual, **44 px hit area** via padding); `leftIcon`; `loading` | `:active` moves it down 2 px in 90 ms ease-out, and the ledge shrinks to 1 px. Disabled: opacity .45, no press. While loading, the label stays in the accessible name |
| `IconButton` | Button + required `aria-label`; 44×44 hit area | |
| `Chip` / `Tag` | `mode`, `team-a`, `team-b`, `you`, `win`, `bad`, `warn`, `trump(suit)` | Notched; caption type |
| `Panel`, `ListRow` (`as="button"\|"link"`), `Segmented` (`aria-pressed`) | | Whole-row targets with press feedback |
| `Input`, `Select`, `Switch` | `label` (tied by a **stable** `useId`), `helper`, `error` | Today's `Input` makes a new random id every render, and the `Select` label isn't tied: both fixed |
| `Sheet` | `side: bottom` (< 720 px) / `center` (≥ 720 px) / `full`; `title`; `onClose`; `modal` (default true); `dismissible` (default true) | **Modal:** `role="dialog"`, `aria-modal`, labelled by its title; focus moves in and is trapped, and returns to the trigger; Escape and a scrim tap close it when `dismissible`.<br>**Non-modal** (`modal={false}`): no scrim, no trap, `role="region"` with a label.<br>A `center` sheet taller than the viewport scrolls inside.<br>**A closed sheet's content is unmounted after its exit animation.** While exiting it is `inert` and never takes input (§7.3 hit-test check) |
| `Toast` | `status` | `role="status"`, 1.8 s, top-centre |
| `Banner` | `info`, `warn`, `danger` | Slim strip; `role="region"` with today's labels |
| `Loader` | — | 12-px accent square blinking at `steps(2)`, 1 s; static under reduced motion. Keeps today's strings |
| `EmptyState`, `ErrorState`, `Avatar` (initial; `tone: team-a\|team-b\|accent\|neutral`), `Pager` | | |
| `PlayingCard` | `card`, `size`, `face\|back` | §3.6 |
| `TabBar`, `Sidebar` | items | §4.1 |

### 3.8 Motion
`motion@13.4.4`, with `LazyMotion` (`domMax` where layout/`layoutId` is used). Tokens in `src/motion/tokens.ts`:

| Token | Motion config | Apple equivalent | Used for |
|---|---|---|---|
| `spring.ui` | `{type:'spring', bounce:0, visualDuration:0.35}` | damping 1.0, response 0.35 | Card flights (layout), seat moves, screen push, desktop sheets |
| `spring.quick` | `bounce:0, visualDuration:0.2` | 1.0 / 0.2 | Hover lift, pending lift, chips, toasts |
| `spring.sheet` | `bounce:0, visualDuration:0.3` | 1.0 / 0.3 | Phone sheets |
| `spring.felt` | `bounce:0, visualDuration:0.5` | 1.0 / 0.5 | Season felt cross-fade, the lobby table "grow" |
| `press` | CSS `transform 90ms ease-out` | — | `:active` |
| `path.card` | `transition.layout.path = arc({strength:0.35})` if `arc()` exists in the pinned version; otherwise x and y springs with `visualDuration` 0.35 and 0.42 (the vertical lags slightly, which makes the curve) | — | Card flights |
| `stagger.deal` | 30 ms | | Deal |
| `stagger.sweep` | 40 ms | | Trick → pile |
| `hold.trick` | 900 ms (visual only) | | §5.3.4 |

- **Bounce is never used:** there's no momentum gesture (T-4).
- **Reduced motion** (`prefers-reduced-motion: reduce`):
  - `MotionConfig reducedMotion="user"` covers declarative components. **Imperative calls** (`animate()`, layout callbacks) check a `useReducedMotion` hook;
  - every position or scale animation becomes **fade out 75 ms → jump → fade in 75 ms**;
  - screen pushes become fades; particles stop; the felt colour changes instantly;
  - the countdown bar still runs.
- **Performance budget:**
  - transform and opacity only;
  - ≤ 40 DOM elements animating at once;
  - particles on **one `<canvas>`** (≤ 52 sprites Full, ≤ 14 Calm), paused while hidden;
  - **p95 frame time ≤ 20 ms** at 4× CPU throttle, on a production-mode build (§7.3);
  - **bundle (O-5):** the game page (`/game/:id`) and `/dev/board` are split into their own chunk, loaded on demand when a game opens (a `Loader` while it loads, cached afterwards). The JS every other page loads (the entry chunk and its static imports) grows ≤ 35 KB gzip versus `fca13bb` (motion in, GSAP out); the game chunk is ≤ 45 KB gzip; the font ≤ 30 KB (§7.5).

### 3.9 Accessibility baseline
- Real `button`, `a` and form controls, with a 2-px accent focus ring (`:focus-visible`).
- Tap targets ≥ 44×44. **Exceptions:** overlapping hand cards expose ≥ 36×76 px each (§5.6.1); links inside a sentence of text (WCAG 2.5.8's inline exception).
- Each page has one `h1`: the page title (on the auth pages, the panel title; the wordmark is not a heading).
- Colour is never the only signal: the winner has a crown plus text, your turn has text, and teams are named.
- Polite live regions on the board (§5.8).
- `lang="en"`; `document.title` = "{Page} · Stiglja".

---

## 4. Screens

Each screen gives its purpose, entry points, states, layout (375 and desktop), the behaviours kept (R-refs), and acceptance criteria. "Strings kept" means word for word as in `routes-code.md` §1.

### 4.1 The app shell
- **Purpose:** navigation, banners, footer, error boundaries and guards around every page except the game.
- **Layout.**
  - **The tab bar** shows when width < 768 px **or** (landscape **and** height ≤ 500 px). It's a bottom `material-bar`, 64 px + the safe-area inset, with **Play** (`/dashboard`), **Lobbies**, **Matches**, **Profile** and **More**.
    - More opens a sheet with Ranked (`/play`), Friends, Leaderboard, Settings, Rules, Admin (admins only) and **Log out**.
    - Page titles sit in the content.
  - **The sidebar** shows otherwise: icons only (72 px) at 768–1023 px, with labels (232 px) at ≥ 1024 px. In order: Play, Ranked, Lobbies, Matches, Friends, Leaderboard, Profile, Settings, Rules, Admin. The user block and **Log out** sit at the bottom.
  - `aria-current="page"` on the active item; the `<nav>` is labelled "Main navigation".
- **Log out** everywhere keeps today's **full page load to `/`** (`useAuth.ts:198`).
- **Banners**, at the top of the content and never on `/game/:id` (X-8):
  - `ActiveGameBanner` (R-33): every rule kept: 30-s checks, checks on navigation, never with an expired token, shown on public pages too, replaced by the Home card on `/dashboard`;
  - `UnverifiedEmailBanner`: three texts kept; the profile link becomes "Open settings" (X-11).
- **Footer** (R-40): every app page except the game. "© {year} Stiglja" + Rules, Privacy, Terms, "Contact: support@stiglja.com".
- **Error boundaries** (R-29):
  - two, as today: the root, and the game keyed by `gameId`;
  - strings kept ("Something went wrong", "Reload", "Go to dashboard", both full loads);
  - the root fallback renders in a minimal wordmark frame.
- **Guards:**
  - loading strings kept ("Checking authentication...", "Loading...");
  - **return path** (D-20):
    - `ProtectedRoute` passes `{from}` (pathname + search);
    - every in-app hop of the auth flow carries `from` on: Sign in ↔ Sign up (X-2), "Forgot password?" and its "Back to sign in", and the sign-up inbox panel;
    - after sign-in, sign-up's Continue, or confirm-email's Continue, the app goes to `from` if it is a safe in-app path, otherwise `/dashboard` (a mail link carries no `from`, so confirm-email's Continue usually goes to `/dashboard`, or to `/login` when signed out);
    - **safe** means `new URL(from, location.origin)` keeps the same origin, its pathname starts with `/`, and the raw `from` doesn't start with `//` or `/\`.
- **Session end:** `/login?reason=session-ended` kept (R-10).
- **ACs:**
  1. At 375×812: the tab bar shows 5 items; More lists the rest and closes on navigation; there's no horizontal scroll.
  2. At 812×375 and 667×375: the tab bar shows (landscape, height ≤ 500) and the content scrolls under it.
  3. At 1024×768: labels, no tab bar. At 800×1000: icons only, each with an `aria-label`.
  4. Admin only for `ROLE_ADMIN` per `/user/me`.
  5. Settings is in the nav and leads to Settings.
  6. Every footer link is routed.
  7. A signed-out visit to `/lobby/abc` → sign in → `/lobby/abc`; and → Sign up → Create Account → Continue → `/lobby/abc`. A `from` of `//evil.example` or `/\evil.example` → `/dashboard`.
  8. A render error shows the fallback with both actions.
  9. No banner on `/game/:id`; the active-game banner shows on `/rules` with a live game.
  10. Log out does a full load to `/`.

### 4.2 Sign in and sign up (`/login`, `/signup`)
- **Purpose:** sign in, or create an account with an invite code (R-11).
- **Entry points:** as today (`routes-code.md` §1.2), plus the return path.
- **Layout (X-1):**
  - **phone:** a full-width panel with a 16-px gutter;
  - **desktop:** a centred 400-px panel;
  - both on `--bg` with a dithered-felt band behind the top third, the pixel wordmark, a static fan of Herc As, Karo As and Pik As above the panel, the tagline "Belot for four, online.", and footer links below.
- **Kept:**
  - every label, button, validation and error string;
  - the session-ended notice (R-10);
  - the R-17 message and the credential rules;
  - `name="inviteCode"` and its 403 text (R-11);
  - the Terms/Privacy line in new tabs (R-40);
  - the "Check your inbox" panel with Continue;
  - no logging of passwords or tokens.
- **Changed:**
  - mode switching changes the URL (X-2);
  - the 🃏, the purple gradient and "The Ultimate Card Game Experience" go;
  - links use the accent;
  - `console.log`s are removed.
- **States:** idle; submitting ("Signing In...", "Creating Account..."); field errors; server error; the inbox panel.
- **ACs:** today's AuthPage, LoginForm, SignupForm, credentialRules and useAuth tests pass. "Sign up" → `/signup` and "Sign in" → `/login`.

### 4.3 E-mail pages (`/forgot-password`, `/reset-password`, `/confirm-email`)
- **Purpose:** request a reset link, set a new password, confirm an address.
- **Entry points:**
  - forgot-password: "Forgot password?" on sign-in, and "Request a new link";
  - reset-password and confirm-email: the e-mail links (deep links, R-28).
- **Layout:** the §4.2 panel frame with footer links.
- **States and strings kept** (`routes-code.md` §1.3–1.5):
  - confirm on **click**, never on load;
  - the single-use guards;
  - the constant forgot-password sentence (R-13);
  - the 409/429/5xx branches;
  - the invalid-link states.
- **Changed (X-11):** confirm-email's next-step link reads "**Settings**" and points to Settings → Account.
- **ACs:** today's ForgotPasswordPage and ResetPasswordPage tests pass. The two ConfirmEmailPage cases that assert `href '/profile'` (`ConfirmEmailPage.test.tsx:58,70`) are updated to Settings (X-11, §7.1).

### 4.4 Home (`/dashboard`, titled "Home")
- **Purpose:** a launcher (D-26).
- **Entry points:** after sign-in; `/`; Play tab/item; the error fallback; 404.
- **Content:**
  1. The greeting "Hi, {username}" (`display`).
  2. When `GET /user/me/active-game` returns a game: the **"Return to your game"** card (accent edge) in place of the banner (§2.5 R-33).
  3. **"Play ranked"** with your Elo → `/play`.
  4. **"Lobbies":** "Open lobbies" (→ `/lobbies`) and "Create lobby" (→ `/lobbies?create=1`, which opens the create sheet).
  5. The stats strip: Elo, Games, Level (`data-testid` `dashboard-elo`, `dashboard-games`, `dashboard-level`); "—" when unknown, Level ≥ 1 (R-34). The Win Rate tile goes.
  6. **Recent matches:** the last 3 from the summary endpoint (`size=3`) as §4.9 rows, plus "All matches".
  7. "New to bela?" with **"Read Guide"** → `/rules` (R-41; label kept).
- **Layout:** phones stack 1–7 in one column; desktop puts 3 and 4 side by side, and 5 and 6 side by side.
- **States:** loading shows "—"; recent matches show a loader, rows, "No matches yet" or a quiet error line.
- **ACs:** the dashboard tests pass with the Win Rate assertion removed (D-26); the active-game card shows on a 200 and is absent on a 204; Read Guide opens `/rules`.

### 4.5 Ranked (`/play`) and Match Found
- **Purpose:** join and leave the ranked queue; accept or decline a found match.
- **Entry points:** Home "Play ranked"; the Ranked item; a declined match (R-25).
- **Layout (X-3):**
  - a centred panel (phones: full width; desktop: 520 px) **on the lobby table's felt with its wooden rim** (owner, 2026-10-10: "a little more colour"; the table up to 680 px wide); the panel's edge turns accent while queued;
  - the eyebrow **"RANKED"** (literal text, which the harness waits for) with the four suit icons (Herc, Karo, Pik, Tref) at its right, the title "Find a match", your Elo, and the button;
  - the button keeps today's labels: "Connecting..." / "Joining Queue..." / "Leaving Queue..." / "Leave Queue" / "Find Match";
  - while queued, a status block with "Searching for a match", a 4-square row blinking in turn, the squares in the four suits' colours (Herc, Karo, Pik, Tref; a status indicator; static under reduced motion), and tiles for Players in queue, Estimated wait ("Calculating..." when ≤ 0, R-47) and Time in queue;
  - `ReconnectBanner` (R-30) as a top strip;
  - the decline notice (R-25).
- **Kept:**
  - the queue above the routes (R-33);
  - the socket held only on `/play`, while queued, or with a pending match;
  - 409 and the first `IN_QUEUE` count as queued (R-38);
  - 403 → the message + resend;
  - 429 text as is;
  - errors reset on leaving `/play`;
  - "Not connected to the game server".
- **Match Found (X-4):** a `Sheet` with `side="full"`, `dismissible={false}`, on any page.
  - "Match found"; both teams with avatars, you marked;
  - the 15-s countdown bar (`scaleX`, linear) with "Auto-accepting in {n} seconds...";
  - **"Accept Match"** and **"Decline"**;
  - an `ErrorAlert` for the 409 "This match can no longer be declined" (the dialog stays);
  - auto-accept at 0 unless a decline is in flight; Accept → `/game/{id}`; focus on Accept; no × button.
- **ACs:**
  - today's PlayPage, PlayButton and RankedQueueProvider tests pass;
  - "Calculating..." for −1;
  - Match Found has `role="dialog"` and no close button;
  - no horizontal scroll at 375.

### 4.6 Lobbies (`/lobbies`), the quick-look sheet and Create lobby
- **Purpose:** find, preview and join a casual lobby; create one.
- **Entry points:** Lobbies tab/item; Home; after leaving or closing a lobby; the game's "Back to lobbies"; rematch Leave.
- **Data:**
  - `GET /lobbies/open`, polled **every 5 s while visible** (paused when hidden);
  - the last good list is kept on a failed poll;
  - one request per poll (the duplicate `useLobbies()` fetches go);
  - **a poll never reorders rows while a pointer is down on the list or the quick-look is open**; the new order applies on the next poll after that.
- **Layout:**
  - **header:** "Lobbies", the count, **"Create lobby"** (primary) and a Refresh icon button;
  - **search** (label "Search lobbies"; it filters by name or host) and **sort** (label "Sort by": Newest, Name, Most players);
  - **rows (`ListRow`):**
    - the name; a lock icon + "Private" if private; the host;
    - **4 seat squares** for seated players (Team A slots in `--team-a`, Team B in `--team-b`, empty slots outlined);
    - "**{members}/4**", counting every member including Unassigned (the server caps a lobby at 4 members: "Lobby is full");
    - "Full" at 4;
    - a "You're in" chip for members.
  - **Phones:** one-column rows; the meta wraps under the name.
  - **Desktop:** rows with the seat squares in a right column.
- **Quick-look sheet (D-17):**
  - title = the lobby name;
  - a **mini table** (§4.7 at 60 %, not interactive);
  - host; "Created {relative time}"; privacy;
  - actions:
    - members: **"Enter lobby"**;
    - outsiders: **"Join lobby"** (private: a "Password" field; Enter submits);
    - a full lobby: a disabled "Lobby full";
  - server errors shown as they are;
  - **on success, navigate to `/lobby/:id`** (D-19);
  - it follows its lobby by id across polls; when the lobby leaves the open list it says "This lobby is no longer open" and offers only Close.
- **Create lobby sheet:**
  - "Lobby name" (≤ 50) and a "Private lobby" switch revealing "Password" (≤ 20);
  - the note "Lobby games are casual: they don't change your rating." (R-34);
  - error strings kept;
  - the submit button **"Create"** → `POST /lobbies` → **navigate to `/lobby/:id`** (X-5).
- **States:** first load ("Loading lobbies…"); empty ("No open lobbies. Create one and invite friends."); poll error (strip "Couldn't refresh — showing the last list"); full error (`ErrorState` + Try again).
- **ACs:**
  1. Polls every 5 s while visible, not while hidden.
  2. "Most players" orders by members, descending.
  3. Join posts `{lobbyId, password|null}` only, then navigates.
  4. A private lobby asks for the password first.
  5. Create posts name, privacy and password only, has no mode select (R-34), and navigates.
  6. Rows are buttons named like "Kod Mire, host mira_z, 3 of 4, private".
  7. `?create=1` opens the sheet.

### 4.7 The lobby (`/lobby/:lobbyId`)
- **Purpose:** take a seat; the host starts the match.
- **Entry points:** quick-look Enter or Join; Create lobby; a shared invite link (via the return path).
- **Data:**
  - `GET /lobbies/{id}` **every 2 s while visible**; a failed poll keeps the last lobby;
  - **the start/follow logic** (`routes-code.md` §2.1 step 6):
    - the host goes straight in from the start response;
    - members follow when a poll sees CLOSED, via `getmatchbylobbyid` (404 = not yet, retried at the poll interval);
    - `replace`, so Back never re-enters.
- **Layout (D-18; `RUN/proto/lobby.html`):**
  - **Header:**
    - "‹ Lobbies";
    - the lobby name (`display`, the only `h1`);
    - chips for Casual, Private (lock) and the host (crown);
    - a "Copy invite link" icon button.
  - **The table:** a dithered felt with a wooden rim (notch-6), 330 px tall on phones, 420 px on desktop.
    - **The seat geometry matches the board:** turn order is A1 → B1 → A2 → B2, running counter-clockwise.
      - If you're seated, you're at the **bottom**, the next seat in turn order is on your **right**, your partner is at the **top**, and the remaining seat is on the **left**.
      - If you're not seated, A1 is at the bottom.
      - Empty seats are drawn in the slots their team's list leaves free.
    - **Tapping either empty seat of a team joins that team**; which slot you land in follows the server's list order.
    - The centre shows "{seated}/4" (`score`) and "seated" / "Ready to deal".
    - A seat is a 52-px avatar tile in the team colour, the name, and "You" / "Host" / "Team A|B", with the host's crown above. An empty seat is a notched outline with a plus, reading "Sit here" (accent) for a member not on that team, otherwise "Open seat".
  - **"Not seated":** chips of Unassigned members ("· you" marked). **For the host, each chip is a button** that opens "Remove {name}?".
  - **Hint line** (non-hosts): "Pick a seat. Partners sit opposite each other." / "The host starts the match when all four seats are taken." / outsiders "You are looking at this lobby. Join to pick a seat."
  - **Action bar** (`material-bar`):
    - **host:** an options icon button, the reason line ("Waiting for {n} more player(s)." / "{name} hasn't taken a seat yet." / "Everyone is seated."), and **"Start match"** (enabled only for 2 + 2 and nobody unassigned);
    - **member:** a status line and **"Leave"**;
    - **outsider:** **"Join lobby"** (+ a password sheet if private, whose submit reads **"Join"**).
  - **Confirm buttons have their own names**, so each name is unique while a sheet is open: the leave confirm reads **"Leave lobby"**, the close confirm **"Close lobby"** (the options sheet is closed by then), the remove confirm **"Remove {name}"**.
- **Accessible names:**
  - an empty seat: "**Sit here, team A|B**" (member) or "Open seat, team A|B";
  - another player's seat: "**{name}, team A|B**" (+ ", host");
  - **your own seat: "{name} (you), team A|B"**;
  - while a join or switch request runs, the tapped seat has `aria-busy="true"` and the label "Joining…" / "Switching…".
- **Actions:**
  - **Sit:** `POST /lobbies/switchTeam {lobbyId, targetTeam}`.
  - **Your own seat:**
    - members get a sheet with "Stand up" (`'U'`) and "Leave lobby";
    - **the host gets "Stand up" only** (the server refuses a leaving host).
  - **Remove (host):** tap another player's seat, or a Not-seated chip → "Remove {name}?" → **"Remove {name}"** → `PATCH …/kick`.
  - **Options (host):** "Copy invite link" (`{origin}/lobby/{id}`, toast "Invite link copied") and **"Close lobby"** (confirm "Close this lobby? Everyone goes back to the list.") → `DELETE`.
  - **Leave (member):** a confirm sheet → `PATCH …/leave` → `/lobbies`.
  - **Join (outsider):** `POST /lobbies/join`; on success the member view shows (Not seated).
  - Server refusals show as they are; no `window.confirm`.
- **Motion:**
  - seats glide on poll changes (FLIP keyed by username, `spring.ui`); arrivals scale .7 → 1;
  - on Start, the table grows (`scale 1.06`, `spring.felt`) and the rest fades while navigating; the board fades in from the same felt;
  - reduced motion: fades.
- **States:**
  - first load "Loading lobby...";
  - failed first load: `ErrorState` "Couldn't load this lobby" + "Try again" + "Back to lobbies";
  - **removed:** "You were removed from this lobby." + "Back to lobbies";
  - **closed** (404): "This lobby was closed." + "Back to lobbies";
  - the poll-error strip;
  - following: "Opening the match…".
- **Layout notes:** phones use the full-width table and the bottom action bar; desktop centres a max-880 column, and the action bar spans the column.
- **ACs:**
  1. A non-member sees "Join lobby"; after joining they appear Not seated.
  2. A member tapping an empty Team B seat sends `{lobbyId, targetTeam:'B'}`.
  3. "Stand up" sends `'U'`.
  4. Start is disabled until 2 + 2 with nobody unassigned, and the reason line says why.
  5. A poll showing CLOSED sends members to `/game/{id}` with `replace`.
  6. A 404 poll shows "This lobby was closed."
  7. A poll without you, after you were a member, shows the removed state.
  8. Polling pauses while hidden.
  9. 375×812: no horizontal scroll.
  10. The accessible names are as listed.
  11. The seated viewer is at the bottom, with the next in turn order on the right.
  12. The host's own seat offers no Leave.
  13. The host can remove a Not-seated member.
  14. Today's LobbyDetails, TeamManagement, LobbyControls and lobbyService payload tests pass; the poll interval is updated to 2 s (D-16).

### 4.8 The game (`/game/:gameId`)
See §5.

### 4.9 Match History (`/matches`) and Match details (`/matches/:id`)
- **Purpose:** review past matches (D-29…D-31; `RUN/proto/matches.html`).
- **Entry points:** the Matches tab/item; Home's recent matches; a link to a match; the end sheet's "Match details".

**`/matches` (list):**
- **Data:** **summary only** (`GET /user/{id}/history/summary?page&size=10`; R-9 as amended). The page number lives in the URL (`/matches?page=n`, 1-based in the URL), so Back from a match returns to it.
- **Header:** "Match History", "{n} matches", Refresh ("Refreshing..." while busy).
- **Recent form:** one square per match on the page (W green, L red, D yellow; most recent first), "{w} wins · {l} losses on this page", and "won/lost the last {k}".
- **Rows:**
  - stripe and icon tile in the result colour;
  - the result word (Victory / Defeat / Draw / raw);
  - the mode chip (RANKED in the accent);
  - the relative date (today's `MatchSummaryCard` rules) and `#last6`;
  - **the final score** from `result` (the R-36 parser) as "A : B" with "TEAM A · TEAM B", or "Forfeit";
  - a chevron.

  The whole row is a link to `/matches/:id`.
- **Pager:** "Page n", "· 10 matches per page" when full, Previous/Next.
- **States:** "Loading your match history..."; pill "Loading matches..."; error "Unable to load match history" + "Try again"; empty "No matches yet" + "Play a game and it shows up here." + "Find a game".
- **Layout:** one column on phones and desktop (max 880).

**`/matches/:id` (details, pushed from the right; Back and "‹ Match History" return to the same page number):**
- **Data:** three existing routes, no new route:
  - `GET /matches/{id}` (the `MatchDTO`);
  - `GET /matches/{id}/structured-moves`;
  - `GET /matches/{id}/moves`, only for the raw fallback.

  **`yourResult`:** my team from `teamA`/`teamB` + "Team X wins…" (R-36 parser, forfeit included) → "WIN" if X is mine, otherwise "LOSS"; the raw `result` when it doesn't parse **or when I'm in neither team**.
- **States:** "Loading match…"; an error with "Try again"; when only structured-moves fails, the hero and teams render and the hands section says "Couldn't load the hands" with a retry.
- **Every feature of today's `MatchCard`/`MatchDetails` is kept:**
  1. **Hero:**
     - the result icon;
     - the raw result (e.g. "WIN");
     - "Match ID: {last 12}";
     - the mode chip;
     - "{n} Players".
  2. **Tiles:**
     - **Duration** (`h:mm:ss` / `m:ss`);
     - **Mode**;
     - **Hands** (played hands, §6.3);
     - **Tricks**.
  3. **Teams:** "Team A" and "Team B" (not Alpha/Bravo), "{n} members", avatars, "YOU" on yours.
  4. **Match summary:**
     - Team A's final score in an element with **`data-testid="final-a"`** whose text is only the number, then the label **"Team A Final"** and "{n} decl";
     - the raw `result`;
     - the same for Team B (`final-b`, "Team B Final").

     **A forfeit shows "Won by forfeit"** + the raw result (R-36).
  5. **Game history ({n} hands)**, one collapsible row per hand:
     - the number and "Hand n";
     - **PADANJE**; **"{n} ILLEGAL"** (only `legal === false`, R-16);
     - the running score "finalScoreA - finalScoreB";
     - the trump-call preview (first 2 + "+n");
     - a rotating chevron.
  6. **Expanded hand:**
     - **Hand summary:** "Team A: {pts} pts ({decl} decl)", "Team B: …", "Tricks: n", "Trump calls: n"; **CAPOT**; **"HAND AWARDED (PADANJE)"**.
     - **Trump declarations:** player chip (team-coloured avatar + name + YOU) + PASS or the suit chip.
     - **Challenges:** check or x tile, "Challenge by {player chip}", **SUCCESS** / **FAIL**.
     - **Tricks played:**
       - a **"Trump: {suit}" banner** (suit colour + icon);
       - a **column header** with the four players **in seat order starting with you**: the cyclic play order of the hand's first complete trick, rotated to you; fallback A1, B1, A2, B2. Each header shows the avatar, name and "YOU · TEAM A" / "TEAM B", tinted, with a 3-px team top edge.
       - **one row per trick:** "Trick n", "({n} cards)", **PARTIAL TRICK (HAND ENDED)** under 4. One cell per player column:
         - the team tint (20 %) and the team top edge;
         - the **play-order number** (1–4);
         - the card;
         - **the winner:** a gold ring **around the cell** plus a pixel **crown**;
         - **a trump card:** a ring in the trump suit's colour **around the card** (a different element from the winner's cell ring, so a Karo trump never looks like a winner) plus a **TRUMP chip** with the suit icon;
         - **ILLEGAL** with the tooltip "This play violated rules; points only awarded if challenge succeeds.";
         - an empty outlined cell for a missing card.
       - The legend line (as in the prototype).
       - **The winner** is the server's `winnerId` once §6.3 is in. When `winnerId` is null, the client computes it from the four cards and the hand's trump (the game's rule, as `Trick.isCardWinning`).
  7. **Raw moves fallback** "Game moves ({n})" (Order / Player / Card) when there are no structured hands.
  8. **"Match data is not available"** when the match is missing.
  9. **"Back to Match History"** at the end.
- **Layout:** phones use 4 trick columns with 47.33-px thumbnails, and the header row scrolls with the tricks; desktop uses 71-px cards and a sticky header row.
- **ACs:**
  1. The list never requests the detailed history; the details page requests one match.
  2. A row navigates to `/matches/:id`; Back returns to the same page.
  3. The R-36 cases render (en dash, hyphen, spaces, forfeit).
  4. Only `legal === false` shows ILLEGAL.
  5. Columns follow seat order with you first; a partial trick leaves empty cells.
  6. A trump card shows the chip and the suit ring; the winner's cell shows the crown and the gold ring.
  7. `final-a`/`final-b` hold only the numbers.
  8. Recent form counts.
  9. With `winnerId` null, the client-computed winner is crowned.
  10. 375×812: no horizontal scroll.

### 4.10 Profile (`/profile`, `/profile/:userId`)
- **Purpose:** a player's public face (D-32).
- **Entry points:** Profile tab/item; leaderboard rows; friend rows; admin "View".
- **Data:**
  - `GET /user/{id}`;
  - **recent matches** via `GET /user/{id}/history/summary?size=5`, for own and other profiles. The endpoint has no ownership check today (`UserController.java:128-139`), and the owner chose a public profile;
  - own profile also `GET /user/me`.
- **Layout:**
  - **header:** avatar (accent on your own profile), the username (`display`), roles chips (own only);
  - the stat tiles **once**: Elo (`?? '—'`), Games (`?? '—'`), Level (`|| 1`, R-34);
  - recent matches as §4.9 rows;
  - **another player's profile:** friend actions with today's per-card friendship state machine: Add friend / Pending (cancel) / Accept + Decline / Remove (confirm sheet);
  - phones: one column; desktop: stats beside the header.
- **Removed:** the rank ladder, duplicate numbers, the one-tab bar, the raw "Status: …" line, the "1200"/"0" fallbacks.
- **States:** "Loading profile..."; "Couldn't load this profile" + Try again; "Profile not found".
- **ACs:**
  - level 0 → 1;
  - no "Target ID";
  - another player's profile shows stats and recent matches, but no e-mail or roles;
  - friend actions send only the recipient.

### 4.11 Friends (`/friends`)
- **Purpose:** manage friendships.
- **Entry points:** More/sidebar "Friends"; profile friend actions.
- **Layout:**
  - "Friends" and a `Segmented`: "Friends ({n})", "Requests ({n})", "Sent ({n})";
  - search;
  - rows: avatar, name, "Elo {n} · Level {n}", "Friends since {date}" / "Requested {date}", "View profile", and per-tab actions (Remove with a confirm sheet / Accept + Decline / Cancel);
  - phones: one column; desktop: max 880.
- **States:** "Loading friends..."; error + Try again; per-tab empty states pointing to the Leaderboard.
- **Changed:** busy state **per row**.
- **ACs:** FriendList tests pass; one row's busy state doesn't disable the others.

### 4.12 Leaderboard (`/users`, titled "Leaderboard")
- **Purpose:** players ranked by Elo (D-28).
- **Entry points:** More/sidebar "Leaderboard"; Friends' empty states.
- **Data:** `GET /user/findAll?page&size=20&q&sort=elo` (§6.2); the 300-ms debounce and server paging are kept. **The server's page is shown as is: my own row stays and is highlighted.**
- **Layout:**
  - rows: **rank** `#(page·20 + i + 1)` (pix; only without a search term, and only for players with games), avatar, name, Elo, games, level, friend actions;
  - your row: accent edge + "You";
  - "Page n of N";
  - phones: compact rows (rank, name, Elo; friend action as an icon button).
- **Ranking (O-3):** players with at least one game come first, ranked by Elo; accounts with no games follow them, unnumbered, with an "Unranked" tag (the server orders them, §6.2).
- **Signed out:** the prompt is kept, in the public frame (§4.15).
- **States:** "Loading users..."; error + Try again; empty "No players match '{q}'" + Clear search.
- **ACs:**
  - the request carries `sort=elo`;
  - ranks show only without a search;
  - the 8 UserList tests pass, with "shows the server's page without me" updated to "with me, highlighted" (D-28);
  - the ELO/Level client re-sort buttons are gone.

### 4.13 Settings (`/settings`)
- **Purpose:** preferences and account (D-32).
- **Entry points:** More/sidebar "Settings"; the unverified-e-mail banner, the resend button and confirm-email (X-11).
- **Sections:**
  1. **Table effects:** `Segmented` Full / Calm / Off.
     - Stored per device in `localStorage['stiglja:table-effects']` (try/catch; default Full).
     - Under `prefers-reduced-motion`, particles are effectively Off.
  2. **Account** (`id="account"`), moved from the profile with every string and behaviour (`routes-code.md` §1.12):
     - the e-mail status, "(not confirmed)", "Waiting for confirmation: {pendingEmail}" (`data-testid="pending-email"`), resend, "Add an email address" / "Change Email";
     - "Change Password", where **the tab stays signed in on the rotated token** (kept);
     - **"Request account deletion"** with its copy (R-40) and the flagged state;
     - the e-mail-change notice;
     - the **`stiglja:me-changed`** event that refreshes the banner (kept).
  3. **Log out** (full load).
- **Layout:** one column; sections as panels.
- **ACs:**
  - UserProfile's account cases, ChangeEmailForm, ChangePasswordForm and ResendConfirmationButton tests pass against Settings, with the "/profile" link assertions updated to Settings (X-11);
  - the Table effects choice persists;
  - reduced motion → no particles.

### 4.14 Admin (`/admin`)
- **Purpose:** user management and real statistics.
- **Entry points:** the Admin nav item (admins only).
- **Kept:** the role check via `/user/me` (no flash; a failure denies); "Checking permissions..."; "Access Denied"; user management; the R-40 delete copy.
- **Changed (X-7):** System Status removed; **Active lobbies** = the open-lobby count; a failed delete shows an `ErrorAlert`; phones get rows (name, e-mail, role, status, View / Delete).
- **ACs:** AdminDashboard, AdminStats and UserManagement tests pass; Active lobbies shows the open-lobby count; a failed delete renders the error.

### 4.15 Rules, Privacy, Terms
- **Layout:** a 680-px reading frame; "‹ Stiglja" → `/`; the `display` title; `headline` sections; the active-game banner; the footer.
- **The texts are owner-approved and kept word for word** (R-40, R-41).
- **ACs:** the App.test public-page cases pass.

### 4.16 Not found (`*`)
- **Signed in:** inside the shell, "Page not found" + "Go home" (→ `/dashboard`).
- **Signed out:** in the public frame + "Sign in".
- **ACs:** an unknown path shows the right variant per auth state; no horizontal scroll at 375.

### 4.17 Dev board playground (`/dev/board`)
- **Built only** when `import.meta.env.DEV` or the test build flag (`VITE_DEV_BOARD=1`) is set. **A post-build CI step** greps the production `dist/` for the route and fails if it's there (§7.5).
- **Fixtures:**
  - recorded view sequences (JSON) under `src/test/fixtures/views/`;
  - captured by an opt-in harness recorder that saves **only received MESSAGE bodies** on `/topic/games/*`, `/user/queue/games/*` and `/app/queue/games/*`, **with no headers and no sent frames** (CONNECT carries the JWT);
  - a fixture guard test fails on "Bearer" or `eyJ`.
- **Controls:** play / pause / step; speed; chaos (duplicate + stale + public-first ordering); snapshot jump; layout presets (375×812, 812×375, 1440×900); effects; reduced motion.
- **Removed (D-27):** `/play/mock`, `/play/realistic`, `src/MockComponents/`, GSAP, and `LOGS/ref-shots.mjs`'s realistic step.

---

## 5. The game board

### 5.1 The rule that designs out the old failure
**The server's views are the only source of truth.** The board:
- renders the newest accepted state;
- derives every animation from the difference between the previously rendered state and the new one;
- never gates, queues or reorders input on animation or local simulation;
- **snaps** to state on a reload, reconnect or unexplainable change, without replaying.

### 5.2 Units (names are durable; files are the plan's)

| Unit | Kind | Responsibility | Tested by |
|---|---|---|---|
| `useGameViews` (extends `useBelatroGame`) | hook | Owns the accepted state and the acceptance rule (§5.3.1); tags `live`/`snapshot`; keeps every behaviour of today's hook (refresh, notAvailable, "Not sent", DISCONNECT) | Today's hook tests + acceptance tests |
| `boardModel(state, me, local)` | pure | State → BoardModel: seats, sorted hand, trick (by seat, play order), piles, HUD, flags, controls. **A card shown in the trick, or in `lastTrick`, is never in my hand** | Units per row of §5.3.3 |
| `diffBoard(prev, next)` | pure | → `BoardEvent[]`, or `null` (unexplainable → snap) | Units per row of §5.3.4 |
| `cardTargets(model, layout)` | pure | → `left/top/rotate/scale` per card id, per hand slot, per trick slot, per pile | Units: fits at 375×812, 812×375, 1440×900 |
| `handOrder` | pure | §5.3.6 | Units |
| `trickWinner(cards, trump)` | pure | The game's rule (as `Trick.isCardWinning`), for the replay fallback (§4.9) | Units |
| `<Board>` and its regions | components | The DOM contract of §5.10; Motion layout transitions; the trick-hold timer | Component tests with view sequences |
| `<Arena>` | component | Felt layers, the particle canvas, the wheat | Component test (`data-season`) + visual |
| Sheets | components | Bela Blok, Peek, Hand result, End of game, Game menu | Component tests |
| `useMatchHands(gameId, view)` | hook | `GET /matches/{id}/structured-moves` with the expected hand (§5.3.3), deduplicated, ≤ 1 in flight | Hook tests |

### 5.3 Data and rules

#### 5.3.1 Accepting frames (fixes review blocker 1)
The server sends each update as **one public frame, then one private frame per seat, at the same version**. Public and private frames can arrive in either order (`game-data.md` §2.1).
1. **The board's whole state comes from private frames**, whose `publicPart` is a full public view. **Once a private frame has been seen, public-only frames are ignored for state.**
   - Every fan-out gives every seat a private frame.
   - The only public-only extras are `/refresh` broadcasts, which carry no new state.
   - Before the first private frame, a public frame may show a read-only "Connecting" table.
2. **With `stateVersion` (§6.1),** a private frame at version `v`, against the accepted version `c` (O-1):
   - `v > c`: accept it (diff and animate; a snapshot-tagged frame snaps, §5.5);
   - `v == c`: merge the clocks only, with no animation: if the frame's `currentPlayerId` equals the accepted one, `turnExpiresAt` becomes the later of the two non-null values and a null never replaces a value; in HAND_COMPLETE a non-null `challengeWindowExpiresAt` replaces a null one; `serverNow` only feeds the skew estimate; nothing else changes;
   - `v < c`: drop it.

   The accepted version belongs to one game: the hook starts empty on every mount, and a rematch remounts the page.
3. **Snapshots** (the `/app/queue/games/{id}` answer, and the first private frame after mount or a reconnect) are tagged `snapshot` and **follow item 2** like any frame, so a live frame newer than a late snapshot wins. The server's counter never goes backwards (§6.1 rule 1), so nothing has to reset it.
4. **Without `stateVersion`** (an older backend): today's merge behaviour is kept exactly: a private frame sets both parts; a later public frame replaces the public part (`useBelatroGame.test.tsx:75` stays valid for this path). Animations are still derived; a stale frame can flicker. This is documented, not hidden.
5. **Duplicates** animate nothing (empty diff).
6. **`DISCONNECT`** (a bare string, so it has no version) is ignored once a CANCELLED state is known (kept). When it arrives first, the page waits up to 1 s for a CANCELLED frame before leaving (`game-data.md` §8 #16).

#### 5.3.2 Seats on screen
- Positions **me (bottom), right, partner (top), left**, from `seatingOrder` rotated to me (`seatsFromMe`, kept).
- Play goes counter-clockwise: the next to act after me sits on my right.
- Positions are fixed per player id for the whole game.
- The lobby uses the same geometry (§4.7).

#### 5.3.3 Data mapping

| Element | Source | Rule / fallback / test id |
|---|---|---|
| Felt season | `trumpOf` (kept): PLAYING/HAND_COMPLETE trick trump; none in BIDDING | Neutral in BIDDING. COMPLETED/CANCELLED keep the last season, with particles at Calm |
| Trump badge | `trumpOf` + the `CALL_TRUMP` bid's player | Badge = icon (`alt=""`) + an inner element **`data-testid="trump"` whose text is exactly the suit name**, rendered **only when `trumpOf` is non-null**. "Bidding" and the season word sit outside it |
| Score chip | `teamAScore`, `teamBScore`; my team | "Mi" = my team. **`data-testid="score-a"`/`"score-b"` are elements whose `textContent` is exactly the current number**. The digit-slide animation uses `aria-hidden` siblings outside them |
| Phase | `gameState` | `data-testid="game-phase"`, `data-phase` raw, text = `PHASE_LABEL` |
| "This hand" summary (always in the DOM, visually hidden) | `bids`, `declarations`, `teamOf`, my hand | For screen readers, tests and the harness:<br>- one `data-testid="bid"` per bid, text "{player}: Pass" / "{player}: {Suit}" (today's format), until the next deal;<br>- `declaration` lines;<br>- `data-testid="your-team"` "Your team: A";<br>- "Your hand: …" (the `cardLabel` list, no test id), so the hand can be reviewed while its buttons are disabled |
| Seat chips | `seatingOrder`, `teamA/B` | `data-testid="seat-{id}"` (`data-current` on the seat to act), containing `cards-left-{id}` (visually hidden on phones) and, on the seat to act, `turn-countdown` "{n} s" |
| Countdown | `currentPlayerId`, `turnExpiresAt`, `serverNow` | `skew` = the largest `serverNow − receivedAt` among the last 10 accepted frames (the least-delayed sample); without `serverNow`, 0 |
| "Your turn" | `canBid`/`canPlay` (kept) | `data-testid="your-turn"`, never in HAND_COMPLETE |
| Dealer chip | `dealerId` (§6.1) | Fallback `seatingOrder[3]` in BIDDING. `data-testid="dealer-chip"` |
| Opponents' hands | `cardsLeft` | Backs, fanned per seat |
| My hand | private `hand` minus any card in the trick or in `lastTrick` | `handOrder`. `data-testid="hand-card"`, `data-card="{BOJA}-{RANK}"`, `aria-label` (`cardLabel`), `disabled` as §5.3.5. Illegal cards stay enabled |
| Trick | `currentTrick.plays`; play order = the cyclic `seatingOrder` from `leadPlayerId` | `data-testid="trick-card"`, `data-card`, `data-seat="{playerId}"`. Hidden in BIDDING (kept) |
| Trick winner | `lastTrick.winnerId`; fallback the `plays` key whose card equals `currentTrick.winningCard` | Crown + gold ring |
| Piles | `tricksWonA/B` | Fallback: count observed completions this hand (hidden after a snapshot without the field). `data-testid="pile-a"`/`"pile-b"`, `data-count` |
| Bid chips | `bids` | Visible while bidding; cleared at the trump call |
| Bid panel | `canBid`; `dealerMustCall` (kept) | "Pass", "Call Herc|Karo|Pik|Tref" (exact); `dealer-must-call` "The dealer must call trump" |
| Bela prompt | `isBelaCard` (kept) | `data-testid="bela-prompt"`: "Play" / "Play + Bela", anchored above the card. The held card is dropped when `canPlay` turns false (kept, `GameTable.tsx:77-79`) |
| Bela marker | `belaDeclaredByPlayer` false→true | A "Bela" chip at the seat |
| Declarations | `declarations` → `declarationLines` (kept) | Zvanja chips at seats on the first PLAYING view; lines in the summary |
| Challenge | `canChallenge`, `CHALLENGE_HINT` (kept) | The HUD shows "Challenge" + an info icon button that reveals the hint in a popover. **`data-testid="challenge-hint"` holds the full hint text in the DOM** (visually hidden until revealed) while Challenge is offered. In HAND_COMPLETE both sit in the hand-result sheet |
| Window | `challengeWindowExpiresAt` **only in HAND_COMPLETE** | A bar in the hand-result sheet; tolerates null-then-set |
| Hand result | `useMatchHands` for the hand just ended | **The fetch looks for the expected hand: the one whose summary's final scores equal the view's scores** (robust after a snapshot), retrying up to 3 × 500 ms until that hand has a `handSummary` and its tricks (the frames go out before Mongo has the 8th card and END_HAND; review finding 22). Otherwise it shows the score deltas between the last PLAYING and the HAND_COMPLETE state. `data-testid="hand-result"` |
| Bela Blok | `useMatchHands` → one row per hand **= `finalScoreA/B(n) − finalScoreA/B(n−1)`** (so rows add up, padanje/capot included), PAD/CAPOT from the flags, **deduplicated by `handNo`**, hands without a summary skipped | Desktop: the right column; phones: a sheet. `data-testid="bela-blok"` |
| Peek | `useMatchHands`, current hand's tricks won by my team (§6.3 winner; fallback `trickWinner`) | Tap my team's pile; the opponents' pile shows the toast "You can only look at your team's tricks". `data-testid="peek-sheet"` |
| End of game | `gameState`, `winnerTeamId`, `endReason`, `forfeitTeamId` → `endSentence` (kept); DECLINED → `/play` with the notice (kept) | End sheet; "Team X wins" (kept); `data-testid="end-reason"`; the final score shown **without** test ids |
| Rematch | `useRematch` (kept) | "Play again" (kept), `rematch-votes` "{n}/4 want a rematch", "{by} left — no rematch", "Rematch expired", Leave → `/lobbies` |
| Connection | `ReconnectBanner`; "Not sent — reconnecting" | A top strip and an `ErrorAlert` |
| Not yours | `notAvailable` (kept) | "This game isn't yours or has ended" + "Back to dashboard" (R-35) |

**Test-id rule:** **each kept test id exists exactly once in the DOM.** Visible copies (the menu's "This hand", the end sheet's score) carry no test ids, and closed sheets unmount their content.

#### 5.3.4 State difference → animation

Positions always come from `cardTargets`; events choose origins, holds and announcements. "Unexplainable" is decided **by content only** (versions only order frames).

| Change | Event | Motion |
|---|---|---|
| New deal: BIDDING with no bids and my hand a new 6-card set (or prev HAND_COMPLETE/null) | `Dealt` | **All hand-card elements exist from the first state of the deal** (the harness counts 6 at once); the stagger only delays their motion. Cards fly from the **dealer's seat** in turn order from the first bidder (`stagger.deal`); mine flip face-up on arrival. Piles fade. Felt → neutral |
| `bids` grew | `Bid` | A chip pops at the seat (`spring.quick`) |
| Trump appears | `TrumpCalled` | Season transition (§5.7); the trump badge flies from the caller's seat; then **+2 per seat** from the dealer (elements exist at once; staggered motion) |
| An opponent's new play | `CardPlayed` | The trick card mounts with an initial offset at the seat's hand anchor (back showing, `scale .5`) and springs to its slot, flipping (`rotateY 180→0`). One back leaves that hand (fade 120 ms) |
| My new play | `CardPlayed{me}` | A **shared-layout transition** (`layoutId = card id`): the card flies from its on-screen box in the hand toolbar to its trick slot (`spring.ui`, `path.card`); the fan closes |
| `plays` reached 4 | `TrickCompleted` | Crown + gold ring (`spring.quick`); **hold** 900 ms (visual only); then the **sweep**: the 4 cards move to the sweep layer and fly to the winner team's pile (`stagger.sweep`, `scale .5`, ±8°), fade, pile +1 |
| The next lead arrives during the hold | early `TrickCollected` | The sweep starts **at once**; the new card animates concurrently |
| Prev had 3 plays; next shows a newer trick; `lastTrick` holds the completed one | `TrickCompleted` (recovered) | The 4th card enters from its seat, then sweeps immediately after landing |
| HAND_COMPLETE | `HandCompleted` | After the 8th sweep, the non-modal hand-result sheet rises (`spring.sheet`) |
| `belaDeclaredByPlayer` flip | `Bela` | A chip pops at the seat |
| `declarations` appeared | `Declared` | Zvanja chips (staggered 60 ms) |
| Scores changed (not a hand end) inside HAND_COMPLETE, or PLAYING → BIDDING/COMPLETED with a partial trick | `ChallengeUpheld` | Toast + live region "Challenge upheld: Team X takes the hand"; partial trick cards fade; then as a new deal |
| A seat's challenge flag flipped, nothing else changed | `ChallengeFailed{seat}` | Toast "No foul found" for me; "{name} challenged: no foul found" for another seat (O-4) |
| Scores changed (hand end) | `Scored` | Digit slide (`aria-hidden` copies) |
| `currentPlayerId` changed | `Turn` | Seat colour switch; the countdown bar resets |
| COMPLETED / CANCELLED | `Ended` | The non-modal end sheet rises |
| `diffBoard` → `null` (cards vanished from the trick without a completion; my hand changed by more than one card mid-hand; the seats changed) | — | **Snap** (§5.5) |

#### 5.3.5 Input rules (D-9)
1. **Enabled:**
   - a hand card iff `phase === PLAYING && yourTurn` and no move is in flight;
   - bid buttons iff `canBid` and no bid is in flight;
   - illegal cards are **not** disabled (R-19: fouls are part of the game).
2. **Press:** on pointer-down, `press` feedback at once. On click: a bela card opens the prompt; any other card is sent.
3. **Pending:** on send, the card lifts −20 px and scales 1.04 with a gold ring (`spring.quick`). Other hand cards are disabled (the **send lock**) until one of (O-2):
   - a state newer than the one at send time is accepted (the card shows in the trick → it flies);
   - `yourTurn` turns false;
   - the socket reconnects.

   After **2 s** without one of these, the lifted card drops back (a visual cue only); the send lock holds. If `publish` returned false: "Not sent — reconnecting" (kept), and the lock clears.
4. **Bids:** one in flight, the same way.
5. **The newest model wins:** clicks act only on cards the newest model shows as mine. **Nothing waits for an animation, hold or sweep.**
6. **Layering:** the bid panel, the bela prompt and the sheets sit above the card regions (§3.4). A closed sheet takes no input.
7. **Keyboard:** the hand is a toolbar (←/→, Home/End, Enter/Space); the bid panel is in tab order; Escape closes sheets.

#### 5.3.6 Hand order (D-12)
- **At each deal,** the suit-group order is the server's order of that first 6-card hand, **frozen** until the next deal. A snapshot that lands mid-hand sets the order from the hand it shows.
- **A suit first seen in the +2** joins after the frozen groups, in the server's order.
- **After the trump call,** the trump group moves to the right end.
- **Within a suit,** weakest → strongest: trump 7, 8, Q, K, 10, A, 9, J; other suits 7, 8, 9, J, Q, K, 10, A.
- Cards are matched by `{boja}-{rank}`, never by index.

### 5.4 Panels and sheets
- **HUD** (top, `ink-chip`): the score chip (+ "Blok" on phones), the phase word, the trump badge, Challenge (when offered), and the menu button.
- **Game menu (X-10):**
  - Bela Blok (phones);
  - "This hand", the visible copy without test ids: bids, declarations, your team;
  - Rules (new tab);
  - **"Back to home"** with "Your seat stays. If you're away, the timer plays for you; 5 missed turns in a row forfeit (casual: the game is cancelled)."
- **Bela Blok:** #, MI, VI, PAD/CAPOT, running totals (pix). Desktop: a permanent 320-px right column with "Tap your team's pile to look at the tricks you've won this hand."
- **Peek:** "Your team's tricks", one row per won trick with 4 thumbnails, the winner crowned.
- **Non-modal board sheets** (hand result, end of game) dock at the bottom of the board area at every width, never over the trick region.
- **Hand result** (non-modal): "Hand n"; Mi/Vi points with decl and bela; PAD/CAPOT; the window bar; Challenge + hint. Before the window is known: "Next hand shortly".
- **End of game** (non-modal):
  - the winner line or end sentence; `end-reason`; the final score (`score-xl`, no test ids);
  - actions as today per end type: **rematch-offered ends** (COMPLETED, ranked forfeit: `rematchOffered`) show "Play again" + Leave; **other ends** show "Back to lobbies";
  - plus "Match details" → `/matches/{id}`.
- **Not-yours screen:** "Back to dashboard" (R-35).

### 5.5 Interruption, reconnect, snapshots
- **Interruption:** card elements use Motion layout transitions and `animate()`; a new target mid-flight re-targets from the current value and velocity. Holds are timers that only decide *when* a sweep starts, and any newer event cancels them.
- **Snap** (a snapshot, or a `null` diff):
  - every element is set to its target instantly, with no deal, flight or sweep;
  - a trick in progress shows as is;
  - pending clears if the card is in the trick;
  - the season felt is set without a burst;
  - piles come from `tricksWonA/B`.
- **Reconnect:** `ReconnectBanner` (R-30); re-subscribe → snapshot → snap. A token renewal (~105 min) takes the same path with no banner.
- **Backend restart** (R-21): the snapshot's fresh `turnExpiresAt` resets the countdown.

### 5.6 Layouts (D-21, D-24; `RUN/proto/board.html`, layout A)
**Which layout applies:** landscape with height ≤ 500 px → §5.6.2, whatever the width. Otherwise width ≥ 1024 → §5.6.3; otherwise §5.6.1, scaled up for 768–1023. The board root is `overflow: clip` (deal origins, side fans and sweeps never widen the page), sized with `100dvh` and padded by the safe-area insets (§3.4).

#### 5.6.1 Phone portrait
- The felt fills the viewport (a vignette, no rim at the screen edges); the HUD floats at the top.
- **Partner:** top centre, 46 px under the HUD, fanned backs (10-px step), name chip below.
- **Left / right:** vertical stacks 30 px from the edges.
- **Trick:** a cross at 44 % of the felt height. Slots: partner (0, −0.58·ch), right (+0.84·cw, 0), left (−0.84·cw, 0), me (0, +0.58·ch). Each card gets a stable tilt of −4.8…+4.8° from its id.
- **My hand:**
  - an arc fan with **step ≤ 36 px**, 2.2° per position, arc 1.4 px·offset²;
  - 8 cards span 7×36 + 71 = 323 px, plus the rotation margin, within 343 px;
  - **the lower 20 % of each card sits below the edge**, so each card exposes **≥ 36×76 px**.
- **My name chip:** bottom-left.
- **Piles:** mine bottom-left above the hand; the opponents' top-right.
- **Bid panel:** centred.
- **Sheets:** from the bottom.

#### 5.6.2 Phone landscape (height ≤ 500 px)
- The HUD as corner chips.
- **Hand:** step ≤ 52 px, 71×95, the lower 25 % below the edge; exposes ≥ 36×71.
- Opponents' fans at `scale(.4)`; the trick cross centred, slots ±0.7·cw / ±0.45·ch.
- **Seat chips:** the name, the countdown bar, **and the seconds text** (visually hidden is allowed; `turn-countdown` stays inside `seat-{id}`).
- Bela Blok is a sheet.
- **AC:** at 812×375, every card, chip and control is on screen with no scroll.

#### 5.6.3 Desktop (≥ 1024 px, height > 500)
- The board area (max 1100) and the 320-px Bela Blok column.
- Card sizes per §3.6. Hand step ≤ 64 px at 106.5 wide and ≤ 84 px at 142 wide, so each card's left 40 % stays exposed.

#### 5.6.4 How the table looks in each state
| State | What shows |
|---|---|
| Connecting | Neutral felt, `Loader`, the kept texts "Loading game state..." / "Connecting to game..." + the connection error, `ReconnectBanner` |
| BIDDING | Neutral felt; 6 cards each; bid chips; the bid panel on my turn (`dealer-must-call` when forced); the dealer chip |
| PLAYING | Season felt and particles; the trick cross; piles; the countdown; Challenge in the HUD while offered |
| HAND_COMPLETE | The 8th sweep, then the hand-result sheet; nobody's turn |
| COMPLETED / CANCELLED | The last season (particles Calm); the end sheet |
| Not yours | The R-35 message on the neutral background |
| Render error | The game boundary (R-29); the shell stays |

#### 5.6.5 Hover (the owner's, kept: D-35)
- **Fine pointers:** hovering a playable hand card lifts it −24 px and scales it 1.08 over 160 ms, on an **inner** wrapper; z-order up.
- **While bidding:** hovering a bid button or a hand card rings every hand card of that suit in the suit colour (opacity 120 ms).
- **Touch:** press feedback replaces hover.

### 5.7 The arena: a season per trump (D-22, D-35)
- **The seasons:** Herc → spring, Karo → summer, Pik → autumn, Tref → winter. BIDDING is neutral.
- **Felt:** two stacked layers (§3.2 pairs + a static top-light/bottom-dark wash) cross-fading (`spring.felt`, opacity only). `data-testid="arena"`, `data-season="none|spring|summer|autumn|winter"`.
- **Particles:** one `<canvas>` (layer 1), DB32 pixel sprites at 3-px pixels plus the season's suit icon (17×16, nearest-neighbour):
  - **spring:** pink and white petals drifting down, Herc icons floating up;
  - **summer:** gold motes rising, Karo icons, **pixel wheat along both bottom edges swaying ±1 px**;
  - **autumn:** orange, brown and gold leaves falling, Pik icons;
  - **winter:** snow, Tref icons.
- **Density:**
  - **Full:** ≤ 52, with a ×1.6 burst for 1.6 s after the call;
  - **Calm:** ≤ 14 at 55 %;
  - **Off:** none, static wheat;
  - **reduced motion:** Off; the felt still changes, instantly.
- The canvas pauses while hidden and never drives React state.
- **AC:** `data-season` follows `trumpOf`; particle counts stay within the budget; Off or reduced motion draws no moving sprites.

### 5.8 Accessibility on the board
- The board is a region "Game table".
- A polite live region gives one message per event:
  - "Your turn" / "{name}'s turn";
  - "{name} played {card}";
  - "{name} wins the trick";
  - "{name} called {suit}";
  - "Challenge upheld…";
  - "Hand {n}: Mi {a}, Vi {b}";
  - the end sentence.
- Hand cards are toolbar buttons with `aria-label` (`cardLabel`) and `aria-disabled` in step with `disabled`.
- The trick region's text lists the plays ("Trick: ivo As Herc, luka 10 Herc").
- Countdown seconds are text; the crown reads "won the trick"; sheets follow `Sheet`.

### 5.9 Behaviour survival matrix

| Behaviour (R) | New home | Test |
|---|---|---|
| Whose turn + countdown (R-27/R-31) | `seat-{id}` `data-current`, `turn-countdown` inside it | Board: seat 2 highlighted, ~30 s |
| Your team (R-31) | `your-team` in the summary | Board |
| Phases in words (R-31) | HUD `game-phase` | Board (5 phases) |
| Bid panel; Pass disabled after 3 passes; dealer must call (R-23) | Bid panel, `dealer-must-call` | Board (2) + the server error via `ErrorAlert` |
| Bela prompt (R-32) | Prompt over the card | Board (4) |
| Declarations, R-49 winner list | Chips + `declaration` | Board |
| Challenge hint + button (R-31/R-18) | HUD / hand-result sheet | Board: PLAYING **and HAND_COMPLETE** (new) |
| Window incl. the deciding hand (R-48) | Hand-result window bar | Board: deciding hand → window → end sheet |
| End sentence; forfeit is "Game over" (R-20/R-25) | End sheet `end-reason` | Board `test.each` ×6 |
| DECLINED → `/play` with the notice (R-25) | Page | GamePageConnected (kept) |
| Rematch (R-45) | End sheet | useRematch (8) + Board (4) |
| Reconnecting / Retry (R-30) | Strip | ReconnectBanner (kept) |
| "Not sent — reconnecting" (R-30) | `ErrorAlert` | useBelatroGame (kept) + Board |
| Not yours (R-35, R-24) | Page | GamePageConnected (kept) |
| Error boundary (R-29) | Page | GamePageConnected (kept) |
| 375-px fit (R-37) | §5.6 | Playwright 375×812 + 812×375; harness `assertFits` |
| A finished table survives a late reconnect | Hook | useBelatroGame (kept) |
| Rejected move shown | `ErrorAlert` | Board |
| The previous hand's trick hidden while bidding | `boardModel` | Board (kept) |
| HAND_COMPLETE is nobody's turn | `boardModel` | Board (kept) |
| The trick shows at each seat | `trick-card` `data-seat` | Board (rewritten from `within(seat-…)`) |

### 5.10 DOM contract, test ids and accessible names (the harness relies on these)
**Regions:**
- `data-testid="hand"`: a `role="toolbar"` (`aria-label="Your hand"`) containing **only** the hand-card `<button data-testid="hand-card" data-card disabled? aria-label>` elements;
- the trick region, containing `<div data-testid="trick-card" data-card data-seat>`;
- a sweep layer for cards in flight to a pile (no test ids);
- `seat-{id}` chips containing `cards-left-{id}` and, for the seat to act, `turn-countdown`;
- the HUD with `score-a`, `score-b`, `game-phase`, `trump` (when non-null) and the visually hidden summary (`bid`, `declaration`, `your-team`).

**Card elements** are `motion` elements positioned by `left/top` from `cardTargets`, with a `layoutId` per card id. Moving between regions (hand → trick → sweep) is a shared-layout transition from the element's on-screen box (FLIP), so the spring and its velocity carry over.

**Kept exactly:**
- test ids:
  - `game-phase` (+`data-phase`);
  - `hand-card` (+`data-card`, `disabled`);
  - `your-turn`, `bid`, `trump`, `score-a`, `score-b`, `end-reason`, `dealer-must-call`, `bela-prompt`, `challenge-hint`, `rematch-votes`;
  - `trick-card` (+`data-card`), `turn-countdown`, `seat-{id}` (+`data-current`), `cards-left-{id}`, `declaration`, `your-team`, `hand`;
- buttons: "Pass", "Call Herc|Karo|Pik|Tref", "Play", "Play + Bela", "Play again";
- texts: "Not sent — reconnecting", `/^Team [AB] wins/`, "{n}/4 want a rematch".

**New:**
- `arena` (+`data-season`), `pile-a`/`pile-b` (+`data-count`), `bela-blok`, `peek-sheet`, `hand-result`, `dealer-chip`;
- `trick-card` `data-seat`;
- `final-a`/`final-b` (Match details).

**Each kept test id exists exactly once in the DOM.**

---

## 6. Backend changes

**Consumer of every item:** `Belatro_FrontEnd_LukasSoloRewrite` (this SPA).
- **Rules** (`stiglja/CLAUDE.md`):
  - wire changes are additive and two-step (backend first; the SPA tolerates absence);
  - **behaviour fixes with the same wire shape** are listed as such: the controller-after-action broadcasts carry a fresh read instead of the captured object (§6.1 rule 2), structured-moves files the 8th card's moves under the right hand (§6.3), and `sort=elo` orders players with games first (§6.2). Consumers (this SPA and the dormant sibling frontends) only get fresher or corrected data;
  - **no edit** to `BelotGame.java`, `SecurityConfig`, `WsConfig`, `RedisConfig`, `SchedulerConfig.taskScheduler`, the `MatchRepo` `@Query`, or any `models/` `equals`/`hashCode`.
- **Where:** a backend branch from `pre-deploy` after the U-wave, or from the merged main; never in `pd-backend`. One commit per item, with tests. `BelotGameService` and `GameSocketController` tests are mandatory (churn hotspots).

### 6.1 Game view fields (`PublicGameView`)

| Field | Type | Value | Producer |
|---|---|---|---|
| `stateVersion` | `long` | A per-game counter, increased by every `save` | Rules below |
| `lastTrick` | object or `null` | `{leadPlayerId, plays: {playerId: Card}, order: [playerId…], winnerId}` for the **last completed trick of the current hand**; `null` before the hand's first completion; present through HAND_COMPLETE; reset at the deal | `g.getCompletedTricks().getLast()` (cleared at the deal by `resetHandState`). `order` = cyclic turn order from `leadPlayerId`. `winnerId` from `Trick.determineWinner()` |
| `tricksWonA`, `tricksWonB` | `int` | Current hand's completed tricks per team | Counted from `getCompletedTricks()` by the winner's team |
| `dealerId` | `String` | The current dealer | `g.getDealer().getId()` |
| `serverNow` | `long` | Epoch ms when the view was built | `System.currentTimeMillis()` |

**Producer rules for `stateVersion`.** The SPA drops a private frame whose version is not above the last accepted one, so **a frame's version is never newer than the state it carries, and at most one save older** (an older frame is an equal-version duplicate at the SPA, §5.3.1 item 2, and the save's own fan-out follows with the right version).
1. **Writer** (O-1):
   - `BelotGameService.save` writes the game key first, **then**, before it publishes any event, advances `belot:gamever:{gameId}` with **one Lua script**: if the key is missing it is first set to the current epoch ms; then `INCR`; then `PEXPIRE` with the game key's TTL. A lost, evicted or expired counter therefore restarts above every value it had (≈1.8·10¹², well inside JavaScript's 2⁵³), and the key never lacks a TTL (R-7);
   - it uses **`StringRedisTemplate`** (as `AbsenceCounters` does), never the `RedisTemplate<String, BelotGame>`, because `RedisConfig` is do-not-touch;
   - the version key gets **the same TTL as the game key**, set at the same points, including where `GameActivityAspect` refreshes the game key's TTL;
   - GSC is published after both writes;
   - **a failure of the counter never stops `save`** (it is logged): `save` runs the state-change listeners and `finaliseMatch` after the write, and an exception there would lose a ranked result.
2. **Readers:** every fan-out reads **once per fan-out**, exactly, then passes the version into the builders as `toPublicView(g, version)` and `toPrivateView(g, p, version)`, so the public and private frames of one fan-out carry the same version.
   - **Exact read:** read the version, then the game, then the version again; retry up to 3 times while they differ. If they still differ, skip this fan-out (for `/refresh` and the snapshots that means no answer; the SPA's 3-s refresh retry covers it); a later fan-out follows every save. (Reading under `underGameLock` was rejected: unknown game ids from `/refresh` or a SUBSCRIBE would grow the static lock map forever.)
   - **This covers:**
     - GSC and TS;
     - **the four controller-after-action sites, which stop broadcasting the captured object:** play (`GameSocketController.java:96`), bid (`:111`), challenge (`:120`), cancel (`:197`);
     - `/refresh`;
     - the `@SubscribeMapping` snapshot.
3. **Coverage:** every save is followed by at least one fan-out built after both writes. The counter advances before `save` publishes anything (GSC, and the TS that `save` itself publishes on a return to BIDDING).
4. **Repeated versions:** **only** clock-only re-broadcasts repeat a version: the TS re-arm after a GSC, and `GameTimerRearmer` after a restart. `openChallengeWindow` calls `save`, so it **does** increment.
5. **No `BelotGame` field** is added. `belot:gamever:*` doesn't match the restart scan `belot:game:*`.

- **Wire:** additive fields; the TS types gain them as optional.
- **Deploy:** backend, then SPA, both before the first deploy (D-0). The SPA works without them (§5.3.1 item 4, §5.3.3 fallbacks).
- **Tests:**
  1. `lastTrick` order and winner for a trick led by each seat; `null` at a hand's start; reset at the deal; present in HAND_COMPLETE.
  2. `tricksWonA/B` counts.
  3. `dealerId` after a deal.
  4. IT: versions strictly increase across a play, a bid, the 8th card (3 saves) and a window expiry. One fan-out's public and private frames carry the same version.
  5. IT: a second move forced between an action and its controller broadcast → that broadcast carries the newer state with its exact version, never an older state.
  6. IT: the version key expires with the game key, and the aspect refreshes both TTLs.
  7. `serverNow` is within 1 s of the test clock.
  8. IT: a counter deleted mid-game restarts above its previous value at the next save, and the key has a TTL after every save.

### 6.2 Leaderboard sort (`GET /user/findAll`)
- An additive query parameter `sort`:
  - absent = today's (by username, `UserService.java:95`);
  - `sort=elo` (O-3) = players with `gamesPlayed > 0` first, by Elo descending, then games played descending, then username ascending; then the accounts with no games, by username ascending;
  - any other value → 400 Bad Request with "Unknown sort: {value}" in the backend's usual error body.

  It works with `q` and paging.
- **Wire:** an additive option on an existing route.
- **Tests:** an IT for ordering with ties, an account with no games and a higher Elo listed after the played ones, the default unchanged, and the bad value.

### 6.3 Structured-moves trick fix (verified on the rig, 2026-10-09)
- **Evidence:** match `6ac9061df0a9f70ffc4dfa74`, `GET /matches/{id}/structured-moves`:
  - **trick 8's `winnerId` is null in all 9 hands**;
  - **trick 1 of hands 2–9 carries the previous hand's trick-8 winner** (7 of 63 tricks disagree with a recomputation from the cards);
  - **a phantom 10th hand** has no tricks and no summary.
- **Cause** (code reading, `review` finding 23): END_HAND is recorded before the 8th card's PLAY_CARD and END_TRICK. The builder (`services/impl/MatchServiceImpl.java:113-114, 369-383, 428-435`) moves the stray 8th card back but files END_TRICK into the next hand.
- **Fix** (behaviour, same wire shape; today's Match Details benefits too):
  - the builder assigns an END_TRICK to the hand whose cards it closes;
  - a hand bucket that kept no move of its own (no trick, summary, bid, challenge or card waiting for trump) isn't emitted, so a live hand still in bidding keeps its bucket;
  - trick 8 gets `lastTrickBonus: true` when it receives its END_TRICK, as `flush` does;
  - stored moves are unchanged, so old matches are fixed at read time.
- **Tests:** a fixture of moves in the recorded order gives 9 hands with 8 tricks each, every `winnerId` set and correct, and no phantom hand. The existing structured-moves tests stay green.

### 6.4 Nothing else
- No other route, DTO or destination changes.
- The U-wave's new error string ("Wait for the post-hand pause to end") needs no SPA change: the SPA never sends cancel. A future cancel control must disable itself in HAND_COMPLETE.

---

## 7. Verification

### 7.1 Every existing Vitest behaviour keeps a test
- **Baseline:** 60 files, 382 declarations + 13 `test.each` rows = **395** (`routes-code.md` §7, `game-data.md` §5).
- **The rule:** each case keeps a test with the same assertion meaning:
  - **kept as is:** services, hooks, socket, config, utils, the guards;
  - **moved:** UserProfile's account cases → Settings; the R-9 case → the list and details tests;
  - **rewritten:** 26 GameTable cases → Board tests with view fixtures; `within(seat-…)` trick queries → `data-seat`; the AppLayout drawer cases → TabBar cases.
- **Tests changed by an owner decision** (each change cites it):
  - lobby poll 3 s → 2 s (D-16);
  - the dashboard without Win Rate (D-26);
  - the unverified banner's "Open settings", `ResendConfirmationButton.test.tsx:51`, `UnverifiedEmailBanner.test.tsx:62`, `ConfirmEmailPage.test.tsx:58,70` → Settings (X-11);
  - Settings in the nav (R-34 amended);
  - UserList "without me" → "with me, highlighted" (D-28);
  - UserCard's "✓"/"✗" buttons → "Accept"/"Decline" (D-36: no emoji);
  - MatchHistory R-9 (D-30).
- **Allowed deletions:** **AuthGuard (5)** (unused; its behaviour is covered by AdminDashboard's 4) and the **AppLayout drawer (3)**, replaced by TabBar cases.
- **The plan carries a table "old test → new test" for all 395**; the final review checks it.

### 7.2 New tests (Vitest + RTL, jsdom)
- **Pure units:**
  - `boardModel` (every §5.3.3 row, including "a card in the trick is never in my hand");
  - `diffBoard` (every §5.3.4 row, including `null` → snap);
  - **frame acceptance:** private-only state after the first private frame; public→private and private→public at one version (**my card leaves my hand and `yourTurn` updates in both orders**); greater / equal-merge / lower-drop; at one version a GSC frame with a null deadline after a TS frame keeps the TS deadline; **a snapshot older than a live frame that arrived after the re-subscribe is dropped**; the no-version path;
  - `cardTargets` (375×812, 812×375, 1440×900; card sizes per density, including a non-integer DPR);
  - `handOrder` (frozen groups, +2 suit, trump right, strength);
  - `trickWinner`;
  - trick-column order; Recent form; Bela Blok rows from `finalScore` deltas with dedupe; the `useMatchHands` expected-hand retry; the return-path sanitiser.
- **Components:**
  - every `ui/` component (press, disabled, loading name, `Sheet` focus trap and Escape, `Segmented`, `Input` stable id);
  - TabBar and Sidebar (incl. the landscape rule);
  - lobby seats and table (names, geometry, host actions);
  - quick-look;
  - Match History rows and details sections;
  - Settings;
  - **Board with view sequences:**
    - input never blocked during a hold;
    - one move in flight; pending clears on 2 s or confirm;
    - the bela prompt;
    - challenge in HAND_COMPLETE;
    - the deciding-hand window;
    - a snapshot snaps (no deal animation);
    - **all 6 hand cards present at the first BIDDING state**;
    - **each kept test id exactly once**;
    - `trump` absent while bidding and exactly "Herc" after;
    - `score-a` text exactly the number during a digit slide.
- **Guards:**
  - **no emoji** in shipped `src` (`\p{Extended_Pictographic}` minus an allow-list of © ® ™, like `brand.test.ts`);
  - no raw palette classes in `src/components`;
  - no `gsap` import;
  - the contrast pairs computed;
  - every `Sheet` labelled;
  - the fixture guard (no "Bearer" / `eyJ`).

### 7.3 Playwright checks (`e2e/visual.mjs`, the harness's Playwright install)
- **Reference platform:** macOS with Chromium headless (the owner's machine). Baselines under `e2e/visual/` are for that platform. The check is a local verification step, not a CI gate (system fonts differ by OS).
- **Visual:**
  - every route at **1440×900** and **375×812** (the game page through `/dev/board`), and the board at **812×375**;
  - against the dev server with a mocked API (route interception) and `/dev/board` fixtures;
  - **Effects Off**, after animations settle;
  - card art from local fixtures under `e2e/visual/fixtures/` (not shipped); the font is bundled;
  - fail on > 0.2 % pixel diff. The diff runs inside Chromium (both PNGs drawn on a canvas, pixels compared with `getImageData`), so no image library is added; the baseline folder carries the platform and the Chromium version (`<platform>-<arch>-chromium<version>`, files `<scene>@<W>x<H>.png`), and a mismatch fails with "re-record baselines";
  - shots run with animations skipped (on the dev server, `MotionGlobalConfig.skipAnimations` through a window flag the harness sets, dev builds only; Playwright's `animations: 'disabled'`) and a frozen clock.
- **No horizontal scroll** on every route at 375.
- **Hit-testing (closed sheets inert):** at 1440 and 375, with every sheet closed, `document.elementFromPoint` at the centres of the bid buttons and at each hand card's exposed strip returns those elements.
- **Reduced motion:** `reducedMotion: 'reduce'` → in a `/dev/board` replay, no card element's box changes between two frames in which it is visible (opacity > 0.01, its ancestors' included): a moved card fades out, jumps, fades in (150 ms in all); no felt layer sits at an opacity strictly between 0 and 1 (the felt switches instantly); the canvas carries `data-effects="off"` and draws nothing.
- **More contrast:** `prefers-contrast: more` → edges use `--edge-strong`. **Forced colours:** `forced-colors: active` → Button, Input, ListRow and Sheet have a border style other than `none`.
- **Focus:** Tab to a Button, Input, ListRow, lobby seat and hand card; each shows its ring: at least width + height extra `#fbf236` pixels (`#222034` on accent fills, §3.4) in the focused element's shot against the same box blurred.
- **Performance:**
  - run on a **production-mode build with `VITE_DEV_BOARD=1`**, served by `vite preview`;
  - replay one hand at Effects Full at the dev board's `speed=1` (a delivery every 400 ms) under CDP `Emulation.setCPUThrottlingRate(4)`;
  - rAF frame times **p95 ≤ 20 ms**.

### 7.4 The release gate on the rig
**The harness** (`e2e/gameplay.mjs`) is updated (and `LOGS/bots.mjs` to match):
- **Create:** "Create lobby" → the sheet's **"Create"** (scoped to the dialog) → `**/lobby/**`.
- **Guests:**
  - `/lobbies` → the row → quick-look **"Join lobby"** → `**/lobby/**`;
  - **guest 1 taps "Sit here, team A"; guests 2 and 3 tap the first "Sit here, team B"** (the host is in A);
  - each waits until a seat named "{username} (you), team A|B" exists and no seat is `aria-busy`.
- **Start:** the host's "Start match" (`/Start match/i`).
- **Hand cards:** click the point (10, 30) of the card's own face, turned with the card, inside the exposed strip (Playwright measures `position` from the bounding box, and a fanned card turns up to ±7.7°; on an unturned card this is `{x: 10, y: 30}`).
- **Match details:** `/matches` → the row for the game id (by `href` ending in the id) → `/matches/{id}` → read `final-a` / `final-b` (`Number(textContent)`).
- **Game selectors:** unchanged (§5.10).
- **Landscape check:** `E2E_LANDSCAPE_CHECK=1` (set in the mobile run): during hand 1, one tab resizes to 812×375, runs `assertFits` and one play, then restores 375×812.
- **The recorder** (§4.17) is opt-in (`E2E_RECORD_VIEWS=1`) and never on during the gate.
- **Retired:** `LOGS/landscape-menu.mjs` (no drawer) and the realistic step of `LOGS/ref-shots.mjs`.

**The runs:**
- the six runs (badinvite, full, xhr, renewal, restart, mobile) pass against the **combined release**;
- logs kept as in pre-deploy 8.7;
- **the rig is shared** with the pre-deploy session and the U-wave's 8.7 re-run: coordinate with the owner (login rate limits are per IP);
- **the owner play-test:** a whole game with three bots; sign-off recorded.

### 7.5 CI (R-43)
- **`ci.yml`:**
  - the production build gets `VITE_CARD_ART_BASE_URL` (a placeholder, like the API origin);
  - **after the build:**
    - a step that fails if `dist/` contains `/dev/board`;
    - a **bundle-size check** (O-5): the entry chunk and its static imports ≤ the `fca13bb` baseline (194,266 B gzip) + 35 KB, the on-demand game chunk ≤ 45 KB gzip, the font ≤ 30 KB, with the baseline recorded in the plan.
- **The rig build command** also sets `VITE_CARD_ART_BASE_URL`.

### 7.6 What can't be verified locally
- Real devices: iOS Safari `backdrop-filter`, and 60 fps on a real mid-range Android (the 4× throttle is a proxy).
- The R2 custom domain, until the owner's DNS step. CDN caching of card art and fonts in production.
- Real-world latency on mobile data (lift-then-fly feel).
- Real screen readers (live-region wording is checked in jsdom only).

---

## 8. Planning clarifications (session 2)

Where the text above was silent or could not be met literally, the plan settled it as below. Each phase's notes in `RUN/plan-draft/phase-NN.notes.md` give the reasoning; the items marked **(owner, N.S)** stand as written: the owner decided on 2026-10-10 that implementation asks no questions (E-1), and reviews every phase's screenshots at the end of the run, where an answer can still override this list.

- **Shell (§4.1, §4.15, §4.16):** X-11 links point to `/settings` (the Account section carries `id="account"`; the page doesn't scroll to it). The footer reads "© {year} Stiglja" ("All rights reserved." goes). "‹ Stiglja" is the pixel back icon + "Stiglja". Not found keeps "The page you're looking for doesn't exist." Page subtitles go. Document titles: Sign in, Sign up, Confirm email, Forgot password, Reset password, Privacy notice, Terms of use, Rules, Leaderboard, Game, Home, Ranked, Lobbies, Lobby, Match History, Match details, Profile, Friends, Settings, Admin, Page not found. Both shell banners use the `info` tone. Card art comes from local fixtures in the visual checks; the font is bundled.
- **Board (§5):** the hand-result and end sheets rise once the last trick has left the table, so they never cover cards on it. When the ended hand isn't stored yet, the live region says "Hand finished: Mi {a}, Vi {b}" and the sheet's title becomes "Hand n" once known. "Waiting for other players..." stays in the hidden summary while it isn't my turn. At 375 px the HUD wraps (Challenge on a second line) and the season word shows from 640 px. My name chip sits over my pile. On phones the bid panel stacks Pass over the four suits at 36 % of the felt. The particle cap is 52, ×1.6 for 1.6 s after a trump call. Canvas sprites use DB32 hex constants (a canvas can't read CSS tokens). The bela prompt's line is today's "Declare bela with {card}?". **(owner, 4.S)** at 1440 the board area is centred left of the Bela Blok column.
- **Lobbies (§4.6, §4.7):** the host's reason line: fewer than 4 members → "Waiting for {4 − members} more player(s)."; 4 members with someone unassigned → "{name} hasn't taken a seat yet."; else "Everyone is seated." "Joining…" when sitting down from Unassigned, "Switching…" when moving or standing up. A 404 on the first load or a poll shows "This lobby was closed." Your own seat never adds ", host". Strings: "1 lobby open" / "{n} lobbies open", "Couldn't load the lobbies", "No lobbies match your search.", the sheet copy of `proto/lobby.html` ("Your seat", "Leave this lobby?", "Stay", "Lobby options", …). Labels renamed: Lobby name, Private lobby, Create, Create lobby, Enter lobby, Join lobby, Lobby full, Try again, Back to lobbies, "Loading lobbies…". A failed clipboard copy shows the link in the toast. The mini table is a 60 %-high copy with legible names. The page keeps "Join lobby" on a full lobby (the server answers "Lobby is full"). The "Casual" chip reads "Ranked" for a ranked lobby. **(owner, 5.S)** the action bar is sticky at the bottom of the content column, not fixed (a fixed bar would cover the footer's links).
- **Auth (§4.2, §4.3):** see §4.1's return-path note; `console.error` lines stay.
- **Home and Ranked (§4.4, §4.5):** "Time in queue" counts from when this tab joined or saw the queue. Today's other queue-status blocks go. New strings: "Match declined" (the notice's region), "Couldn't load your recent matches.", the sections "Ranked" / "Lobbies" / "Recent matches", the stats "Elo" / "Games" / "Level". Section and sheet titles use `t-title` (§3.3). The Match Found heading is "Match found" (X-4; three provider tests change). **(owner, 7.S)** the Elo shows twice on Home; a quiet "Your search was cancelled" line is not shown.
- **Matches (§4.9):** "{n} matches" counts this page. Singulars ("1 match", "1 win", "(1 hand)"). After a draw, "won/lost the last {k}" is left out. Past the last page: "No more matches" with the pager. The details page's `h1` is the hero result ("WIN"; "Match details" while loading or failed); a failed load says "Couldn't load this match". The match summary needs only `result`; Hands/Tricks read "—" when the hands failed. The result parser returns nothing for unreadable text, so no fake "0 : 0" score shows. Thumbnails follow §3.6's crisp rule (47.33 px at DPR 3). Detail pages slide in from the right; the slide back out isn't animated in this release. **(owner, 8.S)** "Find a game" → `/dashboard`; suit chips read in capitals.
- **Profile, Friends, Leaderboard, Settings, Admin (§4.10–§4.14):** quoted strings are adopted; unquoted button names keep today's casing ("Add Friend", "Try Again", "Clear Search"). A 404 shows "Profile not found" (body "Profile information is not available."); other failures "Couldn't load this profile". Recent matches on profiles: "Loading matches...", "No matches yet", "Couldn't load the recent matches." "Email" is a caption label; "Username:" and "Roles:" go. New strings: the Table effects line and the reduced-motion note, "Signed in as {username}", "Open the Leaderboard", "{n} games · Level {n}", the hidden search labels, "Remove {name}?" / "Remove {name}". The leaderboard's name links to the profile; on phones Pending/Accept/Decline are icon buttons (more, check, x). Kept: "{n} users found", Refresh with its 3-s lock, Friends' Refresh/"Updating...", Admin's search and its Username/Email sort. Admin's second header goes. `useAdmin` no longer reports a delete as failed when only its refetch fails. **(owner, 9.S)** the new strings above.
- **Guards, cleanup and checks (§2.4, §7.2, §7.3):** the game page and `/dev/board` load on demand behind the game page's own first frame ("Connecting to game..."). X-14's files go with a guard that keeps them gone; other unused code it doesn't name (old barrels, `friendshipService.getAllFriendships`/`getFriendshipById`, unused admin types, `useLobbies` while Admin uses it) stays, per the surgical rule. ESLint ends with `fca13bb`'s own findings only. The checks of §7.3 are worded above as they are measured; the hit check tests each hand card's exposed strip. The longest real names (20 characters) get their own scenes and check; side seats stop short of the board's middle and a long sheet title wraps. In More, the row of the page shown carries `aria-current="page"`. **(owner, 10.S)** the baselines; whether the lobby fixtures give dates (the quick-look's "Created … ago").

---

## User Stories

**Roles:** visitor (signed out), unverified player, verified player, lobby host, lobby guest, ranked player, admin. Entry-point stories come first.

- **US-1:** As a visitor, I open any Stiglja link and land on a sign-in panel with the wordmark and the cards, so that I know where I am and can sign in or sign up.
- **US-2:** As a visitor following a lobby invite link, I sign in and land back on that lobby, so that the invite still works.
- **US-3:** As a verified player, after signing in I see Home with "Play ranked", "Lobbies" and my last three matches, so that I can start playing in one tap.
- **US-4:** As a player on a phone, I move between Play, Lobbies, Matches and Profile with a bottom tab bar, and reach Ranked, Friends, Leaderboard, Settings and Rules under More, so that every page is at most two taps away.
- **US-5:** As a player on a desktop, I use a slim sidebar with every destination, so that navigation never hides content.
- **US-6:** As a player with a game in progress, I see "Return to your game" on Home and as a banner on other pages, Rules included, so that I can get back to my seat.
- **US-7:** As an admin, I see the Admin item in the navigation (others don't), so that I can reach the admin page.
- **US-8:** As a lobby guest, I open Lobbies, tap a lobby, see its seats in a quick-look sheet, and press "Join lobby" (with the password if private), so that I land in the lobby.
- **US-9:** As a lobby guest who opened a lobby link directly, I see "Join lobby" on the lobby page, so that I'm never stuck without a way in.
- **US-10:** As a lobby host, I create a lobby from Lobbies or Home and land in it, so that I can share the invite link and wait at my table.
- **US-11:** As a visitor, I enter a wrong invite code at sign-up and am told "Invalid invite code" on that field, so that I know what to fix.
- **US-12:** As a lobby guest, I enter a wrong private-lobby password, or try a full lobby, and see the server's reason, so that I know why I'm not in.
- **US-13:** As a lobby guest, I tap an open seat to sit, and tap my seat to stand up or leave, so that picking a team feels like sitting down.
- **US-14:** As a lobby host, I see why I can't start yet ("Waiting for 1 more player") and start once all four seats are taken, so that I know what's missing.
- **US-15:** As a lobby host, I remove a seated or not-seated player, or close the lobby, through a confirmation sheet, so that I can manage my table without browser pop-ups.
- **US-16:** As a lobby guest, when the host starts I'm taken into the game within about 2 s, and Back doesn't drop me into the lobby again.
- **US-17:** As a lobby guest who was removed, or whose lobby was closed, I see that plainly with "Back to lobbies", so that I'm not left on a dead page.
- **US-18:** As an unverified player, I see a banner asking me to confirm my e-mail, with a resend button and a link to Settings, so that I can unlock ranked play.
- **US-19:** As an unverified player who presses "Find Match", I'm told what to do and offered a new confirmation link, so that I'm not stuck.
- **US-20:** As a ranked player, I press "Find Match", see players in queue, the estimated wait ("Calculating..." when unknown) and my time in queue, and can leave, so that I know what's happening.
- **US-21:** As a ranked player, a found match opens a full-screen "Match found" sheet on any page, with both teams, a 15-s countdown, Accept and Decline, so that I can't miss it.
- **US-22:** As a ranked player who declines too late, I see "This match can no longer be declined" and the sheet stays. After a timely decline, I'm told when I can queue again.
- **US-23:** As a ranked player whose found match someone else declined, I'm back on Ranked with "A player declined — you're back in the queue".
- **US-24:** As a player at the table, I see my hand fanned at the bottom, sorted by suit (groups fixed for the hand, trump on the right, weakest to strongest), so that cards never jump around.
- **US-25:** As a player at the table, on my turn I tap a card; it lifts at once and flies to the table when the server accepts it, and a second quick tap never plays another card.
- **US-26:** As a player at the table, I see opponents' cards flip in from their seats, the trick's winner crowned, and the trick swept to the winning team's pile.
- **US-27:** As a player at the table, the next lead is never delayed by the trick animation, so that the game never feels slower than the server.
- **US-28:** As a player bidding, I see Pass and the four suits. Hovering a suit rings my cards of that suit. As the dealer I must call when the others have passed.
- **US-29:** As a player at the table, when trump is called the felt turns into that suit's season with a burst of seasonal particles, so that the trump is felt, not just read.
- **US-30:** As a player who plays trump K or Q holding the other, I'm asked "Play" or "Play + Bela".
- **US-31:** As a player at the table, I see whose turn it is with a countdown, my team, the phase in words, the dealer and the declarations.
- **US-32:** As a player at the table, I tap my team's pile to look at the tricks my team won this hand, while the opponents' pile stays closed.
- **US-33:** As a player at the table, after each hand a sheet shows the hand's points (padanje or capot included), the 10-s window and Challenge, on the deciding hand too.
- **US-34:** As a player who challenges, I see "No foul found" or "Challenge upheld: Team X takes the hand", so that I know the result; when another player's challenge fails, I see "{name} challenged: no foul found".
- **US-35:** As a player at the table, I open the Bela Blok (always visible on desktop) to see every hand's points and the running total.
- **US-36:** As a player who leaves the table from the game menu, I'm told my seat stays and how absence is handled, and I can return from the banner.
- **US-37:** As a player whose connection drops, I see "Reconnecting…" with Retry, my moves say "Not sent — reconnecting", and after reconnecting the table snaps to the current state without replaying.
- **US-38:** As a player at the end of a game, I see the winner or why it ended, and the final score, then "Play again" with the votes (or "Back to lobbies"), and a link to the match details.
- **US-39:** As a player when the rematch fails, I see "{name} left — no rematch" or "Rematch expired", and Play again is disabled.
- **US-40:** As a player who opens someone else's game, or an ended one, I see "This game isn't yours or has ended" with "Back to dashboard", not an endless spinner.
- **US-41:** As a player whose page crashes, I see "Something went wrong" with Reload and Go to dashboard, not a blank page.
- **US-42:** As a player whose session ended on the server, I land on sign-in with "Your session ended — please sign in again".
- **US-43:** As a player holding my phone sideways, the table rearranges so that every card and control fits.
- **US-44:** As a player who prefers reduced motion, cards fade instead of flying and particles stop, but the felt still shows the trump's season.
- **US-45:** As a player on a slower phone, I set Table effects to Calm or Off in Settings.
- **US-46:** As a player, I open Matches and see one list with each match's result, final score and date, and a Recent form strip.
- **US-47:** As a player, I open a match on its own page with its teams, duration, hands, and a trick-by-trick replay in fixed player columns with team colours, play order, the winner's crown and played trumps marked.
- **US-48:** As a player, I open another player's profile to see their Elo, games, level and recent matches, and add them as a friend.
- **US-49:** As a player, I manage friends, requests and sent requests, with each row's actions independent.
- **US-50:** As a player, I open the Leaderboard and see players ranked by Elo (accounts that never played listed after them as "Unranked"), with my own row highlighted. As a visitor, I'm asked to sign in to see it.
- **US-51:** As a player, I manage my e-mail, password and account deletion in Settings, with the same careful wording as before.
- **US-52:** As a visitor, I read the Rules, Privacy and Terms pages without signing in.
- **US-53:** As an admin, I see real statistics (users, matches, open lobbies, pending deletions), manage users, and get a clear error if a delete fails.
- **US-54:** As a player who opens a page that doesn't exist, I get "Page not found" with a way home.
- **US-55:** As a player, I never see emoji or mismatched colours; every icon is pixel art from the cards' palette.
