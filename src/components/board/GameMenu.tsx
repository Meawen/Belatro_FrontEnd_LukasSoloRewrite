import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import type { BoardModel } from './model/boardModel';
import { useT } from '../../i18n/t';

export interface GameMenuProps {
    model: BoardModel;
    open: boolean;
    onClose: () => void;
    /** Phones only: Bela Blok is a sheet there (desktops show it as a column). */
    onBlok: (() => void) | null;
}

/** The game menu (spec §5.4, X-10): Bela Blok on phones, "This hand" (a visible copy, no test ids), Rules, Back to home. */
export function GameMenu({ model, open, onClose, onBlok }: GameMenuProps) {
    const t = useT();
    const navigate = useNavigate();
    const { bids, declarations, yourTeam } = model.summary;
    return (
        <Sheet open={open} onClose={onClose} title={t.board.menu.title} showClose>
            <div className="board-menu">
                {onBlok && <Button variant="secondary" block onClick={onBlok}>{t.board.blok.title}</Button>}
                <section aria-labelledby="board-menu-hand" className="board-menu__hand">
                    <h3 id="board-menu-hand" className="t-headline">{t.board.thisHand}</h3>
                    {yourTeam && <p className="t-callout">{yourTeam}</p>}
                    {bids.length > 0 && <ol className="t-callout text-text-2">{bids.map((line, i) => <li key={i}>{line}</li>)}</ol>}
                    {declarations.length > 0 && <ul className="t-callout text-text-2">{declarations.map((line, i) => <li key={i}>{line}</li>)}</ul>}
                    {bids.length === 0 && declarations.length === 0 && <p className="t-callout text-text-2">{t.board.menu.noBids}</p>}
                </section>
                <a href="/rules" target="_blank" rel="noopener noreferrer" className="board-menu__link t-callout font-semibold text-accent">{t.titles.rules}</a>
                <div className="board-menu__leave">
                    <Button block onClick={() => navigate('/dashboard')}>{t.board.menu.backHome}</Button>
                    {/* what Back to home tells the player before they go (spec §5.4, US-36) */}
                    <p className="t-footnote text-text-2">{t.board.menu.leaveNote}</p>
                </div>
            </div>
        </Sheet>
    );
}
