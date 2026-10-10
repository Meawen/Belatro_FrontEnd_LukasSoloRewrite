import { SUIT_LABEL, cardLabel } from '../game/gameView';
import type { BoardModel, Team } from './model/boardModel';
import type { BoardEvent } from './model/diffBoard';

/** The name the board gives a seat: "You" for me, otherwise the player id (the username). */
export function seatName(model: BoardModel, playerId: string): string {
    return playerId === model.me ? 'You' : playerId;
}

const upheld = (team: Team | null) => (team ? `Challenge upheld: Team ${team} takes the hand` : 'Challenge upheld');

/**
 * The toast an event raises (spec §5.3.4, O-4): every challenge result, mine or another seat's; null
 * for every other event.
 */
export function toastFor(event: BoardEvent): string | null {
    if (event.type === 'ChallengeFailed') return event.mine ? 'No foul found' : `${event.playerId} challenged: no foul found`;
    if (event.type === 'ChallengeUpheld') return upheld(event.team);
    return null;
}

/**
 * One polite live-region message per event that a player needs to hear (spec §5.8). `handNo` is the
 * number of the hand that just ended, when the stored moves already know it.
 */
export function announce(events: readonly BoardEvent[], model: BoardModel, handNo: number | null): string[] {
    const messages: string[] = [];
    const mine = model.myTeam ?? 'A';
    for (const event of events) {
        switch (event.type) {
            case 'Turn':
                if (event.playerId) messages.push(event.playerId === model.me ? 'Your turn' : `${event.playerId}'s turn`);
                break;
            case 'Bid':
                if (event.call === 'PASS') messages.push(`${seatName(model, event.playerId)}: Pass`);
                break;
            case 'TrumpCalled':
                messages.push(event.playerId ? `${seatName(model, event.playerId)} called ${SUIT_LABEL[event.suit]}` : `Trump: ${SUIT_LABEL[event.suit]}`);
                break;
            case 'CardPlayed':
                messages.push(`${seatName(model, event.playerId)} played ${cardLabel(event.card)}`);
                break;
            case 'TrickCompleted':
                if (event.winnerId) messages.push(event.winnerId === model.me ? 'You win the trick' : `${event.winnerId} wins the trick`);
                break;
            case 'Bela':
                messages.push(`${seatName(model, event.playerId)}: Bela`);
                break;
            case 'HandCompleted': {
                const title = handNo ? `Hand ${handNo}` : 'Hand finished';
                if (!event.delta) {
                    messages.push(title);
                    break;
                }
                const mi = mine === 'A' ? event.delta.a : event.delta.b;
                const vi = mine === 'A' ? event.delta.b : event.delta.a;
                messages.push(`${title}: Mi ${mi}, Vi ${vi}`);
                break;
            }
            case 'ChallengeUpheld':
            case 'ChallengeFailed':
                messages.push(toastFor(event)!);
                break;
            case 'Ended':
                if (model.end) messages.push(model.end.reason ?? model.end.winnerLine ?? model.end.title);
                break;
            default:
                break;
        }
    }
    return messages;
}
