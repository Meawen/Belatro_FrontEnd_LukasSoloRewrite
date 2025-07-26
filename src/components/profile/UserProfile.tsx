import React, { useState } from 'react';
import { EditProfile } from './EditProfile';
import { ProfileStats } from './ProfileStats';
import { Button, Loading, Modal } from '../common';
import { useUser } from '../../hooks/useUser';
import { useAuth } from '../../hooks/useAuth';

export interface UserProfileProps {
    userId?: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [activeTab, setActiveTab] = useState<'stats' | 'profile'>('profile');

    const { user: currentUser } = useAuth();
    const { user, isLoading, error, refetch } = useUser(userId);

    const isOwnProfile = !userId || userId === currentUser?.id;
    const displayUser = isOwnProfile ? currentUser : user;

    if (isLoading) {
        return <Loading size="large" text="Loading profile..." />;
    }

    if (error || !displayUser) {
        const errorMessage = error ? 'Failed to load profile' : 'Profile not found';

        return (
            <div className="card bg-red-900/20 border-red-500/30">
                <div className="flex items-center gap-3">
                    <div className="text-red-400 text-2xl">⚠️</div>
                    <div>
                        <h3 className="text-red-400 font-semibold">Error Loading Profile</h3>
                        <p className="text-red-300 text-sm">{errorMessage}</p>
                    </div>
                </div>
                <Button
                    onClick={refetch}
                    variant="outline"
                    size="small"
                    className="mt-4"
                >
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Profile Header */}
            <div className="card">
                <div className="flex items-start gap-6">
                    {/* Avatar */}
                    <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center text-3xl font-bold text-white">
                        {displayUser.username?.charAt(0).toUpperCase() || '?'}
                    </div>

                    {/* User Info */}
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold text-white">
                                {displayUser.username || 'Unknown User'}
                            </h1>
                            {isOwnProfile && (
                                <Button
                                    onClick={() => setShowEditProfile(true)}
                                    variant="outline"
                                    size="small"
                                >
                                    ✏️ Edit
                                </Button>
                            )}
                        </div>

                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-4">
                                <span className="text-slate-400">ELO Rating:</span>
                                <span className="text-purple-400 font-bold text-lg">
                  {displayUser.eloRating || 1200}
                </span>
                            </div>

                            <div className="flex items-center gap-4">
                                <span className="text-slate-400">Level:</span>
                                <span className="text-blue-400 font-medium">
                  {displayUser.level || 1} ({displayUser.expPoints || 0} XP)
                </span>
                            </div>

                            <div className="flex items-center gap-4">
                                <span className="text-slate-400">Games Played:</span>
                                <span className="text-white font-medium">
                  {displayUser.gamesPlayed || 0}
                </span>
                            </div>

                            {displayUser.lastLogin && (
                                <div className="flex items-center gap-4">
                                    <span className="text-slate-400">Last Login:</span>
                                    <span className="text-slate-300">
                    {new Date(displayUser.lastLogin).toLocaleString()}
                  </span>
                                </div>
                            )}

                            {displayUser.roles && displayUser.roles.length > 0 && (
                                <div className="flex items-center gap-2 mt-3">
                                    <span className="text-slate-400">Roles:</span>
                                    <div className="flex gap-1">
                                        {displayUser.roles.map((role, index) => (
                                            <span key={index} className="badge badge-purple text-xs">
                        {role.replace('ROLE_', '')}
                      </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-4 border-b border-slate-700">
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`pb-2 px-1 font-medium transition-colors ${
                        activeTab === 'profile'
                            ? 'text-purple-400 border-b-2 border-purple-400'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    📊 Statistics
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'profile' && (
                <ProfileStats user={displayUser} isOwnProfile={isOwnProfile} />
            )}

            {/* Edit Profile Modal */}
            {isOwnProfile && (
                <Modal
                    isOpen={showEditProfile}
                    onClose={() => setShowEditProfile(false)}
                    title="Edit Profile"
                >
                    <EditProfile
                        user={displayUser}
                        onSuccess={() => {
                            setShowEditProfile(false);
                            refetch();
                        }}
                        onCancel={() => setShowEditProfile(false)}
                    />
                </Modal>
            )}
        </div>
    );
};