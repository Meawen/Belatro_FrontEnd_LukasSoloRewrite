import { Tag } from '../ui/Chip';
import { blokRows } from './model/hands';
import type { BoardModel, Team } from './model/boardModel';
import type { MatchHands } from '../../hooks/useMatchHands';

/** The desktop column's hint (spec §5.4). */
export const BLOK_HINT = "Tap your team's pile to look at the tricks you've won this hand.";

/**
 * Bela Blok (spec §5.4, US-35): one row per hand (#, Mi, Vi, PAD/CAPOT) from the stored hands' final
 * scores, and the running totals, which are the view's scores.
 */
export function BlokTable({ model, hands }: { model: BoardModel; hands: MatchHands | null | undefined }) {
    const teamOf = (id: string): Team | null => model.seats.find((seat) => seat.id === id)?.team ?? null;
    const rows = blokRows(hands?.hands ?? null, teamOf);
    const mine: Team = model.myTeam ?? 'A';
    const theirs: Team = mine === 'A' ? 'B' : 'A';
    const points = (row: { a: number; b: number }, team: Team) => (team === 'A' ? row.a : row.b);
    const tags = (row: (typeof rows)[number], team: Team) => (
        <>
            {row.padanje === team && <Tag tone="warn" className="mr-1">Pad</Tag>}
            {row.capot === team && <Tag tone="win" className="mr-1">Capot</Tag>}
        </>
    );
    return (
        <table className="board-blok__table">
            <thead>
                <tr>
                    <th scope="col">#</th>
                    <th scope="col">Mi</th>
                    <th scope="col">Vi</th>
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 ? (
                    <tr><td colSpan={3} className="board-blok__empty">No hands yet</td></tr>
                ) : rows.map((row) => (
                    <tr key={row.handNo}>
                        <td>{row.handNo}</td>
                        <td>{tags(row, mine)}{points(row, mine)}</td>
                        <td>{tags(row, theirs)}{points(row, theirs)}</td>
                    </tr>
                ))}
            </tbody>
            <tfoot>
                <tr>
                    <td><span className="sr-only">Total</span></td>
                    <td>{points(model.scores, mine)}</td>
                    <td>{points(model.scores, theirs)}</td>
                </tr>
            </tfoot>
        </table>
    );
}

/** On desktops Bela Blok is a permanent 320-px column beside the board (spec §5.6.3). */
export function BlokColumn({ model, hands }: { model: BoardModel; hands: MatchHands | null | undefined }) {
    return (
        <aside data-testid="bela-blok" aria-labelledby="board-blok-title" className="board-blok">
            <h2 id="board-blok-title" className="t-title">Bela Blok</h2>
            <BlokTable model={model} hands={hands} />
            <p className="t-footnote text-text-3">{BLOK_HINT}</p>
        </aside>
    );
}
