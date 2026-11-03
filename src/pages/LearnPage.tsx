import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import hand1 from '../guide/hand1.recording.json';
import { stepsOf, type GuideStep } from '../guide/script';
import { useGuideReplay } from '../guide/useGuideReplay';
import { Board } from '../components/board/Board';
import { layoutFor } from '../components/board/model/cardTargets';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { LessonPanel } from '../components/guide/LessonPanel';
import { PLAIN_HIGH_FIRST, TRUMP_HIGH_FIRST, cardPoints } from '../components/info/rulesData';
import { Button } from '../components/ui/Button';
import { Panel } from '../components/ui/Panel';
import { useAuth } from '../hooks/useAuth';
import { useBotGame } from '../hooks/useBotGame';
import { usePageTitle } from '../routing/usePageTitle';
import { authService } from '../services/authService';
import { preloadCardArt } from '../services/cardArt';
import { getLang } from '../i18n/lang';
import { useT } from '../i18n/t';
import type { Rank } from '../types/game';

// B8's recording of a real server game, in this lazy chunk (no request): read once, when the chunk loads
const HAND1 = stepsOf(hand1);

type Phase = 'intro' | 'hand' | 'end';

/** A play that answers a card already on the table (not a lead): the trick the lesson talks about is there. */
function answers(step: GuideStep | null): boolean {
    const frame = step?.move?.kind === 'play' ? HAND1.frames[step.frame] : undefined;
    const plays = frame?.channel === 'private' ? Object.keys(frame.body.publicPart.currentTrick?.plays ?? {}).length : 0;
    return plays % 4 !== 0;
}

/**
 * The board lays this window out for a phone (portrait or landscape, as layoutFor decides): there the open lesson
 * covers the trick (S12's measure), so one that answers a card on the table starts folded to its title and do line.
 */
const onPhone = () => ['portrait', 'landscape'].includes(layoutFor({ width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 }).kind);

/** Exit, and the line under it that says where it goes (spec §7.1). */
function Exit({ line, onExit }: { line: string; onExit: () => void }) {
    const t = useT();
    const id = useId();
    return (
        <div className="flex flex-col items-center gap-1 text-center">
            <Button variant="quiet" aria-describedby={id} onClick={onExit}>{t.guide.exit.label}</Button>
            <p id={id} className="t-footnote text-text-2">{line}</p>
        </div>
    );
}

