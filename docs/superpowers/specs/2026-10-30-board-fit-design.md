# The board fits its window: phones and desktops (design)

Date: 2026-10-30. Status: agreed with the owner in brainstorming, awaiting their approval of this document.
Amends the redesign spec (`2026-10-09-ui-redesign-design.md`): §3.6 "Sizes" (D-23) and §5.6 (layouts). Everything
not named here stays as those sections say.

## 1. Why

The owner, before the open beta: "on the phone there are moments where you cant see what is happening from the cards,
from the pc sometimes the game area doesnt scale well". On the phone, what must read clearly is "the cards that are
down and in my hand": the trick and the hand. Name tags, chips, the opponents' backs and declared cards come second.

What the investigation found (screenshots of master 5dbdae2 at real browser window sizes, run folder
`stiglja-notes/sdd/2026-10-30-board-fit/shots-before/`):

- **Phones.** Every position in `cardTargets`/`seatSpot` is a fixed offset tuned at 375×812 and 812×375. Real
  browser windows are shorter: Safari with its bars leaves 375×553 (iPhone SE) and 390×664 (iPhone 14) upright, and
  about 667×323 and 844×340 sideways. So:
  - upright, the partner's name tag sits on the partner's trick card (375×553). After the trump call, the partner's
    tag, "ZVANJA" chip and declared cards hang down under the fan onto the trick, even at 390×664;
  - sideways, the cross has no room: my card lands on my hand and under the partner's card, and the partner's card
    lands on the partner's backs. The left seat's tag covers mine, and the right seat's declared cards fall off the
    bottom.
