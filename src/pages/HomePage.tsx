import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common';
import { Page } from '../components/layout/Page';
import { useAuth } from '../hooks/useAuth';
import { useUser } from '../hooks/useUser';

// Today's dashboard, moved out of App.tsx unchanged; Phase 7 rewrites it as Home (spec §4.4)
// Dashboard Component
const DashboardContent = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    // GET /user/{id}: the tiles show the player's own numbers, "—" where the API gives none (R-34)
    const { user: profile } = useUser(user?.id ?? undefined);
    // a new player is level 0 in the database and Level 1 on every screen
    const level = profile ? profile.level || 1 : '—';

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
                            onClick={() => navigate('/play')}
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
                            <p data-testid="dashboard-elo" className="text-3xl font-bold text-white mt-1">{profile?.eloRating ?? '—'}</p>
                            <p className="text-emerald-400 text-xs mt-1">Your rating</p>
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
                            <p data-testid="dashboard-games" className="text-3xl font-bold text-white mt-1">{profile?.gamesPlayed ?? '—'}</p>
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
                            <p data-testid="dashboard-win-rate" className="text-3xl font-bold text-white mt-1">—</p>
                            <p className="text-emerald-400 text-xs mt-1">Not tracked yet</p>
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
                            <p className="text-emerald-300 text-sm font-medium">Level</p>
                            <p data-testid="dashboard-level" className="text-3xl font-bold text-white mt-1">{level}</p>
                            <p className="text-emerald-400 text-xs mt-1">Every player starts at 1</p>
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
                            onClick={() => navigate('/play')}
                            variant="primary"
                            className="w-full bg-amber-600 hover:bg-amber-500 text-emerald-900 font-bold justify-start"
                        >
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                            </svg>
                            Find & Play Game
                        </Button>

                        <Button
                            onClick={() => navigate('/matches')}
                            variant="outline"
                            className="w-full border-emerald-600 text-emerald-300 hover:bg-emerald-600 hover:text-white justify-start"
                        >
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            View Match History
                        </Button>

                        <Button
                            onClick={() => navigate('/users')}
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
                                onClick={() => navigate('/rules')}
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
                                onClick={() => navigate('/friends')}
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

/** /dashboard, titled "Home" (spec §4.4; R-29 amended). The content still renders its own h1. */
export function HomePage() {
    return (
        <Page title="Home" heading={null}>
            <DashboardContent />
        </Page>
    );
}
