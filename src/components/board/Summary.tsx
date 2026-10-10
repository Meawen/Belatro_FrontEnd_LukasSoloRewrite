import type { BoardModel } from './model/boardModel';

/**
 * "This hand", always in the DOM and visually hidden (spec §5.3.3): one `bid` line per bid, the
 * `declaration` lines and `your-team` — for screen readers, tests and the harness — and my hand as a
 * list, so it can be reviewed while its buttons are disabled (M-10).
 */
export function Summary({ model }: { model: BoardModel }) {
    const waiting = !model.yourTurn && !model.finished;
    return (
        <div className="sr-only">
            <h2>This hand</h2>
            {model.summary.bids.length > 0 && (
                <ol>
                    {model.summary.bids.map((line, i) => <li key={i} data-testid="bid">{line}</li>)}
                </ol>
            )}
            {model.summary.declarations.length > 0 && (
                <ul>
                    {model.summary.declarations.map((line, i) => <li key={i} data-testid="declaration">{line}</li>)}
                </ul>
            )}
            {model.summary.yourTeam && <p data-testid="your-team">{model.summary.yourTeam}</p>}
            {model.hand.length > 0 && <p>{`Your hand: ${model.hand.map((card) => card.label).join(', ')}`}</p>}
            {waiting && <p>Waiting for other players...</p>}
        </div>
    );
}