- **Desktops.** `layoutFor` sizes cards from the device-pixel ratio alone, never from the window:
  - 100 %: hand 142, trick 71. 125 % (Windows' default on 1920×1080 laptops): hand 170, trick 57, so the hand is 3×
    the trick. 200 % (Mac): 107 and 107;
  - the board area caps at 1100 px wide and ignores the height. On 2560×1300 the table is a small cluster in a large
    felt;
  - a window 768–1023 px wide (half a screen) gets the phone layout and phone cards.
- The visual harness checks the board only at 375×812, 812×375 and 1440×900, which is why none of this showed.

## 2. Goals, non-goals, anti-goals

**Goals**
- G1. On every supported window, **nothing covers a card on the table or the playable part of my hand.** Name tags
  (with their badges: D, the caller's, Bela and No challenge; owner 2026-10-30 and 2026-11-03), chips (bid, ZVANJA),
  declared cards, the opponents' backs, the HUD and its buttons, and my own hand make room for the trick. §5 lists the
  deliberate exceptions.
  - The trick's own cards may overlap each other as today's cross does (slots at a fixed share of the card size; the
    later card on top), as in the approved landscape mockup D. But each trick card shows at least one of its two
    corner indices (the art prints the rank and suit top-left and, turned, bottom-right). (Builder's call, from the
    review.)
- G2. Tags, chips, declared cards and HUD controls don't cover each other either, nor the opponents' card backs (with
  7 or 8 cards in a hand; owner, after the before/after).
- G3. Phones upright: the trick and the hand are one crisp step bigger than today wherever they fit (§3.2).
- G4. Desktops: card sizes come from the window. The table grows on big monitors, shrinks on short laptop windows,
  and looks the same at 100 %, 125 % and 150 % zoom (§3.3).
- G5. The fix is checked at the sizes real devices have, not only the harness's three (§7).

**Non-goals**
- Other pages, the backend, the game rules, animations (beyond following the new positions), the card art
  (Tref Dečko, look list 28).
- The hand-result sheet covering a name tag in landscape (look list 2), and phones narrower than 360 px (look list 21,
  24: 320 px is not a supported size).

**Anti-goals** (a failure even if it "works")
- Soft or blurry card art: every face and back stays a whole number of device pixels per art pixel (§3.6's rule).
  One exception (owner, 2026-11-01, "Fix common sizes"): phones held sideways on a screen whose crisp step nearest 71
  is over 72 px wide draw the table's cards at exactly 71 px (§3.4), slightly uneven, so that they fit.
- A table that jumps or reflows during play. Sizes change only when the window does (resize, rotation, zoom).
- Hiding information to make room. Every tag, chip and declared card still shows; it moves or shrinks.

## 3. Card sizes

### 3.1 The rule they all share
A card is `71 × s / dpr` CSS px wide (`95 × s / dpr` tall) for a whole number `s` of device pixels per art pixel, as
§3.6 already says. What changes is how `s` is chosen: from the window's room, not from a fixed intended width. A
"step" below means the next `s`. At dpr 1 the trick steps go 71, 142, 213. At dpr 1.25 they go 57, 114, 170, 227; at
dpr 2, 71, 106.5, 142, 177.5; at dpr 3, 71, 94.7, 118.3.

### 3.2 Phones (narrower than 768 px, taller than 500)
- The trick and the hand share one size: the biggest crisp size from today's (the step nearest 71) up to about 107 px
  wide at which the layout of §4.1 fits the window. Otherwise, today's size.
  - Upright at 390×664 @3 that means 94.7 wide (owner's mockup A). At 375×553 @2 it stays 71 if 106.5 doesn't fit.
- The opponents' backs stay as today (a 71-wide card at `scale(.5)`).
- **What "fits" counts (builder's call, from the review).** The cards, the hand, the fans, the HUD and its button
  column, and each seat's tag column at its common size: the name plate, one row of chips and up to four declared
  cards. Rarer, bigger columns don't make the cards smaller: a 20-character name, three chips, or six or more
  declared cards. They give way instead, in this order:
  1. declared cards overlap more, down to only their corner index showing;
  2. chips wrap onto more rows within their column;
  3. the column grows into free felt on its own side, away from the trick;
  4. sideways, my partner's declared cards go to the fan's other side (§4.2).

  The trick, the hand and the text size never give way, and nothing is hidden. The size is chosen from the window
  only, so it never changes during play.

### 3.3 Desktops and wide windows (768 px wide or more, taller than 500)
- The hand and the trick are chosen as one pair:
  - the hand about 1.5× the trick's width (owner's choice), never more than 2× and never smaller than the trick;
  - the pair is the biggest at which the layout of §4.3 fits the window's width and height.
- **When the steps conflict, the hand's ratio wins over a bigger table** (owner, after the review: "Hand a bit
  bigger first"):
  1. among the crisp pairs whose hand is 1.33–1.67× the trick, take the one with the biggest trick that fits (for one
     trick, the hand nearest 1.5×; a tie goes to the smaller hand);
  2. if none fits, take the biggest trick that fits with the hand nearest 1.5× (between 1× and 2×). A tie between
     1× and 2× goes to the bigger hand.
  - Examples (the builder's numbers, what `layoutFor` picks). 1366×641 @1: trick 71, hand 142, today's 100 % look.
    1440×900 @1 and 1920×1080 @1: 142 and 213. 2560×1300 @1: 213 and 284. 1536×730 @1.25: 113.6 and 170.4.
    1280×600 @1.5: 94.7 and 94.7. A Mac at 1440×789 @2: 106.5 and 142, the hand bigger than today's 106.5.
  - Note (builder, after the fit check): on 1280×600 @1.5 and 1440×789 @2 the in-band pairs with a bigger trick or
    hand (94.7/142; 142/213) don't fit, because the cross is taller than its band between the partner's fan and my
    hand. So 1280×600 falls to rule 2 and 1440×789 to the 1.33 pair. The band no longer reserves the hover lift (§4.3).
    Landscape uses a flatter cross (§4.2).
- **The opponents' backs and fan steps scale with the trick** on these windows (builder's call, from the review): the
  backs drawn at half the trick card's width, as on phones (35.5 against 71). Tags and chips keep today's text size.
- **Ceiling (builder's call, agreed in the summary):** the trick at most three art sizes (213 px wide on a 1× screen,
  i.e. `s ≤ 3·dpr`). The hand follows the ratio.
- **Floor:** the trick no smaller than today's step nearest 71. If even that doesn't fit (a very short but wide
  window), the layout uses that floor and lets the felt be tight, rather than shrinking the art further.
- 768–1023 px wide windows (half a screen, an upright tablet) use this sizing with the portrait arrangement (§4.1).
  Bela Blok stays a sheet there, because its 320-px column doesn't fit. From 1024 px the Bela Blok column shows, as
  today.
- The board area (today `max 1100`) grows with the cards: its width limit scales with the chosen trick size, so a
  big window gets a bigger table, not a wider empty felt.

### 3.4 Landscape phones (height 500 px or less)
- The cards stay at today's size (the step nearest 71), hand and trick alike.
  - **Except where that step is over 72 px wide** (Android's dpr 2.625 gives 81.1, 2.75 gives 77.5): there the
    table's cards are drawn at exactly **71 px** (the opponents' backs too, the declared cards at half that). That is
    a non-integer number of device pixels per art pixel, slightly uneven. The owner accepted it for this case only
    (2026-11-01, "Fix common sizes"), so that common Android phones held sideways fit (§7). Upright, tablets and
    desktops stay crisp.
- The hand sinks so only its **top 45 %** shows (owner's choice D, then 45 % for the Android sizes, 2026-11-01; today
  a quarter tucks below the edge). The corner index and part of each picture show, and each card's exposed strip stays
  tappable.

### 3.5 Things sized from the cards
- Declared cards (by the seats, from the trump call until the first trick is taken) are about **half the trick card's
  width**, crisp (owner: "small, beside the tag"). Today they are the backs' size, which is the same on phones.
- The piles (`ts/2` today), the belot row in the declaration moment (`belotRow`), the fan steps, the side insets and
  the partner's distance under the HUD scale with the chosen sizes where today's fixed numbers would crowd or
  scatter a bigger or smaller table. The builder picks which and how; §7 checks the result.

## 4. Where things go

The trick keeps its cross in every layout. Its slots stay relative to the card size, as today.

### 4.1 Portrait (phones upright, and 768–1023 px wide windows)
- The **trick's centre** is the middle of the free band between the partner's area (fan and tag) and the top of my
  hand, not the fixed 44 % of the felt height of today.
- **The partner:** the fan stays top centre under the HUD. **Its tag goes beside the fan** (to the right), with the
  partner's chips and declared cards under the tag, in that column beside the fan. Nothing hangs below the fan into the
  trick.
- **The side seats:** the fans stay at the edges. **Their tags go above the fans.** Their chips and declared cards go
  under the fans, on their own edge, clear of the side trick slots. This is the owner's approved mockup
  (companion screen `02-phone-options.html`, option A).
- **Me:** my tag stays over my pile, bottom left, above the hand, with my declared cards over it as today.
- The HUD's Challenge and info buttons (the column under the HUD on the left in portrait) keep their place. The left
  seat's tag and chips must not meet them (G2).

### 4.2 Landscape (height 500 px or less)
- The cross is centred in the band between the partner's fan and the top of the (lowered) hand. It is flatter than
  upright: its slots sit 0.32 of a card's height from its centre (0.45 at first, then 0.35), the flattest at which
  every trick card still shows a corner index. The partner's fan sits 13 px under the HUD per 71 px of back (23 at
  first, then 17), the backs drawn at 0.4. So the cross fits the iPhone windows and the common Android ones of §7
  (builder, after the fit checks; the Android numbers owner-approved 2026-11-01).
- The partner's tag stays beside the fan (today's rule), its chips and declared cards beside it, on the same row. On
  phones it sits 6 px under the HUD's right group (the phase chip at its widest and the menu, whose hit areas reach
  52 px down), where its row on the fan's middle line would meet them. Its declared cards go to the fan's other side,
  on the fan's middle line, where the row lacks the width, would come within 6 px of a trick slot, or would wrap a busy
  column onto the right seat's (builder, Ruling AB, after the testing session's DOM check).
