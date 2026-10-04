import React, { useState } from 'react';
import { ChangePasswordForm } from './ChangePasswordForm';
import { ChangeEmailForm } from './ChangeEmailForm';
import { ResendConfirmationButton } from '../auth/ResendConfirmationButton';
import { ProfileStats } from './ProfileStats';
import { Button, ErrorAlert, Loading, Modal } from '../common';
import { useUser, useMe, notifyMeChanged } from '../../hooks/useUser';
import { useAuth } from '../../hooks/useAuth';
// direct module import (not the ../../hooks barrel) so the component test does
// not load every hook module, incl. the WebSocket ones
import { useMutation } from '../../hooks/useApi';
import { userService } from '../../services/userService';
import { errorMessage } from '../../utils/errorMessage';

export interface UserProfileProps {
    userId?: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [activeTab, setActiveTab] = useState<'stats' | 'profile'>('stats');
    const [showChangeEmail, setShowChangeEmail] = useState(false);
    const [emailNotice, setEmailNotice] = useState<string | null>(null);

    const { user: currentUser } = useAuth();

    // Always fetch user data, even for own profile to get complete data
    // Handle null case by converting to undefined
    const targetUserId = userId || (currentUser?.id ?? undefined);
    console.log('UserProfile - targetUserId:', targetUserId);

    const { user: displayUser, isLoading, error, refetch } = useUser(targetUserId);

    console.log('UserProfile - hook result:', { displayUser, isLoading, error });

    const isOwnProfile = !userId || userId === currentUser?.id;
    const { data: me, refetch: refetchMe } = useMe(isOwnProfile);
    // no address at all (e.g. a new account that changed its password before confirming): resend has nothing to send
    const emailAction = me && !me.email && !me.pendingEmail ? 'Add an email address' : 'Change Email';

    const [confirmingDeletion, setConfirmingDeletion] = useState(false);
    const [deletionError, setDeletionError] = useState<string | null>(null);
    const requestForgetMutation = useMutation(() => userService.requestForget());

    const handleRequestDeletion = async () => {
        try {
            setDeletionError(null);
            await requestForgetMutation.mutate();
            setConfirmingDeletion(false);
            // useApi's refetch rethrows: a failed refresh is not a failed request, and nothing awaits it
            refetchMe().catch(() => {});
        } catch (error) {
            setDeletionError(errorMessage(error, 'Failed to request deletion'));
        }
    };

    // If no target user ID, show authentication error
    if (!targetUserId) {
        return (
            <div className="card bg-red-900/20 border-red-500/30">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-red-400 font-semibold">Authentication Required</h3>
                        <p className="text-red-300 text-sm">Please log in to view your profile</p>
                    </div>
                </div>
            </div>
        );
    }

