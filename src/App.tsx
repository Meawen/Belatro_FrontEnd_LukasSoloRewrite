import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { RankedQueueProvider } from './components/game/RankedQueueProvider';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './routing/ProtectedRoute';
import { PublicRoute } from './routing/PublicRoute';

// One module per route (src/pages/); each page's phase owns its module
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { RulesPage } from './pages/RulesPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { lazy, Suspense } from 'react';
import { Loader } from './components/ui/Loader';
// The game page and its board are their own chunk, fetched when a game opens (spec §3.8, O-5): no other page loads them
const GamePage = lazy(() => import('./pages/GamePage').then((module) => ({ default: module.GamePage })));
// While that chunk loads: the game page's own first frame (GamePageConnected before a socket is up)
const gameFallback = (
    <div className="felt flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-text">
        <Loader layout="block" text="Connecting to game..." />
    </div>
);
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
                    {/* Sign in and sign up: a visitor who is signed in already goes to /dashboard */}
                    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                    <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />

                    {/* Email links: reachable signed in or out */}
                    <Route path="/confirm-email" element={<ConfirmEmailPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />

                    {/* Public information pages: readable signed in or out (R-40), in the public frame */}
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/rules" element={<RulesPage />} />
                    {/* The leaderboard: in the shell signed in, its prompt in the public frame signed out (M-13) */}
                    <Route path="/users" element={<LeaderboardPage />} />

                    {/* The game: signed in, outside the shell (no navigation, banners or footer: X-8, R-40) */}
                    <Route path="/game/:gameId" element={<ProtectedRoute><Suspense fallback={gameFallback}><GamePage /></Suspense></ProtectedRoute>} />
                    {/* The dev board (spec §4.17): outside the shell, no sign-in, dev builds only */}
                    {DevBoardPage && <Route path="/dev/board" element={<Suspense fallback={<Loader layout="page" />}><DevBoardPage /></Suspense>} />}

                    <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />

                    {/* Every other signed-in page sits in the shell: navigation, banners, footer (spec §4.1) */}
                    <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
                        <Route path="/dashboard" element={<HomePage />} />
                        <Route path="/play" element={<PlayPage />} />
                        <Route path="/lobbies" element={<LobbiesPage />} />
                        <Route path="/lobby/:lobbyId" element={<LobbyPage />} />
                        <Route path="/matches" element={<MatchesPage />} />
                        <Route path="/matches/:id" element={<MatchDetailsPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/profile/:userId" element={<UserProfilePage />} />
                        <Route path="/friends" element={<FriendsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
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
