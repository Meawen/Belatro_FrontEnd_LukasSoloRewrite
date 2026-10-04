import React, { useRef, useState } from 'react';
import { Button, ErrorAlert, Input } from '../common';
// direct module import (not the ../../hooks barrel): keeps component tests from
// loading every hook module, incl. the WebSocket ones
import { useMutation } from '../../hooks/useApi';
import { userService } from '../../services/userService';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import type { ChangeEmailRequest } from '../../types/user';
import { EMAIL_PATTERN } from '../auth/credentialRules';

export interface ChangeEmailFormProps {
    /** The address in force; null when the account has none (the form then adds one). */
    currentEmail: string | null;
    onSuccess: (newEmail: string) => void;
    onCancel: () => void;
}

export const ChangeEmailForm: React.FC<ChangeEmailFormProps> = ({ currentEmail, onSuccess, onCancel }) => {
    const [newEmail, setNewEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    // stops a second submit that lands before React re-renders the button as disabled
    const sending = useRef(false);

    const changeEmailMutation = useMutation((request: ChangeEmailRequest) => userService.changeEmail(request));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (sending.current) return;
        const address = newEmail.trim();
        const newErrors: Record<string, string> = {};
        if (!address) {
            newErrors.newEmail = 'New email address is required';
        } else if (!EMAIL_PATTERN.test(address)) {
            newErrors.newEmail = 'Email is invalid';
        } else if (address.toLowerCase() === currentEmail) {
            // the backend's rule: the new address, trimmed and lower-cased, against the stored one
            // as stored, so a legacy mixed-case address can still be changed to its normalised spelling
            newErrors.newEmail = 'That is already your email address';
        }
        if (!currentPassword) {
            newErrors.currentPassword = 'Current password is required';
        }
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        sending.current = true;
        try {
            setErrors({});
            await changeEmailMutation.mutate({ newEmail: address, currentPassword });
            onSuccess(address);
        } catch (error) {
            // sent with keepTokenOn401: a 401 that is not the session's own is the wrong password
            if (error instanceof ApiError && error.status === 401 && !error.invalidToken) {
                setErrors({ submit: 'Current password is incorrect' });
            } else if (isNetworkOrServerFailure(error instanceof ApiError ? error.status : 0)) {
                setErrors({ submit: 'We could not change your email address. Try again.' });
            } else {
                setErrors({ submit: errorMessage(error, 'Failed to change the email address') });
            }
        } finally {
            sending.current = false;
        }
    };

    // noValidate: the form renders its own inline errors below each field, so
    // native browser constraint bubbles must not pre-empt handleSubmit
    return (
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <Input
                label="New email address"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                error={errors.newEmail}
                placeholder="you@example.com"
            />
            <Input
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                error={errors.currentPassword}
                placeholder="Enter current password..."
            />

            {/* No promise of a mail: an address another account holds is accepted the same way, but never mailed. */}
            <p className="text-sm text-slate-400">
                If the address can be used, we send a confirmation link to it.
                {currentEmail && ' Your current address stays in use until you confirm.'}
            </p>

            <ErrorAlert message={errors.submit ?? null} />

            <div className="flex gap-3 pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={changeEmailMutation.isLoading}
                    className="flex-1"
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={changeEmailMutation.isLoading}
                    isLoading={changeEmailMutation.isLoading}
                    className="flex-1"
                >
                    Send confirmation link
                </Button>
            </div>
        </form>
    );
};
