import { PHASE_LABEL, SUIT_LABEL, cardLabel } from '../game/gameView';
import { challengeSrLine } from './model/challengeMoment';
import { belotLine } from './model/declarationMoment';
import type { BoardModel } from './model/boardModel';
import type { BoardEvent } from './model/diffBoard';
import { cat } from '../../i18n/t';

/** The name the board gives a seat: "You" for me (common.you), otherwise the player id (the username). */
export function seatName(model: BoardModel, playerId: string): string {
    return playerId === model.me ? cat().common.you : playerId;
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
    const say = cat().board.say;
    for (const event of events) {
        switch (event.type) {
            case 'Turn':
                // a bot's turn is not announced: its card comes a second or two later, and that is announced (R27)
                if (event.playerId && !isBotSeat(model, event.playerId)) messages.push(event.playerId === model.me ? cat().board.yourTurn : say.turn(event.playerId));
                break;
            case 'Bid':
                if (event.call === 'PASS') messages.push(say.passed(seatName(model, event.playerId)));
                break;
            case 'TrumpCalled':
                messages.push(!event.playerId ? say.trump(SUIT_LABEL[event.suit])
                    : event.playerId === model.me ? say.calledMine(SUIT_LABEL[event.suit]) : say.called(event.playerId, SUIT_LABEL[event.suit]));
                break;
            case 'CardPlayed':
                messages.push(say.played(seatName(model, event.playerId), cardLabel(event.card)));
                break;
            case 'TrickCompleted': {
                if (!event.winnerId) break;
                // the hand's 8th trick: every seat has played its last card (spec §1.4 "Last trick")
                const last = model.seats.every((seat) => seat.cardsLeft === 0);
                if (event.winnerId === model.me) messages.push(last ? say.lastTrickMine : say.trickMine);
                else messages.push(last ? say.lastTrick(event.winnerId) : say.trick(event.winnerId));
                break;
            }
            case 'Bela':
                messages.push(say.bela(seatName(model, event.playerId)));
                break;
            case 'HandCompleted': {
                const title = handNo ? cat().board.result.hand(handNo) : PHASE_LABEL.HAND_COMPLETE;
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
                messages.push(event.team ? say.upheld(event.team) : say.upheldNoTeam);
                break;
            case 'ChallengeFailed':
                messages.push(event.mine ? say.failedMine : say.failed(event.playerId));
                break;
            case 'Ended': {
                if (!model.end) break;
                // a belot: said once ("Belot! Ivo holds all eight Pik"), then who won; its reason would say it again
                const belot = belotLine(model.zvanja, model.me);
                if (belot && model.end.winnerLine) messages.push(belot, model.end.winnerLine);
                // the winner, then why (a forfeit's reason names the winner itself)
                else messages.push([model.end.winnerLine, model.end.reason].filter(Boolean).join('. ') || model.end.title);
                break;
            }
            default:
                break;
        }
    }
    return messages;
}
