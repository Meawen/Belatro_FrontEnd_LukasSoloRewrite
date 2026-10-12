# Ranks, rating charts and a visual Rules page: design

**Status:** final. The owner answered every question on 2026-10-11 (the primer,
`/Users/lmiholic/IdeaProjects/Belatro/.superpowers/sdd/2026-10-11-ranks-ui/primer.md`) and asked for the Rules page
to become visual the same day. The owner does not review this spec: the primer's answers are the review.

**Base:** branch `ranks-ui` from `ui-redesign` @ `6a36464` (FE#3 still open). Worktree
`/Users/lmiholic/IdeaProjects/stiglja-lanes/ranks-frontend`.

**Authorities, in order:** the owner's words (the primer and the Rules ask); the backend spec
`stiglja/docs/superpowers/specs/2026-10-10-team-elo-rating-design.md` on `pre-deploy` @ `7498dfe` (every number);
the redesign spec `docs/superpowers/specs/2026-10-09-ui-redesign-design.md` (§3 design system, §4 screens); the
apple-design and dataviz skills (method).

**Run folder** (`RUN/`): `/Users/lmiholic/IdeaProjects/Belatro/.superpowers/sdd/2026-10-11-ranks-ui/`, ledger
`progress.md`.

---

## 1. Goal and definition of done

**Goal.** The backend rates ranked games with team Elo and sends a rank for every player plus the data for two
charts; the SPA shows none of it. After this change:

1. a player's **rank** (Cucek → Kajkavac) shows wherever their Elo does;
2. the **Leaderboard** opens with **the ladder**: everyone placed, by rating, coloured by rank, with you marked;
3. your own **Profile** shows **your climb**: your rating over your ranked games and an "at this pace" forecast;
4. the **Rules page** says what the new rating does (three sentences were false) and gains a **Ranks** section;
5. the Rules page **opens with a short visual guide** built from the real cards, two parts of it interactive,
   and keeps the complete rules one tap away.

**Done means:**

1. Every acceptance criterion in §5–§9 has a test that fails without the change.
2. `npx tsc -b`, `npx vitest run` (the baseline 144 files / 970 tests plus the new ones, all green) and
   `npx eslint .` with no new findings.
3. `node e2e/visual.mjs`: `--update` only for the scenes this change adds or changes; then `--compare` twice
   identical and `--check all` passing. Every changed shot looked at, at 375 and 1440.
4. The SPA works against **both** backends (§4): the existing scenes, whose fixtures carry no rank and answer no
   chart route, still match their baselines.
5. The bundle check of `ci.yml` passes (§10).
6. What was not verified is written down (§11.4).

## 2. Decisions (owner, 2026-10-11; final) and their consequences

| # | Decision | Consequence here |
| --- | --- | --- |
| D-1 | The ladder goes on the Leaderboard, in a panel above the list | `LadderPanel` between the page title and `UserList` (§7) |
| D-2 | Your climb goes on your own Profile, between the header and Recent matches; other profiles get no chart | `ClimbPanel` only when `isOwnProfile` (§8) |
| D-3 | The forecast is recent form plus a luck band: `rating + pace·m`, band `± step·√m`, m = 1…20, with the case texts | §8.4 copies the texts verbatim |
| D-4 | The rank shows in the Profile header (chip, tagline, progress bar), on Leaderboard and friend rows (tag beside the Elo), on Home's stats strip and the Ranked page (beside your Elo), and under your username in the labelled sidebar | §6 |
| D-5 | The look is a coloured chip: one hue family, lightness rising with rank, Cucek neutral; `--rank-*` tokens; rows use `Tag`, the header `Chip`; the chart bands use the same tokens; validated with the dataviz validator against `--surface` in dark mode; text stays in text tokens unless the pair passes contrast | §3 |
| D-6 | The Rules text: 400 → 1600; the new rating sentence; the absence sentence; a new Ranks section; every other word kept | §9.2 verbatim |
| D-7 | Not in scope: ranks in the lobby, Match found or the board; the leaderboard's sort and its "Unranked" tag; charts for other players; any backend change | A backend gap becomes a follow-up (§11.3) |
| D-8 | Tolerance: `rank` and `rankedGamesPlayed` optional; a 404 from a chart route hides its panel; any other failure shows one quiet line with Try again | §4 |
| D-9 | Charts are inline SVG React components; no chart library; no new dependency | §7, §8 |
| D-10 | (Rules ask, 2026-10-11) "much more interactive with pics using the card design … smaller and easier to understand … the detailed stuff somewhere if someone really needs it … little text, visual" | §9.1: a visual guide first; the full rules (D-6's text) behind a disclosure, linked from every step |

**Rulings made writing this spec** (also in the ledger):

- **R-1, D-6 vs D-10.** "Keep every other word" and "smaller, visual" both hold: the full rules keep every word
  (with D-6's edits) inside a disclosure; the new short guide sits above them. The guide's sentences are new text and
  say nothing the full rules don't.
- **R-2, the hooks.** The primer says "React Query hooks … in the style of `useUser.ts`", but `useUser.ts` is built on
  the app's own `useApi` and no hook in `src/` uses React Query. The hooks follow `useUser.ts` (`useApi`, its
  `staleTime` rule) and add a refetch on `visibilitychange` that respects `staleTime`.
- **R-3, the next rank's name.** `RankDto` carries `nextMinRating` but not the next rank's name, which "{gap} to
  {next}" and the forecast need, and the name must never be derived from a key. It comes from the ladder's `ranks`
  (the entry whose `minRating` equals `nextMinRating`); without the ladder the text says "the next rank". Backend
  follow-up F-1 (§11.3).
- **R-4, the chip tone.** `Chip`/`Tag` gain a `rank` tone with a `rank` key prop, the way `trump` takes `suit`
  (variants are props, §3.7 of the redesign spec), instead of class overrides.
- **R-5, the ramp's hue.** Violet (OKLCH h 300) is the one hue family the app doesn't already use: teal surfaces,
  Team A cyan, Team B rose, the accent yellow ("you", actions), success green, danger red and the four suits
  (§3.1).
- **R-6, square data-ends.** The dataviz skill rounds bar ends by 4 px; the design system has no `border-radius`
  (§3.4 of the redesign spec), so bars and bands are square-ended, pixel-crisp.
- **R-7, the old fixtures stay.** `e2e/visual/fixtures/api/player.json` stays as the old backend answers (no rank),
  so every existing scene doubles as the old-backend check; new scenes use new fixtures.
- **R-8, breakpoints in the charts.** The climb chart's bands need every rank's start, which only the ladder carries;
  the Profile reads the ladder too. Without it, the climb draws only the bands it can know (your rank's start and
  the next one's).

## 3. Rank tokens (D-5)

### 3.1 The ramp

Six placed ranks on one OKLCH hue (300, violet), lightness rising with rank, the most chroma sRGB allows (≤ 0.17).
Cucek is neutral (`--surface-2` with `--text-2`, today's `neutral` tone).

| Token | Rank | OKLCH L | Hex | Chip text | Text contrast | vs `--surface` |
| --- | --- | --- | --- | --- | --- | --- |
| `--rank-decec` | Dečec | 0.52 | `#7a4aba` | `--text` | 5.23 | 2.56 |
| `--rank-fakin` | Fakin | 0.66 | `#a376e9` | `--ink` | 4.78 | 4.60 |
| `--rank-pajdas` | Pajdaš | 0.725 | `#b78aff` | `--ink` | 6.11 | 5.89 |
| `--rank-gospon` | Gospon | 0.79 | `#c7a8fe` | `--ink` | 7.90 | 7.61 |
| `--rank-majster` | Majster | 0.855 | `#d7c3ff` | `--ink` | 9.92 | 9.56 |
| `--rank-kajkavac` | Kajkavac | 0.92 | `#e9dffe` | `--ink` | 12.42 | 11.97 |

**Validation (run, not eyeballed):**
`node <dataviz>/scripts/validate_palette.js "#7a4aba,#a376e9,#b78aff,#c7a8fe,#d7c3ff,#e9dffe" --ordinal --mode dark --surface "#11292a"`
→ lightness monotone PASS, adjacent ΔL ≥ 0.06 PASS, light-end contrast 2.56:1 PASS, single hue (spread 0°) PASS.
The gap between Dečec and Fakin (0.14) is deliberate: between L 0.53 and 0.65 neither `--ink` nor `--text` reaches
4.5:1 on the fill, so no step sits there.

### 3.2 Where they live and what checks them

- `src/index.css` `:root`, after the suits; exposed in `@theme inline` as `--color-rank-*` (so `bg-rank-pajdas` works).
- `src/test/tokens.test.ts`: the six values; `--text` on `--rank-decec` and `--ink` on the other five ≥ 4.5:1;
  every rank token ≥ 2:1 on `--surface` (the ordinal floor); lightness rising (the luminance of each step above the
  last).
- In SVG, marks take `style={{ fill: 'var(--rank-…)' }}`; bands the same at `fill-opacity: 0.12`.
- `forced-colors: active`: chips get the system border like every control (§3.4 of the redesign spec); chart marks
  keep their shape, and the hidden table (§7.6, §8.6) carries every number.

## 4. Contract and tolerance

### 4.1 What the SPA reads (exact; producer `Meawen/stiglja` `pre-deploy` @ `7498dfe`)

```ts
// src/types/user.ts
export type RankKey = 'CUCEK' | 'DECEC' | 'FAKIN' | 'PAJDAS' | 'GOSPON' | 'MAJSTER' | 'KAJKAVAC';
export interface PlayerRank {
    key: RankKey;
    name: string;                  // print this; never derive it from key
    tagline: string;
    minRating: number | null;      // null for Cucek and Dečec
    nextMinRating: number | null;  // null for Cucek and Kajkavac
}
export interface User {            // GET /user/{id}, /user/findAll rows, FriendshipDto parties
    id: string | null; username: string | null; eloRating: number | null; level: number | null; gamesPlayed: number | null;
    rankedGamesPlayed?: number;    // optional: an old backend doesn't send it
    rank?: PlayerRank | null;      // optional: an old backend doesn't send it
}
export interface Ladder {          // GET /user/ladder
    players: number; binSize: number;
    bins: { from: number; count: number }[];                                       // non-empty, lowest first
    ranks: { key: RankKey; name: string; minRating: number | null; count: number }[]; // all seven, in rank order
}
export interface RatingHistory {   // GET /user/{id}/rating-history
    rating: number; rankedGamesPlayed: number; startRating: number | null;
    points: { game: number; rating: number }[];  // the last ≤ 100 ranked games, oldest first
    step: number; pace: number | null; paceGames: number;
}
```

`PlayerRank`, not `Rank`: `Rank` is the card rank in `src/types/game.ts`. `GET /user/me` doesn't carry the rank; every
surface reads `useUser(user.id)`.

### 4.2 Tolerance (D-8)

| Situation | What shows |
| --- | --- |
| `rank` absent or null | No chip, no tagline, no progress bar: today's layout exactly |
| `GET /user/ladder` answers 404 | The ladder panel is not rendered at all; the Profile's climb uses R-8's fallback |
| `GET /user/{id}/rating-history` answers 404 | The climb panel is not rendered at all |
| Any other failure of a chart route (5xx, network, 401 after renewal) | One quiet line in the panel, "Couldn't load the ladder." / "Couldn't load your climb.", and a secondary small "Try again" button that refetches |

### 4.3 Data hooks (`src/hooks/useRatings.ts`)

- `userService.getLadder()` → `GET /user/ladder`; `userService.getRatingHistory(id)` → `GET /user/{id}/rating-history`.
- `useLadder(enabled = true)` and `useRatingHistory(id?: string)`, built like `useUser` on `useApi`, `staleTime`
  60 000 ms each.
- Both re-run `execute()` (not forced, so `staleTime` decides) when `document.visibilityState` turns `visible`, which
  is the window regaining focus after a game in another tab. A fresh mount (back from the game page) fetches anyway.

## 5. The rank chip (D-4, D-5)

`src/components/rank/RankChip.tsx`:

```ts
export function RankChip(props: { rank: PlayerRank | null | undefined; size?: 'tag' | 'chip'; className?: string }): JSX.Element | null
```

- `null`/`undefined` rank → renders nothing.
- `size="tag"` (default) renders `Tag tone="rank"`; `size="chip"` renders `Chip tone="rank"`. Content: `rank.name`.
  `title` = `"{name}: {tagline}"`.
- Colours: Cucek `bg-surface-2 text-text-2`; Dečec `bg-rank-decec text-text`; the rest `bg-rank-<key> text-ink`.
- `data-rank={key}` for tests and the visual checks.

**ACs:**
- R5.1 a `PAJDAS` rank renders a 20-px tag "Pajdaš" with `bg-rank-pajdas text-ink`; `size="chip"` renders the 28-px chip.
- R5.2 a `CUCEK` rank uses the neutral tone; `DECEC` uses `text-text`.
- R5.3 `rank={undefined}` and `rank={null}` render nothing.
- R5.4 the name printed is `rank.name` as sent (a rank `{key:'GOSPON', name:'Test name'}` prints "Test name").

## 6. Where the rank shows (D-4)

### 6.1 Profile header (own and other profiles)

Under the `h1` name, before the roles / friend actions: a `RankBlock`:

- the `RankChip size="chip"` and the tagline in `t-footnote text-text-2`;
- **progress**, by case:
  - both `minRating` and `nextMinRating` present → a 4-px bar (track `--surface-2`, fill the rank's own token,
    `transform: scaleX(f)` from the left, `f = clamp((elo − min) / (next − min), 0, 1)`), its width 100 % of the block
    up to 240 px, then "{gap} to {next}" in `t-footnote text-text-2 tabular-nums`, `gap = nextMinRating − eloRating`,
    `{next}` per R-3; the bar has `role="progressbar"`, `aria-valuemin={min}`, `aria-valuemax={next}`,
    `aria-valuenow={elo}`, `aria-label="Progress to {next}"`;
  - Dečec (`minRating` null, next present) → no bar, the text "{gap} to {next}" only;
  - Kajkavac (`nextMinRating` null) → no bar, "Top rank";
  - Cucek → "Placement: {k} of 10 ranked games", `k = rankedGamesPlayed ?? 0`.
- The fill grows from 0 on mount with `spring.ui` (transform only); under reduced motion it renders at `f`.

**ACs:**
- R6.1.1 Pajdaš at 1290 (min 1200, next 1400, ladder present) → chip, "Dober pajdaš.", a progressbar 1200/1400/1290,
  "110 to Gospon".
- R6.1.2 without the ladder → "110 to the next rank".
- R6.1.3 Dečec at 940 → "60 to Fakin", no progressbar. Kajkavac → "Top rank", no progressbar. Cucek with 3 ranked
  games → "Placement: 3 of 10 ranked games", no progressbar.
- R6.1.4 no `rank` → none of it; the header is today's.

### 6.2 Leaderboard rows (`UserList`)

- In `trailing`, before the Elo column: `RankChip` (tag), only when the row is ranked (`gamesPlayed > 0`) and `rank`
  is present. Rows with no game keep "Unranked" and get no rank tag. On compact rows (< 768 px) the tag shows too.
- **ACs:** R6.2.1 a ranked row with `rank` shows its tag beside the Elo; R6.2.2 an Unranked row shows "Unranked" and
  no rank tag; R6.2.3 a row without `rank` is today's row.

### 6.3 Friend rows (`FriendList`)

- The meta line becomes a wrapping flex row: "Elo {n}", the rank tag, "· Level {n}". Same rule: no tag without `rank`.
- **AC:** R6.3.1 a friend with `rank` shows the tag between the Elo and the level; without, the line reads as today.

### 6.4 Home stats strip and the Ranked page

- Home: inside the Elo tile, under the number, the rank tag (`data-testid="dashboard-elo"` stays on the number).
- Ranked (`PlayPage`): beside "Elo {n}" on the felt panel, the rank tag.
- **ACs:** R6.4.1 Home with a Majster profile shows the "Majster" tag in the Elo tile and `dashboard-elo` still reads
  the number; R6.4.2 Ranked shows the tag beside the Elo; R6.4.3 without `rank`, both are today's.

### 6.5 The sidebar's user block

- `Sidebar` reads `useUser(user.id)`; in the labelled form (≥ 1024 px) the rank tag sits under the username. The
  72-px icon-only form shows nothing new. The phone shell has no user block (the More sheet shows none) and gains
  none.
- **ACs:** R6.5.1 labelled sidebar with a ranked profile → the tag under the name; R6.5.2 compact sidebar → no tag;
  R6.5.3 no `rank` → today's block.

## 7. The ladder (D-1; `src/components/rank/LadderPanel.tsx`, `LadderChart.tsx`)

### 7.1 Placement and frame

On `/users` signed in, a `Panel` (padding `md`) above `UserList`, inside the page: `h2` "The ladder" (`t-title`) and,
beside it, "{players} ranked players" (`t-footnote text-text-2`, "1 ranked player" for one). The signed-out prompt is
unchanged and asks nothing.

### 7.2 States

| State | Panel content |
| --- | --- |
| Loading (no data yet) | `Loader layout="inline"` "Loading the ladder…" |
| 404 | Nothing: the panel is not rendered |
| Other error | "Couldn't load the ladder." + Try again |
| `players < 5` | "The ladder fills in as players finish their first 10 ranked games." (no chart, no legend) |
| Otherwise | The chart, the "you" line, the legend |
| Refetch with data on screen | The chart stays, at opacity 0.6, until the new data lands (no skeleton) |

### 7.3 Geometry

The chart measures its container (`ResizeObserver`; 640 px when unavailable, as in jsdom) and draws in CSS px.

| | ≥ 768 px wide container | < 768 px |
| --- | --- | --- |
| Plot height | 110 | 96 |
| Top band (the "You" tag) | 26 | 26 |
| Bottom band (x ticks) | 20 | 20 |
| Left gutter (count ticks) | 28 | 28 |
| Right gutter | 4 | 4 |

At 1440 × 900 the panel is 880 px wide (848 inner); at 375 × 812 it is 343 (311 inner). No horizontal scroll.
Owner, 2026-10-11 (after the rig look): a tighter ladder, so the plot is 110 / 96 px (was 150 / 120) and the bars
touch (below).

- **x:** shown rating. Domain `[lo, hi)`: `lo` = the lowest bin's `from` (or your bin's, if lower), `hi` = the highest
  bin's `from + binSize` (or your bin's end, if higher). One slot per `binSize` from `lo`; empty slots stay empty.
- **Bars:** one per non-empty bin, width `slot − 2` (each bar fills its slot, 2 px from the next; owner 2026-10-11,
  was `min(24, slot − 2)`), centred in its slot, square ends (R-6), height
  `count / yMax × plotHeight` from one baseline, fill = the bin's rank token. The bin's rank is the last of the six
  placed ranks whose `minRating` is null or ≤ `from`.
- **y:** `yMax` = the largest count rounded up to a clean number (1, 2, 5 × 10ⁿ). Two hairline gridlines (`--edge`,
  1 px, solid) at `yMax/2` and `yMax`, labelled at the left in `t-caption text-text-3 tabular-nums`; the baseline is a
  1-px `--edge` line.
- **Rank bands:** behind the bars, each placed rank's span within the domain filled with its token at 0.12 opacity;
  the rank's name at the band's top-left in `t-caption text-text-2` when the band is at least the name's width + 8 px.
- **x ticks:** at every placed rank's `minRating` inside the domain, `t-caption text-text-3 tabular-nums`, centred on
  the boundary, dropped when closer than 36 px to the previous one.
- **You:** shown only when your profile is placed (`rank` present and not Cucek). A 2-px `--accent` line at
  `x(eloRating)` from the top band to the baseline, and a `Tag tone="you"` "You" centred on it in the top band,
  clamped inside the plot. Under the chart: "Ahead of {p}% of ranked players", `p = round(100 × (players in lower
  bins + ½ × your bin's count) / players)`.
- As Cucek: no marker; under the chart "Play {10 − k} more ranked games to join the ladder." (`k` your ranked games;
  "1 more ranked game" when one is left).

### 7.4 Legend

Under the "you" line: the six placed ranks as `RankChip` tags in rank order, each followed by its count
(`t-footnote tabular-nums`) and, on a second line, its Croatian tagline (`t-footnote text-text-2`; owner 2026-10-11,
option A of the tagline mock-ups). Two to a row, three from a 28 rem panel, six from 42 rem (container queries on the
panel). `LadderDto` sends no taglines, so they come from the Rules data (`rulesData.ts`, `rankTagline`); a rank the
SPA does not know shows its tag and count only (§11.3 F-4). Then "{n} players still placing" (`t-footnote text-text-2`;
"1 player still placing"; omitted when 0).

### 7.5 Hover, tap and keyboard

- Each slot (its full width × the plot height) is the hit area for its bar. Pointer move or tap sets it active: the
  bar lifts (fill opacity 1 → the others 0.55) and a tooltip above it shows "{from}–{from + binSize − 1}" (secondary)
  and "{count} players" (strong, "1 player").
- The chart wrapper is one tab stop (`tabIndex=0`, `role="group"`, `aria-label="The ladder: players by rating"`);
  ←/→ move the active bar across non-empty bins, Home/End jump, Escape clears; focus shows the same tooltip.
- The tooltip's text is mirrored in a polite live region. No tooltip animation (opacity only, `spring.quick`; none
  under reduced motion).

### 7.6 Accessible table

A visually hidden `<table>` (`sr-only`) with a caption "Players by rating", rows "{from}–{to}" / "{count}", and a second
one "Players by rank" with the seven ranks and counts. The SVG is `aria-hidden`.

### 7.7 ACs

- L-1 With 412 players, bins 900…1700 and you at 1290 (Pajdaš, bin 1200 of 40, lower bins 180): bars for each bin,
  "Ahead of 49% of ranked players" (`(180 + 20) / 412`), the "You" tag, the legend with six counts and "37 players
  still placing".
- L-2 As Cucek with 3 ranked games: no "You" tag, "Play 7 more ranked games to join the ladder."
- L-3 `players` 4 → the empty sentence, no chart.
- L-4 A 404 → no panel, no heading "The ladder"; a 500 → "Couldn't load the ladder." and Try again refetches.
- L-5 Each bar's colour is its rank's token (a bin from 1400 is `--rank-gospon` when Gospon starts at 1400 in
  `ranks`; moving Gospon's `minRating` to 1500 in the fixture recolours it `--rank-pajdas`): no breakpoint is
  hard-coded.
- L-6 ArrowRight from focus activates the first bin's tooltip "900–999" and its count; Escape clears it.
- L-7 The hidden table lists every bin and every rank.
- L-8 At 375 the chart fits without horizontal scroll; at 1440 it spans the panel.

## 8. Your climb (D-2, D-3; `src/components/rank/ClimbPanel.tsx`, `ClimbChart.tsx`)

### 8.1 Placement

Own Profile only, a `section` between the header and Recent matches: `h2` "Your climb" (`t-title`) and a `Panel`.

### 8.2 States

| State | Content |
| --- | --- |
| Loading | `Loader layout="inline"` "Loading your climb…" |
| 404 | Nothing: the section is not rendered |
| Other error | "Couldn't load your climb." + Try again |
| `points` empty | "Your climb starts with your first ranked game." |
| Otherwise | The chart and the texts of §8.4 |

### 8.3 Geometry

| | ≥ 768 px container | < 768 px |
| --- | --- | --- |
| Plot height | 180 | 150 |
| Top pad | 10 | 10 |
| Bottom band (x labels) | 20 | 20 |
| Left gutter (y ticks) | 36 | 36 |
| Right gutter | 8 | 8 |

- **x:** ranked game number. Domain from `g0 = points[0].game − 1` to `gN = last.game + 20` when a forecast is drawn,
  else `last.game`; at least 1 wide.
- **y:** rating. Domain = the min and max over `startRating`, every point, the forecast band's ends when drawn, and
  the next rank's start when there is one; padded by 20 each side; then widened to multiples of 50.
- **Bands:** each placed rank's rating span within the domain, its token at 0.12 opacity (R-8: from the ladder's
  `ranks`; without it only your rank's `[minRating, nextMinRating)`), its name inside the plot at the right edge in
  `t-caption text-text-2` when the band is ≥ 16 px tall.
- **y ticks:** at the rank starts inside the domain (`t-caption text-text-3 tabular-nums`), dropped when closer than
  14 px to the previous; with none inside, the domain's two ends.
- **History:** a 2-px `--accent` polyline (round joins) from (`g0`, `startRating`) through every point. A dot
  (r 4, `--accent`, 2-px `--surface` ring) at the current point. When there are 10 points or fewer, every point gets
  a dot.
- **Forecast** (pace not null): a dashed (4 3) 2-px `--accent` line at 0.7 opacity from (last.game, rating) to
  (last.game + 20, rating + 20·pace), over a band polygon `rating + pace·m ± step·√m`, m = 0…20, in `--accent` at
  0.12 opacity.
- **Next rank's start:** a 1-px hairline in the next rank's token across the plot at `nextMinRating`.
- **x labels:** "Game {g0 + 1}" at the left, "Game {last.game}" under the current point, "+20" at the forecast's end
  (`t-caption text-text-3 tabular-nums`), dropped when they would overlap.

### 8.4 Texts under the chart (D-3, verbatim patterns)

Let `next` = the next rank's name (R-3), `gap = nextMinRating − rating`.

| Case | Line 1 (`t-callout`, the rank name in `font-semibold`) |
| --- | --- |
| Cucek (pace null) | "Placement: {k} of 10 ranked games" — points drawn, no forecast line, no band |
| Kajkavac | "Kajkavac: the top rank." — the forecast line and band still drawn, no target text |
| pace > 0, next exists, n ≤ 100 | "At this pace: **{next}** in about {n} games", n = ⌈gap / pace⌉ ("1 game" for one) |
| pace > 0, next exists, n > 100 | "{next} is more than 100 games away at this pace." |
| pace ≤ 0, next exists | "{gap} points to **{next}**: about {⌈gap / step⌉} more wins than losses." ("1 more win than losses" for one) |

Line 2, whenever a forecast is drawn (`t-footnote text-text-2`): "Luck alone can move you about ±{round(step·√20)}
points over 20 games."

The texts never promise a rank and never shame a drop: no "dropped", "lost" or red.

### 8.5 Hover, tap and keyboard

- A crosshair (1-px `--text-3`) snaps to the nearest whole game across the domain. Over history: "Game {g}" and
  "{rating}" (strong). Over the forecast: "In {m} games" and "about {round(rating + pace·m)} ± {round(step·√m)}".
- One tab stop (`role="group"`, `aria-label="Your climb: rating over your ranked games"`); ←/→ step a game,
  Home/End jump, Escape clears. A polite live region mirrors the tooltip.

### 8.6 Accessible table

`sr-only` table, caption "Your rating after each ranked game", rows "Game {g}" / "{rating}"; the texts of §8.4 are
real text. The SVG is `aria-hidden`.

### 8.7 ACs

- C-1 57 games, rating 1452, pace 4.2, step 31, Gospon (next Majster at 1600): "At this pace: Majster in about 36
  games", "Luck alone can move you about ±139 points over 20 games.", a dashed line and a band.
- C-2 pace 0.5 with 1452 → "Majster is more than 100 games away at this pace." (n = 296).
- C-3 pace −2, step 31, 1452 → "148 points to Majster: about 5 more wins than losses."
- C-4 Kajkavac → "Kajkavac: the top rank.", the dashed line drawn, no "At this pace".
- C-5 Cucek with 3 points, pace null → "Placement: 3 of 10 ranked games", three dots, no dashed line, no band, no luck
  line.
- C-6 no points → "Your climb starts with your first ranked game."
- C-7 a 404 → no "Your climb" heading; a 500 → "Couldn't load your climb." + Try again.
- C-8 another player's profile requests no rating history and shows no climb.
- C-9 the y-domain includes the next rank's start even when every point is far below it.
- C-10 ArrowLeft/Right move the tooltip one game; one step past the last game it shows "In 1 game" and the band's
  "about {r} ± {s}".
- C-11 at 375 the chart fits without horizontal scroll.

## 9. The Rules page (D-6, D-10)

### 9.1 The visual guide

`src/components/info/RulesPage.tsx`: signed in, the page sits in the shell with the sidebar (`AppShell` + `Page`
width "read", 680 px), like every other signed-in page; signed out, or with an expired stored token (whose requests
would 401 and sign the reader out of a page anyone may read, R-41), the `PublicPage` frame (680 px). Nothing renders
while the session is read (owner 2026-10-11; was the public frame for everyone). Either way the `h1` is "Rules". Under
the `h1`, the
existing first paragraph stays as the lead. Then `h2` "How to play" (`t-headline`) and eight steps, each a `Panel`
with an `h3` (`t-headline`), a visual, at most two short lines, and a "Full rule ›" link that opens the disclosure
(§9.2) and scrolls to that section (`#rules-<id>`). Cards are `PlayingCard` with an explicit `width`: 71 px (gap 8)
when the panel's inner width is at least 624 px (eight cards and seven gaps), else 35.5 px (gap 3), so eight fit in a
row in the 311-px inner width at 375 × 812. Both are whole art-pixel multiples at 2× (redesign §3.6).

| # | `h3` | Visual | Text |
| --- | --- | --- | --- |
| 1 | Two teams | A small felt square with four seat tags: "You" and "Partner" (`team-a`) opposite each other, two "Opponent" (`team-b`) | "Partners sit opposite. The first team to 1001 points wins." |
| 2 | 32 cards, two orders | **Interactive:** a `Segmented` "Other suits" / "Trump" ("Other suits" selected first) and the eight Herc cards in that order, highest first, each with its points under it. Switching flies every card to its new place (`m.div` animating `x`, `spring.ui`; a jump under reduced motion) | "In trump the Decko and the 9 jump to the top. The last trick is worth 10 more: 162 points a hand." |
| 3 | Name trump or pass | Six faces and two backs; two quiet chips "Call Herc" (trump) and "Pass" | "Six cards each. Name a trump or pass; if all pass, the dealer must name one. Then two more cards." |
| 4 | Follow suit | **Interactive:** "Herc is trump. Karo 9 was led." The led card, then your four cards (Kralj Karo, 7 Karo, Decko Herc, As Pik) as buttons; tapping one lifts it and shows its verdict in a polite live region | "Follow suit and beat the best card if you can. No card of that suit? Play a trump, higher if you can. Neither? Play anything." |
| 5 | Declarations and bela | Pik 7, 8, 9 with "20"; the four Deckos with "200"; Herc Kralj and Baba with "Bela 20" | "Counted for you when trump is named: 3 in a row 20, 4 in a row 50, 5 or more 100. Bela you declare with Play + Bela." |
| 6 | Win the hand | Tags "PADANJE" (warn) and "CAPOT +90" (win) | "The team that named trump must score more, or it falls and the other team takes the whole hand. All eight tricks: 90 more." |
| 7 | Challenge a foul | A Karo As with an "ILLEGAL" tag (bad) | "Illegal cards aren't blocked. Press Challenge during the hand or in the 10 seconds after: if the other team fouled, your team wins the hand." |
| 8 | Ranks | The seven rank chips in order (Cucek … Kajkavac) | "Everyone starts at 1200. After 10 placement games your rank follows your rating." |

Step 4's verdicts (fixed text; the example is documentation):

| Card | Verdict |
| --- | --- |
| Kralj Karo | "Yes: it follows suit and beats the 9." |
| 7 Karo | "Not this one: you can beat the 9 with your Kralj, so you must." |
| Decko Herc | "Not this one: you have Karo, so you must follow suit before you trump." |
| As Pik | "Not this one: you have Karo, so you must follow suit." |

Before a tap the region reads "Tap a card to see if you may play it." Each card is a `button` (44-px hit area or
more), `aria-pressed` on the chosen one, its name as its accessible name, as the app names cards ("Kralj Karo").

The ranks of step 8 come from a documentation constant in `RulesPage.tsx` (the primer's one exception to "never
hard-code a breakpoint"), the same data as §9.2's table.

**ACs:**
- G-1 The guide's `h2` "How to play" and its eight `h3`s render, signed out, with no API request.
- G-2 Switching "Other suits" → "Trump" changes the visible order to Decko, 9, As, 10, Kralj, Baba, 8, 7 with points
  20, 14, 11, 10, 4, 3, 0, 0; back to "Other suits": As, 10, Kralj, Baba, Decko, 9, 8, 7 with 11, 10, 4, 3, 2, 0, 0, 0.
- G-3 Tapping Kralj Karo shows "Yes: it follows suit and beats the 9."; tapping Decko Herc then shows its verdict and
  moves `aria-pressed`.
- G-4 Every step's "Full rule ›" opens the disclosure and its target section exists.
- G-5 No horizontal scroll at 375; the guide's cards show their text faces when the art fails (redesign §3.6).

### 9.2 The full rules

Under the guide, a native `<details id="full-rules">` (closed by default) whose `<summary>` holds an `h2` "Full rules"
(`t-headline`, so every `h2` on the page stays `t-headline`) and "Every rule, as the server enforces it." in
`t-footnote text-text-2`; the summary is a 44-px target with the chevron icon turning when open (no animation under
reduced motion). Inside, today's sections with `h3` headings
(each with an id: `rules-cards`, `rules-bidding`, `rules-playing`, `rules-declarations`, `rules-scoring`,
`rules-challenge`, `rules-modes`, `rules-ranks`, `rules-away`, `rules-decline`, `rules-again`), every word kept
except these edits (D-6):

1. Line 142, "up to 400 points between the highest and the lowest" → "up to 1600 points between the highest and the
   lowest".
2. Lines 143–144, "A win always raises your Elo rating and a loss always lowers it, by at least 1 point; how much
   depends on the other team's average rating, and new players' ratings move faster." → "Your rating moves with your
   team's result: a win raises it and a loss lowers it, by more when the other team was rated higher, by more for a
   bigger final score margin, and by more in your first ranked games. A very narrow win can leave the shown number
   unchanged."
3. Lines 159–160, "and ratings change as for any other result" → "the absent player's rating drops as for a 1001–0
   defeat, their partner's by half a normal loss, and the winners gain as for a normal win." The sentence reads:
   "In a ranked game the absent player's team loses, the absent player's rating drops as for a 1001–0 defeat, their
   partner's by half a normal loss, and the winners gain as for a normal win."
4. A new section **"Ranks"** right after "Casual and ranked games":

   | Rank | From | Tagline |
   | --- | --- | --- |
   | Cucek | fewer than 10 ranked games | Čeka pod stolom. |
   | Dečec | below 1000 | Bu se navčil. |
   | Fakin | 1000 | Fakin, al' zna nekaj. |
   | Pajdaš | 1200 | Dober pajdaš. |
   | Gospon | 1400 | Gospon se ne žuri. |
   | Majster | 1600 | Ne zgubi ni štiha. |
   | Kajkavac | 1800 | Zna kaj je kaj. |

   followed by "Everyone starts at 1200. Your first 10 ranked games are placement: you are Cucek until they're played."

A "Full rule ›" link, or a page load with one of the ids as the hash, opens the disclosure and scrolls to the section
(`scrollIntoView`, `block: 'start'`; instant under reduced motion).

**ACs:**
- F-1 Every sentence of today's page except the three edited ones is present, word for word (the test lists them).
- F-2 The three new sentences are present verbatim; "400 points" and "by at least 1 point" are gone.
- F-3 The Ranks table has the seven rows in order, and the placement sentence follows it.
- F-4 `/rules#rules-ranks` opens the disclosure.
- F-5 `App.test`'s Rules cases pass (the challenge sentence is inside the closed disclosure, still in the document).

## 10. Bundle

Everything here lands in the chunk every page loads (Rules, Leaderboard and Profile are not lazy). Budget: that JS
grows from 195 325 B to at most 230 106 B gzip (`ci.yml`); this change aims to add ≤ 12 KB. No `domMax` import: the
guide animates `x` with the shared `domAnimation` features. If the measured total passes 220 000 B, the Rules guide
moves behind `React.lazy` (the on-demand budget has ~21 KB free) and that is a ledgered ruling.

## 11. Verification

### 11.1 Unit and component tests (Vitest + RTL)

One test file per new unit (`RankChip`, `useRatings`, `LadderPanel`/`LadderChart`, `ClimbPanel`/`ClimbChart`, the
pure geometry helpers in `src/components/rank/geometry.ts`), and additions to `UserProfile`, `UserList`,
`FriendList`, `HomePage`, `PlayPage`, `Sidebar`, `info` and `App` tests. Fixtures: a placed player, Cucek, Kajkavac,
Dečec, a player without `rank`, a ladder (412 players), an empty ladder (4), a 404 and a 500 for each route.

### 11.2 Visual checks (`e2e/visual.mjs`)

- Existing scenes keep their fixtures (R-7) and must still match.
- New scenes, at 1440 × 900 and 375 × 812: `leaderboard-ladder`, `leaderboard-ladder-cucek`, `leaderboard-ladder-few`,
  `profile-climb`, `profile-climb-cucek`, `profile-climb-kajkavac`, `profile-climb-none`, `profile-other-ranked`,
  `home-ranked`, `ranked-ranked`, `friends-ranked`, `shell-sidebar-ranked` (1440 × 900 and 800 × 1000),
  `rules-guide-trump` (after switching to Trump) and `rules-guide-follow` (after tapping Karo 7), `rules-full`
  (disclosure open, full page).
- Changed baselines: `legal-rules`, `shell-rules`, `shell-rules-signed-out` (the page changed).
- `--compare` twice identical, then `--check all`.

### 11.3 Backend follow-ups (written down, not fixed; D-7)

- F-1 `RankDto` could carry `nextName` (the next rank's name), so "{gap} to {next}" needs no ladder (R-3).
- F-2 `GET /user/{id}/rating-history` could carry the rank breakpoints, so the climb needs no ladder (R-8).
- F-4 `LadderDto.ranks[]` could carry each rank's `tagline`, so the legend needs no SPA copy of them (§7.4).

### 11.4 Not verifiable here

- The live backend: unless the rig is free for a scratch backend (`pre-deploy` merged into `ui-redesign`), the charts
  are verified on fixtures only, and the report says "not verified live".
- Real screen readers on the charts' tables and live regions; iOS Safari's `ResizeObserver` timing.

---

## User Stories

- **US-1** (entry): As a signed-in player, I open Leaderboard from the sidebar or the More sheet and see the ladder
  above the list, so that I see where everyone stands before I scroll names.
- **US-2** (entry): As a signed-in player, I open Profile from the tab bar or the sidebar and see my rank under my
  name and my climb above Recent matches, so that my progress is the first thing on my page.
- **US-3** (entry): As a visitor, I open Rules from the footer or Home's "Read Guide" and first see a short visual
  guide, so that I can learn the game without reading a wall of text.
- **US-4**: As a placed player, I see my rank tag beside my Elo on Home, on the Ranked page and under my name in the
  sidebar, so that my rank is always in view where my rating is.
- **US-5**: As a placed player, I see a rank tag beside every ranked player's Elo on the Leaderboard and on my
  friends' rows, so that I can compare at a glance.
- **US-6**: As a placed player, I see a "You" marker on the ladder and "Ahead of {p}% of ranked players", so that I
  know my place among everyone, not just my page of the list.
- **US-7**: As a player, I hover, tap or arrow through the ladder's bars and read each band's range and count, and a
  screen reader reads the same numbers from a table, so that the chart never hides a number.
- **US-8**: As a placed player, I see my progress bar and "{gap} to {next}" on my Profile, so that I know how far the
  next rank is.
- **US-9**: As a placed player whose pace is positive, I read "At this pace: {next} in about {n} games" with a dashed
  forecast and a luck band, so that I see a likely path without a promise.
- **US-10**: As a placed player whose pace is flat or negative, I read how many more wins than losses take me to the
  next rank, so that a bad run reads as a target, not a verdict.
- **US-11**: As a player in placement (Cucek), I see "Placement: {k} of 10 ranked games" on my Profile and, on the
  ladder, how many ranked games I still need to join it, so that I know what unlocks my rank.
- **US-12**: As Kajkavac, I see "Top rank" and "Kajkavac: the top rank." with my forecast still drawn, so that the top
  is acknowledged and my form still shows.
- **US-13**: As a player with no ranked games, I see "Your climb starts with your first ranked game.", so that an
  empty chart never looks broken.
- **US-14**: As a player looking at another player's profile, I see their rank chip and progress but no climb chart,
  so that charts stay personal (D-2).
- **US-15**: As a player on a backend without ranks, I see today's pages with no empty chips or broken panels, so that
  the SPA can deploy before the backend.
- **US-16**: As a player whose chart request fails, I see one quiet line and Try again, so that a failure is clear and
  recoverable.
- **US-17**: As a visitor, I switch the guide's cards between "Trump" and "Other suits" and watch them move to their
  order with their points, so that the two orders stick.
- **US-18**: As a visitor, I tap cards in the guide's trick and read why each may or may not be played, so that the
  follow-suit rule is learned by trying.
- **US-19**: As a visitor who needs the details, I tap "Full rule ›" on any step and land on that section of the full
  rules, so that nothing the server enforces is hidden.
- **US-20**: As a visitor, I read in the full rules how the new rating moves, what an absence costs and the seven
  ranks with their starts, so that the Rules page is true for the new backend.
