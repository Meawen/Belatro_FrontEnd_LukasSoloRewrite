import { apiClient } from './api';

/** POST /lobbies/bot-game's answer (spec §6): the started game, and its hidden table. */
export interface BotGameStarted {
    gameId: string;
    lobbyId: string;
}

/**
 * A game against three bots, started at once (spec §6), for a member or a guest. The server opens a hidden casual
 * table, seats three bots and starts it. It answers 409 ALREADY_IN_GAME while the caller has a game running.
 */
export async function startBotGame(): Promise<BotGameStarted> {
    return apiClient.post<BotGameStarted>('/lobbies/bot-game');
}