- The side seats as in §4.1: tags above the fans, chips and declared cards under them.
- **My tag sits at the bottom left, beside my hand**, low enough that the left seat's column never reaches it.
  My chips and declared cards sit over my tag.
- The safe areas (§3.4 of the redesign spec: the notch's left and right insets, the home indicator) stay respected.

### 4.3 Desktop (1024 px wide or more, taller than 500)
- Today's arrangement, scaled: the board area centred in the space left of the 320-px Bela Blok column, the cross at
  its centre band, the fans and tags placed as today but at distances that follow the card size.
- The partner's and side seats' chips and declared cards follow §4.1's rule (nothing hangs into the trick), wherever
  today's positions would put them on it at the new sizes.
- The hover lift (−24 px, ×1.08, §5.6.5) of a hand card must not reach the partner's or a side seat's trick card. It
  may reach my own slot (builder, after the fit check): a card lifts only while it is enabled, on my turn, when my slot
  is empty, as with "Your turn".
- The side seats' fans step 12 px per 71 px of back (the partner's fan keeps 16), so they stay clear of the piles. The
  side seats' columns stay where a 16-step fan would start them (builder, after the fit check).
- The piles stay clear of the fans once they hold a trick. A pile draws nothing before that, and by then every seat
  holds 7 cards at most.

