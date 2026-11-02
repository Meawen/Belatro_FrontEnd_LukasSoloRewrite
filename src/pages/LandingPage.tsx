import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Banner, Button } from '../components/ui';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { Footer } from '../components/layout/Footer';
import { LangSwitch } from '../components/layout/LangSwitch';
import { Wordmark } from '../components/layout/Wordmark';
import { LandingDoor } from '../components/landing/LandingDoor';
import { PixelTable } from '../components/landing/PixelTable';
import { ReturningGuest } from '../components/landing/ReturningGuest';
import { useActiveGame } from '../hooks/useActiveGame';
import { useAuth } from '../hooks/useAuth';
import { useBotGame } from '../hooks/useBotGame';
import { useSignupStatus } from '../hooks/useSignupStatus';
import { useMe } from '../hooks/useUser';
import { usePageTitle } from '../routing/usePageTitle';
import { authService } from '../services/authService';
import { isExpired } from '../services/tokenRenewal';
import type { UserLoginDetailsDTO } from '../types';
import { getLang } from '../i18n/lang';
import { useT } from '../i18n/t';

/**
 * The landing page (/, spec §4, option C), for a signed-out visitor or a guest; PublicRoute sends a member to Doma.
 * Outside the shell: the wordmark, the HR · EN switch and Sign in; the headline beside a small pixel table; then three
 * doors (Škola bele, Botovi, Ljudi). A returning guest sees their name above the doors, with the way back to a game in
 * progress; after a guest session ended for good, a line there says so (Ruling 7).
 */
export function LandingPage() {
    const t = useT();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { user, isGuest, token } = useAuth();
    // A visitor made a guest here whose game then failed: useAuth keeps this mount's state (S8), so the page keeps it
    const [madeGuest, setMadeGuest] = useState<UserLoginDetailsDTO | null>(null);
    const guest = madeGuest ?? (isGuest ? user : null);
    // Never a request on an expired guest token: S8's resume answers that one first (Ruling 32), and a 401 sent before
    // it would end a guest who could come back (as ActiveGameBanner)
    const canAsk = guest !== null && !!token && !isExpired(token);
    // Ruling 7's GET /user/me: the guest's name as the server has it
    const { data: me } = useMe(canAsk);
    const { gameId, recheck } = useActiveGame(canAsk);
    const bots = useBotGame({ onAlreadyInGame: recheck });
    // Ruling 6: the Ljudi door reads the waitlist's name while signup is full; under /api/auth/, so it needn't wait for canAsk
    const signup = useSignupStatus();
    usePageTitle(t.titles.landing);

    // a visitor with no session becomes a guest first (spec §3); decided at click time from storage, not from this
    // mount's useAuth state, so a guest made here whose game then failed is never made twice. Ruling 48: the page shows
    // that guest only once the game failed to start, so its panel never flashes in above the doors while it starts
    const playBots = () => {
        const made: { user?: UserLoginDetailsDTO | null } = {};
        void bots.play(authService.isAuthenticated() ? undefined : async () => {
            made.user = (await authService.startGuest(getLang())).user;
        }).then((started) => {
            if (!started && made.user) setMadeGuest(made.user);
        });
    };

    const ended = params.get('reason') === 'guest-ended' && !guest;

    return (
        <div className="flex min-h-dvh flex-col bg-bg text-text">
            <header className="mx-auto flex w-full max-w-[880px] items-center justify-between gap-3 px-4 pt-[calc(12px+var(--safe-top))] md:px-8">
                {/* the logo, not a link: this is / */}
                <Wordmark className="t-title" />
                <div className="flex items-center gap-2">
                    <LangSwitch />
                    <Link
                        to="/login"
                        className="notch focus-inside press t-callout inline-flex min-h-11 items-center px-2 font-semibold text-text hover:text-accent"
                    >
                        {t.titles.signIn}
                    </Link>
                </div>
            </header>
            <main className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-6 px-4 pt-6 pb-12 md:px-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                        <h1 className="t-display break-words">{t.landing.headline}</h1>
                        <p className="t-body mt-2 text-text-2">{t.landing.lead}</p>
                    </div>
                    <PixelTable />
                </div>
                {ended && (
                    <Banner label={t.landing.ended.label} icon="info">
                        {t.landing.ended.body}
                    </Banner>
                )}
                {guest && <ReturningGuest name={me?.username ?? guest.username ?? ''} gameId={gameId} />}
                <section aria-label={t.landing.doors}>
                    <ul className="grid gap-4 md:grid-cols-3">
                        <li>
                            <LandingDoor icon="book" title={t.landing.learn.title} body={t.landing.learn.body} main>
                                <Button onClick={() => navigate('/learn')}>{t.landing.learn.action}</Button>
                            </LandingDoor>
                        </li>
                        <li>
                            <LandingDoor icon="robot" title={t.landing.bots.title} body={t.landing.bots.body}>
                                <Button variant="secondary" loading={bots.starting} onClick={playBots}>
                                    {t.landing.bots.action}
                                </Button>
                                <ErrorAlert message={bots.error} />
                            </LandingDoor>
                        </li>
                        <li>
                            {/* Ruling 6: every sign-up door goes to /signup, and reads the waitlist's name while signup is full */}
                            <LandingDoor icon="people" title={t.landing.people.title} body={t.landing.people.body}>
                                <Button variant="secondary" onClick={() => navigate('/signup')}>
                                    {signup === 'full' ? t.auth.waitlist.title : t.landing.people.action}
                                </Button>
                            </LandingDoor>
                        </li>
                    </ul>
                </section>
            </main>
            <Footer />
        </div>
    );
}