/** Before the deal: the 32 cards and what each is worth, in trump and out of it (D-19 lesson 1). */
function Intro({ onStart, exit }: { onStart: () => void; exit: { line: string; onExit: () => void } }) {
    const t = useT();
    const names = (ranks: readonly Rank[]) => ranks.map((rank) => t.cards.rank[rank]).join(', ');
    return (
        <div className="flex flex-col gap-4">
            <h1 className="t-display">{t.titles.learn}</h1>
            <p className="t-callout">{t.guide.intro.lead}</p>
            <p className="t-callout">{t.guide.intro.deck}</p>
            <table className="w-full text-sm border-collapse">
                <caption className="t-callout pb-1 text-left font-semibold">{t.guide.intro.caption}</caption>
                <thead>
                    <tr className="t-callout text-left text-text-2">
                        <th scope="col" className="py-1 pr-4">{t.guide.intro.card}</th>
                        <th scope="col" className="py-1 pr-4">{t.guide.intro.trump}</th>
                        <th scope="col" className="py-1">{t.guide.intro.plain}</th>
                    </tr>
                </thead>
                <tbody>
                    {TRUMP_HIGH_FIRST.map((rank) => (
                        <tr key={rank} className="border-t-2 border-edge">
                            <th scope="row" className="py-1 pr-4 text-left font-semibold">{t.cards.rank[rank]}</th>
                            <td className="py-1 pr-4">{cardPoints(rank, true)}</td>
                            <td className="py-1">{cardPoints(rank, false)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="t-callout">{t.guide.intro.trumpNote}</p>
            <p className="t-callout">{t.guide.intro.trumpOrder(names(TRUMP_HIGH_FIRST))}</p>
            <p className="t-callout">{t.guide.intro.plainOrder(names(PLAIN_HIGH_FIRST))}</p>
            <p className="t-callout">{t.guide.intro.lastTrick}</p>
            <a href="/rules#rules-cards" target="_blank" rel="noopener noreferrer" className="t-callout font-semibold text-accent">{t.guide.rules}</a>
            <Button block onClick={onStart}>{t.guide.intro.start}</Button>
            <Exit {...exit} />
        </div>
    );
}

/** Hand 1 on rails: the replay on the real board, the lesson in the board's coach slot, Exit in the game menu too. */
function GuideHand({ member, exit, onDone }: { member: boolean; exit: { line: string; onExit: () => void }; onDone: () => void }) {
    const t = useT();
    const r = useGuideReplay(HAND1);
    const { done } = r;
    useEffect(() => {
        if (done) onDone();
    }, [done, onDone]);
    const leave = { label: t.guide.exit.label, note: member ? t.guide.exit.menuHome : t.guide.exit.menuStart, onLeave: exit.onExit };
    const panel = (
        // a fresh panel per lesson: open, or folded on a phone where it would hide the card being answered
        <LessonPanel key={r.step?.index ?? -1} step={r.step} ready={r.ready} refusal={r.refusal} onNext={r.next} exitLine={exit.line} onExit={exit.onExit}
            folded={answers(r.step) && onPhone()} />
    );
    return (
        <>
            {/* one h1 per page (spec §3.9); the lesson panel names each step */}
            <h1 className="sr-only">{t.titles.learn}</h1>
            <Board state={r.state} me={HAND1.me} actions={r.actions} error={null} isConnected hands={r.hands} onLeave={exit.onExit}
                coach={{ ...r.coach, panel, leave }} />
        </>
    );
}

/** The end of hand 1 (S14 completes it): what was learned, then hand 2 against bots, Replay, or Exit. */
function End({ signedOut, onAgain, exit }: { signedOut: boolean; onAgain: () => void; exit: { line: string; onExit: () => void } }) {
    const t = useT();
    const bots = useBotGame();
    // a visitor with no session becomes a guest first, as the landing page's Botovi (decided at click time, from storage)
    const play = () => void bots.play(authService.isAuthenticated() ? undefined : () => authService.startGuest(getLang()));
    return (
        <div className="flex flex-col gap-4">
            <h1 className="t-display">{t.guide.end.title}</h1>
            <p className="t-callout">{t.guide.end.learned}</p>
            <p className="t-callout">{t.guide.end.next}</p>
            {signedOut && <p className="t-callout text-text-2">{t.guide.end.guest}</p>}
            <ErrorAlert message={bots.error} />
            <Button block loading={bots.starting} onClick={play}>{t.guide.end.play}</Button>
            <Button block variant="secondary" onClick={onAgain}>{t.guide.end.again}</Button>
            <Exit {...exit} />
        </div>
    );
}

/**
 * Škola bele (/learn, open beta §7): signed in or out, outside the shell, on the felt. The intro before the deal, hand 1
 * replayed from B8's recording on the real board, then the end of hand 1. Nothing here asks the server until the
 * learner starts hand 2. Exit goes Home for a member, to the start page for a guest or a visitor.
 */
export function LearnPage() {
    const t = useT();
    const navigate = useNavigate();
    const { isAuthenticated, isGuest } = useAuth();
    const member = isAuthenticated && !isGuest;
    const [phase, setPhase] = useState<Phase>('intro');
    usePageTitle(t.titles.learn);

    // spec §3.6: the card art decoded once, before the deal (from the CDN, no request to the server)
    useEffect(() => {
        void preloadCardArt();
    }, []);

    const exit = { line: member ? t.guide.exit.home : t.guide.exit.start, onExit: () => navigate(member ? '/dashboard' : '/') };

    if (phase === 'hand') return <GuideHand member={member} exit={exit} onDone={() => setPhase('end')} />;
    return (
        <div className="felt flex min-h-dvh items-center justify-center p-4 text-text">
            <Panel padding="lg" className="w-full max-w-md">
                {phase === 'intro'
                    ? <Intro onStart={() => setPhase('hand')} exit={exit} />
                    : <End signedOut={!isAuthenticated} onAgain={() => setPhase('intro')} exit={exit} />}
            </Panel>
        </div>
    );
}
