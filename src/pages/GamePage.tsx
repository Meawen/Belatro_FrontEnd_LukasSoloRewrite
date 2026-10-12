import GamePageConnected from '../components/game/GamePageConnected';
import { usePageTitle } from '../routing/usePageTitle';

/**
 * /game/:gameId (spec §4.8, §5): the table, outside the app shell — no navigation, banners (X-8) or
 * footer (R-40 as amended). GamePageConnected keeps its own error boundary keyed by the game id
 * (R-29). Phase 4 owns this module.
 */
export function GamePage() {
    usePageTitle('Game');
    return <GamePageConnected />;
}
