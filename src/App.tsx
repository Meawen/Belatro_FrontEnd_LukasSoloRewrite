import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Layout Components
import { AppLayout } from './components/layout/AppLayout';
import { PageLayout } from './components/layout/PageLayout';
import { MockGameBoard } from './MockComponents/MockGameBoard';
import { RealisticGameBoard } from './MockComponents/RealisticGameBoard'; // Add this import


// Page Components
import { UserProfile } from './components/profile';
import { UserList } from './components/profile/UserList';
import { MatchHistory } from './components/match/MatchHistory';
import { AuthPage } from './components/auth/AuthPage';
import { LobbyList } from './components/lobby/LobbyList';
import { LobbyDetails } from './components/lobby/LobbyDetails';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { FriendsList } from './components/profile/FriendList';
import { PlayPage } from './components/game/PlayPage'; // Add this import

// Common Components
import { Button, Loading } from './components/common';

// Hooks
import { useAuth } from './hooks/useAuth';
import GamePageConnected from './components/game/GamePageConnected';

// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

// Protected Route wrapper
interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-emerald-950 flex items-center justify-center">
                <Loading size="large" text="Checking authentication..." />
            </div>
        );
    }

    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Public Route wrapper (redirects to dashboard if already authenticated)
interface PublicRouteProps {
    children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-emerald-950 flex items-center justify-center">
                <Loading size="large" text="Loading..." />
            </div>
        );
    }

    return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
};