## 5. Deliberate exceptions to G1
These cover the trick or hand on purpose, and the checks must allow them:
- the bid panel during bidding, before any card is down;
- the Bela prompt, which opens over the hand card being pressed and asks before the card is played (builder's call,
  from the review);
- the declaration moment's panel at the trick's centre (the ~5 s after the trump call), before the first card;
- the challenge banner, centred on the trick while it says who challenged and the outcome (gameplay rules §6);
- sheets: the hand result, the end sheet, the game menu, Bela Blok's sheet, Peek;
- cards in flight: the deal, a card being played, the trick sweep;
- on landscape phones, the lower half of each hand card below the screen's edge (§3.4).

## 6. Code this touches (for orientation; the plan decides)
- `src/components/board/model/cardTargets.ts`: `layoutFor` (sizes and kind), `cardTargets` (positions),
  `trickCentre`, `bannerSpot`, `belotRow`, `fanStepOf`.
- `src/components/board/seatSpot.ts` and `Seats.tsx` (`board.css` `.board-seat*`): the tags' and chips' places, and
  the declared cards' size.
- `useBoardViewport.ts` already follows resize and rotation. A zoom change fires `resize`; check that the dpr change
  reaches `layoutFor`.
- `PlayingCard`'s `crispCardWidth` stays the single crisp rule.
- The dev board's layout presets (`src/dev/devTable.ts` `LAYOUTS`) may gain the real sizes of §7.

## 7. How we know it works
- **Tests first** (TDD), as unit tests of `layoutFor`/`cardTargets`/`seatSpot` at the sizes below. They cover: no
  trick card's rect meets the hand's, the fans', the HUD's reserved band or the seats' tag/chip boxes; crisp sizes;
  hand/trick between 1× and 2× on desktops (1.33–1.67× wherever §3.3 rule 1 applies); a bigger window never gets
  smaller cards; the table grows from 1440×900 to 2560×1300 (1440×900 and 1920×1080 at @1 may share a size, §3.3);
  960×980 no longer gets phone cards; every trick card's corner index shows (G1).
- **Sizes** (CSS window, dpr): upright 375×553 @2, 390×664 @3, 375×812 @2, 430×739 @3; sideways 667×323 @2, 844×340
  @3, 812×375 @2, and Android Chrome's 915×332 @2.625 and 851×329 @2.75; desktop 960×980 @1, 1280×720 @1, 1440×900 @1
  and @2, 1536×730 @1.25, 1280×600 @1.5, 1920×1080 @1, 2560×1300 @1.
  - Known, for after the beta (owner, 2026-11-01): sideways windows 300 px tall at dpr 3 (800×300, 740×300) don't
    fit yet. Sideways, every window 700 px wide or more fits from 310 px tall at dpr 2, 2.625 and 2.75, and from
    320 px at dpr 3.
- **Visual harness:** the board scenes gain some of these sizes, at least 390×664, 375×553, 844×340, 1536×730 @1.25
  and 960×980. Shots that change are re-recorded only after the owner approves a before/after page. The `safe` check's
  landscape tuck rises from a quarter to 55 % of a hand card (§3.4; half until 2026-11-01).
- **The testing session** (stiglja-lanes-f0, `stiglja-notes/sdd/2026-10-30-board-fit/test-plan.md`) checks the
  same sizes independently with its own DOM geometry check (T3), allowing §5's exceptions, then the rig runs the owner
  picks.
- **On the owner's phone:** the dev board served over the home Wi-Fi from the Mac (no sign-in, no backend), turned
  both ways, before the hand-off is called done.

## 8. Left to the builder
The exact space budgets and offsets, how far each fixed number scales, the side seats' column details, the tablet
details within §3.3/§4.1, and any tidy-up the new positions force on the declaration moment, the banner spot and the
piles. All of it must meet §2 and pass §7.
