import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { RankedQueueProvider } from './components/game/RankedQueueProvider';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './routing/ProtectedRoute';
import { PublicRoute } from './routing/PublicRoute';
import { MemberRoute } from './routing/MemberRoute';

// One module per route (src/pages/); each page's phase owns its module
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { WaitlistConfirmPage } from './pages/WaitlistConfirmPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { RulesPage } from './pages/RulesPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { lazy, Suspense } from 'react';
import { Loader } from './components/ui/Loader';
import { useT } from './i18n/t';
// The game page and its board are their own chunks, fetched when a game opens (spec §3.8, O-5); only Škola bele's page
// (below) shares the board's
const GamePage = lazy(() => import('./pages/GamePage').then((module) => ({ default: module.GamePage })));
// Škola bele (spec §7): its own chunk, with its recording, fetched when /learn opens; signed in or out, outside the shell
const LearnPage = lazy(() => import('./pages/LearnPage').then((module) => ({ default: module.LearnPage })));
// While that chunk loads: the game page's own first frame (GamePageConnected before a socket is up)
function GameFallback() {
    const t = useT();
    return (
        <div className="felt flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-text">
            <Loader layout="block" text={t.common.loading} />
        </div>
    );
}
// The dev board playground (spec §4.17): only in dev or in a build with VITE_DEV_BOARD=1, never in production
const DevBoardPage = import.meta.env.DEV || import.meta.env.VITE_DEV_BOARD === '1' ? lazy(() => import('./dev/DevBoardPage')) : null;
import { HomePage } from './pages/HomePage';
import { PlayPage } from './pages/PlayPage';
import { LobbiesPage } from './pages/LobbiesPage';
import { LobbyPage } from './pages/LobbyPage';
import { MatchesPage } from './pages/MatchesPage';
import { MatchDetailsPage } from './pages/MatchDetailsPage';
import { ProfilePage, UserProfilePage } from './pages/ProfilePage';
import { FriendsPage } from './pages/FriendsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LandingPage } from './pages/LandingPage';

// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Router>
                {/* A render error on any page shows the boundary's fallback instead of a blank page (R-29) */}
                <ErrorBoundary fullPage>
                {/* The ranked queue outlives every page: Match Found reaches a queued player anywhere (R-33) */}
                <RankedQueueProvider>
                <Routes>
                    {/* Sign in and sign up: a member who is signed in already goes to /dashboard; a guest may sign in or sign up (spec §3.3) */}
                    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                    <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />

                    {/* Email links: reachable signed in or out */}
                    <Route path="/confirm-email" element={<ConfirmEmailPage />} />
                    <Route path="/waitlist/confirm" element={<WaitlistConfirmPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />

                    {/* Public information pages: readable signed in or out (R-40), in the public frame; Rules sits in the shell signed in (owner 2026-10-11) */}
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/rules" element={<RulesPage />} />
                    {/* Škola bele (spec §7): signed in or out, outside the shell (the fallback is the felt and "Mešamo karte…") */}
                    <Route path="/learn" element={<Suspense fallback={<GameFallback />}><LearnPage /></Suspense>} />
                    {/* The leaderboard: in the shell signed in, its prompt in the public frame signed out (M-13) */}
                    <Route path="/users" element={<LeaderboardPage />} />

                    {/* The game: signed in, outside the shell (no navigation, banners or footer: X-8, R-40) */}
                    <Route path="/game/:gameId" element={<ProtectedRoute><Suspense fallback={<GameFallback />}><GamePage /></Suspense></ProtectedRoute>} />
                    {/* The dev board (spec §4.17): outside the shell, no sign-in, dev builds only */}
                    {DevBoardPage && <Route path="/dev/board" element={<Suspense fallback={<Loader layout="page" />}><DevBoardPage /></Suspense>} />}

                    {/* spec §4: the landing page for a signed-out visitor or a guest; a member goes to Doma (PublicRoute) */}
                    <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />

                    {/* Every other signed-in page sits in the shell: navigation, banners, footer (spec §4.1) */}
                    <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
                        <Route path="/dashboard" element={<MemberRoute area="home" guestTo="/"><HomePage /></MemberRoute>} />
                        <Route path="/play" element={<MemberRoute area="ranked"><PlayPage /></MemberRoute>} />
                        <Route path="/lobbies" element={<MemberRoute area="tables"><LobbiesPage /></MemberRoute>} />
                        {/* spec §3.2: a guest reaches a table only by its link, and plays */}
                        <Route path="/lobby/:lobbyId" element={<LobbyPage />} />
                        <Route path="/matches" element={<MemberRoute area="matches"><MatchesPage /></MemberRoute>} />
                        <Route path="/matches/:id" element={<MemberRoute area="matches"><MatchDetailsPage /></MemberRoute>} />
                        <Route path="/profile" element={<MemberRoute area="profile"><ProfilePage /></MemberRoute>} />
                        <Route path="/profile/:userId" element={<MemberRoute area="profile"><UserProfilePage /></MemberRoute>} />
                        <Route path="/friends" element={<MemberRoute area="friends"><FriendsPage /></MemberRoute>} />
                        <Route path="/settings" element={<MemberRoute area="settings"><SettingsPage /></MemberRoute>} />
                        <Route path="/admin" element={<AdminPage />} />
                    </Route>

                    {/* Not found: in the shell signed in, in the public frame signed out (spec §4.16) */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
                </RankedQueueProvider>
                </ErrorBoundary>
            </Router>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}

export default App;
