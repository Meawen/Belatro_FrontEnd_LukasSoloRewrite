// The game hook's old name: GamePageConnected imports it until the board page (Phase 4) imports
// useGameViews; that phase deletes this file.
export { useGameViews as useBelatroGame } from './useGameViews';
