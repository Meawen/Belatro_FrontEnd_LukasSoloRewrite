import { SUIT_LABEL, cardLabel } from '../game/gameView';
import { challengeSrLine } from './model/challengeMoment';
import type { BoardModel } from './model/boardModel';
import type { BoardEvent } from './model/diffBoard';

/** The name the board gives a seat: "You" for me, otherwise the player id (the username). */
export function seatName(model: BoardModel, playerId: string): string {
    return playerId === model.me ? 'You' : playerId;
}

/** A bot's seat (the server's flag, SeatModel.bot). */
const isBotSeat = (model: BoardModel, playerId: string) => model.seats.some((seat) => seat.id === playerId && seat.bot);

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
                // a bot's turn is not announced: its card comes a second or two later, and that is announced (R27)
                if (event.playerId && !isBotSeat(model, event.playerId)) messages.push(event.playerId === model.me ? 'Your turn' : `${event.playerId}'s turn`);
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
            case 'Challenged':
                // the banner's words, once (gameplay rules §6): the banner itself is for the eye
                messages.push(challengeSrLine({ ...event, name: seatName(model, event.playerId) }));
                break;
            // an older backend's inferred challenges; no toast for any challenge any more (the banner replaced O-4's)
            case 'ChallengeUpheld':
                messages.push(event.team ? `Challenge upheld: Team ${event.team} takes the hand` : 'Challenge upheld');
                break;
            case 'ChallengeFailed':
                messages.push(event.mine ? 'No foul found' : `${event.playerId} challenged: no foul found`);
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
