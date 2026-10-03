import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useMe } from '../../hooks/useUser';
import { ResendConfirmationButton } from '../auth/ResendConfirmationButton';

/** Unverified accounts may play casual, not ranked; say so on every page until confirmed. */
export const UnverifiedEmailBanner: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const { data: me, refetch } = useMe(isAuthenticated);
    // The address a resend answered 409 "Nothing to confirm" for: it can never be confirmed
    // (for example a malformed legacy value), so stop asking to confirm it.
    const [unconfirmable, setUnconfirmable] = useState<string | null>(null);

    if (!isAuthenticated || !me || me.emailVerified) return null;

    const address = me.pendingEmail ?? me.email;

    const handleNothingToConfirm = () => {
        setUnconfirmable(address);
        // or it was confirmed in another tab since this page loaded: then the banner goes
        refetch().catch(() => {});
    };

    return (
        <div
            role="region"
            aria-label="Email confirmation"
            className="bg-amber-900/30 border-b border-amber-600/40 px-6 py-3 flex flex-wrap items-center gap-3 text-sm text-amber-100"
        >
            {address ? (
                <>
                    {unconfirmable === address ? (
                        <span>Add or change your email address to play ranked.</span>
                    ) : (
                        <span>Check your inbox: confirm {address} to play ranked.</span>
                    )}
                    {/* a new address gets a fresh button, not the old one's "nothing to confirm" */}
                    <ResendConfirmationButton key={address} onNothingToConfirm={handleNothingToConfirm} />
                </>
            ) : (
                <span>
                    Add an email address to play ranked.{' '}
                    <Link to="/profile" className="underline text-amber-200 hover:text-white">Open your profile</Link>
                </span>
            )}
        </div>
    );
};
