import type { LayoutKind } from './model/cardTargets';

// "Your turn" (spec §5.3.3 `your-turn`) is the catalog's `board.yourTurn` (Seats.tsx `TurnText`, with "Still there?"):
// over my hand sideways, on tablets and on desktops (Board.tsx `YourTurn`), my own plate's name on upright phones (Seats).

/**
 * Upright phones show "Your turn" as my plate's name instead of over my hand (owner, 2026-11-03, option B, from
 * screenshots); the element carries `data-testid="your-turn"` while it reads so. Sideways the label over my hand stays
 * (owner, 2026-11-03, "Label above the hand": my sideways plate has no room for it), as on tablets and desktops.
 */
export const turnOnPlate = (kind: LayoutKind): boolean => kind === 'portrait';
