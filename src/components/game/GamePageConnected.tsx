import { useParams, useNavigate } from 'react-router-dom';
import { useBelatroGame } from '../../hooks/useBelatroGame';           // domain hook from earlier step
import { RealisticGameBoard } from '../../MockComponents/RealisticGameBoard';
import type { Card } from '../../hooks/useGameWebSocket';

// map backend → board UI
type TrumpSuit = 'HERC' | 'KARO' | 'PIK' | 'TREF';
const toSuit = (s: string) =>
    s.trim().toUpperCase() as TrumpSuit;
const toUiSuit = (s: TrumpSuit) =>
    ({HERC:'Herc',KARO:'Karo',PIK:'Pik',TREF:'Tref'} as const)[s];
const toRank = (r: string) => r.trim().toUpperCase();

export default function GamePageConnected() {
    const { gameId = '' } = useParams();
    const nav = useNavigate();

    const { publicView, yourTurn, hand, actions } = useBelatroGame(gameId, () => {
        nav('/lobbies');
    });

    return (
        <RealisticGameBoard
            onBidSuit={(uiSuit: 'Herc'|'Karo'|'Pik'|'Tref') => actions.bidTrump(toSuit(uiSuit))}
            onPassBid={() => actions.passBid()}
            onPlayCard={(card: Card) => actions.play({ suit: toSuit(card.suit), rank: toRank(card.rank) })}
            onChallenge={() => actions.challenge()}
            publicView={publicView}
            privateView={{ hand, yourTurn }}
        />
    );
}
