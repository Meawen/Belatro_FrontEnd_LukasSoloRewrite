import { AnimatePresence, m } from 'motion/react';
import { fade } from '../../motion/tokens';
import { PlayingCard } from '../ui/PlayingCard';
import type { Team } from './model/boardModel';
import type { Targets } from './model/cardTargets';

export interface PilesProps {
    /** The counts as shown (a trick still flying isn't on its pile yet). */
    counts: { a: number; b: number };
    targets: Targets;
    myTeam: Team;
    /** A tap on a pile: mine opens the peek, the opponents' says it stays closed. Without it the piles only show. */
    onTap?: (team: Team) => void;
}

/** The tricks won this hand (spec §5.3.3): `pile-a`/`pile-b` with `data-count`, a few backs and the count. */
export function Piles({ counts, targets, myTeam, onTap }: PilesProps) {
    return (
        <div className="board-region board-piles">
            {(['A', 'B'] as const).map((team) => {
                const target = targets.piles[team];
                const count = team === 'A' ? counts.a : counts.b;
                const width = target.width * target.scale;
                const height = target.height * target.scale;
                const mine = team === myTeam;
                const style = { left: target.left + (target.width - width) / 2, top: target.top + (target.height - height) / 2, width, height };
                const content = (
                    <>
                        <AnimatePresence>
                            {Array.from({ length: Math.min(count, 4) }, (_, i) => (
                                <m.span
                                    key={i}
                                    className="board-pile__card"
                                    style={{ rotate: (mine ? -1 : 1) * (6 + i * 3), x: i * 2, y: -i * 2 }}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={fade}
                                >
                                    <PlayingCard back={1} width={width} />
                                </m.span>
                            ))}
                        </AnimatePresence>
                        {count > 0 && <span className="board-pile__count font-pix" aria-hidden="true">{count}</span>}
                    </>
                );
                const testId = `pile-${team.toLowerCase()}`;
                if (!onTap) {
                    return <div key={team} data-testid={testId} data-count={count} className="board-pile" style={style}>{content}</div>;
                }
                return (
                    <button
                        key={team}
                        type="button"
                        data-testid={testId}
                        data-count={count}
                        aria-label={mine ? `Look at your team's tricks (${count})` : `Opponents' tricks (${count})`}
                        className="board-pile board-pile--button press"
                        style={style}
                        onClick={() => onTap(team)}
                    >
                        {content}
                    </button>
                );
            })}
        </div>
    );
}