    // Add explicit loading check with timeout protection
    if (isLoading) {
        console.log('UserProfile - showing loading state');
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loading size="large" text="Loading profile..." />
                <div className="ml-4 text-emerald-400 text-sm">
                    Target ID: {targetUserId}
                </div>
            </div>
        );
    }

    if (error) {
        console.log('UserProfile - showing error state:', error);
        return (
            <div className="card bg-red-900/20 border-red-500/30">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-red-400 font-semibold">Error Loading Profile</h3>
                        <p className="text-red-300 text-sm">Failed to load profile information</p>
                        <p className="text-red-400 text-xs mt-1">
                            Status: {error.status} - {error.message}
                        </p>
                        <Button
                            onClick={refetch}
                            variant="outline"
                            size="small"
                            className="mt-3 border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                        >
                            Try Again
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (!displayUser) {
        console.log('UserProfile - no user data');
        return (
            <div className="card">
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">Profile Not Found</h3>
                    <p className="text-emerald-300">Profile information is not available.</p>
                    <p className="text-emerald-500 text-xs mt-2">Target ID: {targetUserId}</p>
                </div>
            </div>
        );
    }

    console.log('UserProfile - rendering profile for:', displayUser.username);

    return (
        <div className="space-y-6">
            {emailNotice && (
                <div role="status" className="card border border-emerald-500/40 text-emerald-200 text-sm">
                    {emailNotice}
                </div>
            )}

            {/* Profile Header */}
            <div className="card">
                <div className="flex items-start gap-6">
                    {/* Avatar */}
                    <div className="w-24 h-24 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center text-3xl font-bold text-emerald-900">
                        {displayUser.username?.charAt(0).toUpperCase() || '?'}
                    </div>

                    {/* User Info */}
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-4">
                            <h1 className="text-3xl font-bold text-white">
                                {displayUser.username || 'Unknown User'}
                            </h1>
                            {isOwnProfile && (
                                <div className="flex gap-2">
                                <Button
                                    onClick={() => setShowChangeEmail(true)}
                                    variant="outline"
                                    size="small"
                                    className="border-emerald-600 text-emerald-300 hover:bg-emerald-600 hover:text-white"
                                >
                                    {emailAction}
                                </Button>
                                <Button
                                    onClick={() => setShowEditProfile(true)}
                                    variant="outline"
                                    size="small"
                                    className="border-emerald-600 text-emerald-300 hover:bg-emerald-600 hover:text-white"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Change Password
                                </Button>
                                </div>
                            )}
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="bg-emerald-800/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                    </svg>
                                    <span className="text-emerald-300 text-sm font-medium">ELO Rating</span>
                                </div>
                                <div className="text-2xl font-bold text-white">
                                    {displayUser.eloRating ?? '1200'}
                                </div>
                            </div>

                            <div className="bg-emerald-800/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                    </svg>
                                    <span className="text-emerald-300 text-sm font-medium">Level</span>
                                </div>
                                <div className="text-2xl font-bold text-white">
                                    {displayUser.level ?? '1'}
                                </div>
                            </div>

                            <div className="bg-emerald-800/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <span className="text-emerald-300 text-sm font-medium">Games</span>
                                </div>
                                <div className="text-2xl font-bold text-white">
                                    {displayUser.gamesPlayed ?? '0'}
                                </div>
                            </div>
                        </div>

                        {/* Roles */}
                        {me?.roles && me.roles.length > 0 && (
                            <div className="flex items-center gap-2 mt-4">
                                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <span className="text-emerald-400 text-sm font-medium mr-2">Roles:</span>
                                <div className="flex gap-2">
                                    {me.roles.map((role, index) => (
                                        <span key={index} className="px-2 py-1 bg-amber-600/20 text-amber-400 text-xs rounded-full font-medium">
                                            {typeof role === 'string' ? role.replace('ROLE_', '') : role}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-emerald-800/30 rounded-lg p-1">
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
                        activeTab === 'stats'
                            ? 'bg-emerald-700 text-white shadow-sm'
                            : 'text-emerald-300 hover:text-white hover:bg-emerald-800/50'
                    }`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Statistics
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'stats' && (
                <ProfileStats
                    user={displayUser}
                    me={me ?? null}
                    confirmAction={
                        // keyed on the pending address: a new one starts a fresh button, not a stale "nothing to confirm"
                        <ResendConfirmationButton key={me?.pendingEmail ?? ''} onChangeEmail={() => setShowChangeEmail(true)} />
                    }
                />
            )}

            {isOwnProfile && (
                <div className="card border border-red-500/30">
                    <h3 className="text-lg font-semibold text-white mb-3">Account</h3>
                    {me?.deletionRequested ? (
                        <p className="text-amber-400 text-sm">
                            Deletion requested — an administrator will process your account removal.
                        </p>
                    ) : confirmingDeletion ? (
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="text-red-300 text-sm flex-1 min-w-[200px]">
                                Request deletion of your account? An administrator has to approve it; you can keep playing until then.
                            </p>
                            <Button variant="outline" size="small" onClick={() => setConfirmingDeletion(false)}>
                                Keep my account
                            </Button>
                            <Button
                                variant="primary"
                                size="small"
                                disabled={requestForgetMutation.isLoading}
                                isLoading={requestForgetMutation.isLoading}
                                onClick={handleRequestDeletion}
                                className="bg-red-600 hover:bg-red-500"
                            >
                                Confirm request
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            size="small"
                            onClick={() => setConfirmingDeletion(true)}
                            className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                        >
                            Request account deletion
                        </Button>
                    )}
                    <ErrorAlert message={deletionError} className="mt-2" />
                </div>
            )}

            {/* Change Password Modal */}
            {isOwnProfile && (
                <Modal
                    isOpen={showEditProfile}
                    onClose={() => setShowEditProfile(false)}
                    title="Change Password"
                >
                    <ChangePasswordForm
                        onSuccess={() => {
                            setShowEditProfile(false);
                            // a password change cancels a pending change of address
                            refetchMe().catch(() => {});
                            notifyMeChanged();
                        }}
                        onCancel={() => setShowEditProfile(false)}
                    />
                </Modal>
            )}

            {/* Change Email Modal */}
            {isOwnProfile && (
                <Modal
                    isOpen={showChangeEmail}
                    onClose={() => setShowChangeEmail(false)}
                    title={emailAction}
                >
                    <ChangeEmailForm
                        currentEmail={me?.email ?? null}
                        onSuccess={(newEmail) => {
                            setShowChangeEmail(false);
                            // the same 202 whether or not the address can be used, so no promise of a mail
                            setEmailNotice(`If this address can be used, a confirmation link is on its way to ${newEmail}. Check your inbox (and spam).`);
                            refetchMe().catch(() => {});
                            notifyMeChanged();
                        }}
                        onCancel={() => setShowChangeEmail(false)}
                    />
                </Modal>
            )}
        </div>
    );
};