import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { useT } from '../../i18n/t';

export interface GuideEndSheetProps {
    open: boolean;
    /** A guest: what a guest can do, what an account adds, and sign-up as the main button. */
    guest: boolean;
    /** Signup is full: the sign-up button reads "Red za stol" (Ruling 6, 47); it goes to /signup either way. */
    signupFull: boolean;
    /** "Nastavi ovu igru" (Ruling 9), Escape or the scrim: the game goes on as a plain game. */
    onContinue: () => void;
    /** Out of the game to a page (the game page's own way out). */
    onGo: (to: string) => void;
}

/**
 * Škola bele's end (open beta §7.4, D-20), over the running bot game once hand 2's first hand is over: one main button
 * per role and every button going somewhere. A guest: sign up, go on with this game, or replay the guide. A member: go
 * on with this game, Ranked, or Home. The game's clock runs behind it, and a line says so.
 */
export function GuideEndSheet({ open, guest, signupFull, onContinue, onGo }: GuideEndSheetProps) {
    const t = useT();
    const done = t.guide.done;
    return (
        <Sheet open={open} onClose={onContinue} title={done.title} data-testid="guide-end">
            <div className="flex flex-col gap-3">
                <p className="t-body">{done.lead}</p>
                {guest && (
                    <>
                        <h3 className="t-headline">{done.guestCan}</h3>
                        <ul className="t-body list-disc pl-5">
                            <li>{done.guestBots}</li>
                            <li>{done.guestFriends}</li>
                        </ul>
                        <h3 className="t-headline">{done.accountAdds}</h3>
                        <ul className="t-body list-disc pl-5">
                            <li>{done.addsRanked}</li>
                            <li>{done.addsFriends}</li>
                            <li>{done.addsMatches}</li>
                            <li>{done.addsName}</li>
                        </ul>
                    </>
                )}
                <p className="t-footnote text-text-2">{done.clock}</p>
                <div className="mt-3 flex flex-col gap-2">
                    {guest ? (
                        <>
                            <Button block onClick={() => onGo('/signup')}>{signupFull ? t.auth.waitlist.title : t.guest.needsAccount.signUp}</Button>
                            <Button block variant="secondary" onClick={onContinue}>{done.continue}</Button>
                            <Button block variant="secondary" onClick={() => onGo('/learn')}>{t.guide.end.again}</Button>
                        </>
                    ) : (
                        <>
                            <Button block onClick={onContinue}>{done.continue}</Button>
                            <Button block variant="secondary" onClick={() => onGo('/play')}>{t.titles.ranked}</Button>
                            <Button block variant="secondary" onClick={() => onGo('/dashboard')}>{t.titles.home}</Button>
                        </>
                    )}
                </div>
            </div>
        </Sheet>
    );
}