// Dashboard Component
const DashboardContent = () => {
    const { user } = useAuth();

    return (
        <div className="space-y-6">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-emerald-900 to-green-800 rounded-lg p-6 border border-emerald-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center text-emerald-900 font-bold text-xl">
                            {user?.username?.charAt(0).toUpperCase() || 'P'}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">
                                Welcome back, {user?.username || 'Player'}!
                            </h1>
                            <p className="text-emerald-200 mt-1">Ready to play some Belot?</p>
                        </div>
                    </div>
                    <div className="hidden md:block">
                        <Button
                            onClick={() => window.location.href = '/play'}
                            variant="primary"
                            className="bg-amber-600 hover:bg-amber-500 text-emerald-900 font-bold px-6 py-3"
                        >
                            Find Game
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="card group hover:bg-emerald-800 transition-colors">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-emerald-300 text-sm font-medium">ELO Rating</p>
                            <p className="text-3xl font-bold text-white mt-1">1200</p>
                            <p className="text-emerald-400 text-xs mt-1">Default rating</p>
                        </div>
                        <div className="w-12 h-12 bg-amber-600/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="card group hover:bg-emerald-800 transition-colors">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-emerald-300 text-sm font-medium">Games Played</p>
                            <p className="text-3xl font-bold text-white mt-1">0</p>
                            <p className="text-emerald-400 text-xs mt-1">Start your journey</p>
                        </div>
                        <div className="w-12 h-12 bg-emerald-600/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="card group hover:bg-emerald-800 transition-colors">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-emerald-300 text-sm font-medium">Win Rate</p>
                            <p className="text-3xl font-bold text-white mt-1">--%</p>
                            <p className="text-emerald-400 text-xs mt-1">Play to see stats</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="card group hover:bg-emerald-800 transition-colors">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-emerald-300 text-sm font-medium">Rank</p>
                            <p className="text-3xl font-bold text-white mt-1">Beginner</p>
                            <p className="text-emerald-400 text-xs mt-1">Level 1</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Quick Actions
                    </h3>
                    <div className="space-y-3">
                        <Button
                            onClick={() => window.location.href = '/play'}
                            variant="primary"
                            className="w-full bg-amber-600 hover:bg-amber-500 text-emerald-900 font-bold justify-start"
                        >
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                            </svg>
                            Find & Play Game
                        </Button>

                        <Button
                            onClick={() => window.location.href = '/matches'}
                            variant="outline"
                            className="w-full border-emerald-600 text-emerald-300 hover:bg-emerald-600 hover:text-white justify-start"
                        >
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            View Match History
                        </Button>

                        <Button
                            onClick={() => window.location.href = '/users'}
                            variant="outline"
                            className="w-full border-emerald-600 text-emerald-300 hover:bg-emerald-600 hover:text-white justify-start"
                        >
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            View Leaderboard
                        </Button>
                    </div>
                </div>

                <div className="card">
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Getting Started
                    </h3>
                    <div className="space-y-4">
                        <div className="bg-emerald-800 rounded-lg p-4">
                            <h4 className="text-white font-medium mb-2">New to Belot?</h4>
                            <p className="text-emerald-300 text-sm mb-3">
                                Learn the rules and strategies of this classic card game.
                            </p>
                            <Button
                                onClick={() => window.location.href = '/guide'}
                                variant="outline"
                                size="small"
                                className="border-amber-600 text-amber-400 hover:bg-amber-600 hover:text-emerald-900"
                            >
                                Read Guide
                            </Button>
                        </div>

                        <div className="bg-emerald-800 rounded-lg p-4">
                            <h4 className="text-white font-medium mb-2">Connect with Friends</h4>
                            <p className="text-emerald-300 text-sm mb-3">
                                Add friends and challenge them to private games.
                            </p>
                            <Button
                                onClick={() => window.location.href = '/friends'}
                                variant="outline"
                                size="small"
                                className="border-emerald-600 text-emerald-300 hover:bg-emerald-600 hover:text-white"
                            >
                                Manage Friends
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Individual Page Components
const DashboardPage = () => (
    <PageLayout title="Dashboard" subtitle="Welcome back! Here's your gaming overview">
        <DashboardContent />
    </PageLayout>
);


const PlayGamePage = () => (
    <PageLayout>
        <PlayPage />
    </PageLayout>
);

const LobbiesPage = () => (
    <PageLayout title="Game Lobbies" subtitle="Find and join active game lobbies">
        <LobbyList />
    </PageLayout>
);

const LobbyPage = () => {
    const { lobbyId } = useParams<{ lobbyId: string }>();

    return (
        <PageLayout title="Lobby" subtitle="Pick your team; the host starts the match">
            <LobbyDetails lobbyId={lobbyId ?? ''} />
        </PageLayout>
    );
};

const ProfilePage = () => {
    const { user } = useAuth();

    return (
        <PageLayout
            title="Your Profile"
            subtitle="Manage your account and view your stats"
        >
            <UserProfile userId={user?.id || undefined} />
        </PageLayout>
    );
};

const UserProfilePage = () => {
    const { userId } = useParams<{ userId: string }>();

    return (
        <PageLayout
            title="User Profile"
            subtitle="View player information and statistics"
        >
            <UserProfile userId={userId} />
        </PageLayout>
    );
};

const FriendsPage = () => (
    <PageLayout title="Friends" subtitle="Manage your friends and social connections">
        <FriendsList />
    </PageLayout>
);

const UsersPage = () => {
    const { isAuthenticated } = useAuth();

    return (
        <PageLayout title="All Users" subtitle="Browse and connect with other players">
            {isAuthenticated ? (
                <UserList />
            ) : (
                <div className="card">
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Authentication Required</h3>
                        <p className="text-emerald-300 mb-6">Please log in to view the user leaderboard.</p>
                        <div className="space-x-4">
                            <Button
                                onClick={() => window.location.href = '/login'}
                                variant="primary"
                                size="medium"
                                className="bg-amber-600 hover:bg-amber-500 text-emerald-900 font-bold"
                            >
                                Login
                            </Button>
                            <Button
                                onClick={() => window.location.href = '/signup'}
                                variant="outline"
                                size="medium"
                                className="border-emerald-600 text-emerald-300 hover:bg-emerald-600 hover:text-white"
                            >
                                Sign Up
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </PageLayout>
    );
};

const MatchesPage = () => (
    <PageLayout title="Match History" subtitle="Review your past games and performance">
        <MatchHistory />
    </PageLayout>
);

const SettingsPage = () => (
    <PageLayout title="Settings" subtitle="Customize your gaming experience">
        <div className="card">
            <div className="text-center py-12">
                <div className="w-16 h-16 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Settings Coming Soon</h3>
                <p className="text-emerald-300">Settings panel is currently under development.</p>
            </div>
        </div>
    </PageLayout>
);

const AdminPage = () => (
    <PageLayout title="Admin Panel" subtitle="System administration and management">
        <AdminDashboard />
    </PageLayout>
);

const NotFoundPage = () => (
    <div className="min-h-screen bg-emerald-950 flex items-center justify-center">
        <div className="text-center">
            <div className="text-6xl font-bold text-amber-500 mb-4">404</div>
            <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
            <p className="text-emerald-300 mb-6">The page you're looking for doesn't exist.</p>
            <Button
                onClick={() => window.location.href = '/dashboard'}
                variant="primary"
                size="medium"
                className="bg-amber-600 hover:bg-amber-500 text-emerald-900 font-bold"
            >
                Go to Dashboard
            </Button>
        </div>
    </div>
);

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Router>
                <Routes>
                    {/* Public Routes - AuthPage handles both login and signup internally */}
                    <Route path="/login" element={
                        <PublicRoute>
                            <AuthPage initialMode="login" redirectTo="/dashboard" />
                        </PublicRoute>
                    } />
                    <Route path="/signup" element={
                        <PublicRoute>
                            <AuthPage initialMode="signup" redirectTo="/dashboard" />
                        </PublicRoute>
                    } />

                    {/* Protected Routes - Using AppLayout with Sidebar enabled */}
                    <Route path="/" element={
                        <ProtectedRoute>
                            <AppLayout showSidebar={true}>
                                <Navigate to="/dashboard" replace />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/dashboard" element={
                        <ProtectedRoute>
                            <AppLayout showSidebar={true}>
                                <DashboardPage />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/play" element={
                        <ProtectedRoute>
                            <AppLayout showSidebar={true}>
                                <PlayGamePage />
                            </AppLayout>
                        </ProtectedRoute>
                    } />
                    <Route path="/play/mock" element={
                        <ProtectedRoute>
                            <AppLayout showSidebar={true}>
                                <PageLayout title="Game Development" subtitle="Mock game board for testing">
                                    <MockGameBoard />
                                </PageLayout>
                            </AppLayout>
                        </ProtectedRoute>
                    } />
                    <Route path="/play/realistic" element={
                        <ProtectedRoute>
                            <AppLayout showSidebar={true}>
                                <PageLayout title="Realistic Game Demo" subtitle="Experience a full Belot game with animations">
                                    <RealisticGameBoard />
                                </PageLayout>
                            </AppLayout>
                        </ProtectedRoute>
                    } />
                    <Route
                        path="/game/:gameId"
                        element={
                            <ProtectedRoute>
                                {/* Hide the main sidebar for the in-game view */}
                                <AppLayout showSidebar={false}>
                                    <GamePageConnected />  {/* Game page component connected via WebSocket */}
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />



                    <Route path="/lobbies" element={
                        <ProtectedRoute>
                            <AppLayout showSidebar={true}>
                                <LobbiesPage />
                            </AppLayout>
                        </ProtectedRoute>
                    } />
                    <Route path="/lobby/:lobbyId" element={
                        <ProtectedRoute>
                            <AppLayout showSidebar={true}>
                                <LobbyPage />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/profile" element={
                        <ProtectedRoute>
                            <AppLayout showSidebar={true}>
                                <ProfilePage />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/profile/:userId" element={
                        <ProtectedRoute>
                            <AppLayout showSidebar={true}>
                                <UserProfilePage />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/friends" element={
                        <ProtectedRoute>
                            <AppLayout showSidebar={true}>
                                <FriendsPage />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/users" element={
                        <AppLayout showSidebar={true}>
                            <UsersPage />
                        </AppLayout>
                    } />

                    <Route path="/matches" element={
                        <ProtectedRoute>
                            <AppLayout showSidebar={true}>
                                <MatchesPage />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/settings" element={
                        <ProtectedRoute>
                            <AppLayout showSidebar={true}>
                                <SettingsPage />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/admin" element={
                        <ProtectedRoute>
                            <AppLayout showSidebar={true}>
                                <AdminPage />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    {/* 404 Page */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </Router>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}

export default App;