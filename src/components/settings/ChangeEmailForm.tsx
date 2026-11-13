import React, { useRef, useState } from 'react';
import { Button, Input } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
// direct module import (not the ../../hooks barrel): keeps component tests from
// loading every hook module, incl. the WebSocket ones
import { useMutation } from '../../hooks/useApi';
import { userService } from '../../services/userService';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import type { ChangeEmailRequest } from '../../types/user';
import { EMAIL_PATTERN } from '../auth/credentialRules';
import { cat, useT } from '../../i18n/t';

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
    const t = useT();

    const changeEmailMutation = useMutation((request: ChangeEmailRequest) => userService.changeEmail(request));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (sending.current) return;
        const address = newEmail.trim();
        const newErrors: Record<string, string> = {};
        if (!address) {
            newErrors.newEmail = cat().settings.changeEmail.newEmailRequired;
        } else if (!EMAIL_PATTERN.test(address)) {
            newErrors.newEmail = cat().forms.emailInvalid;
        } else if (address.toLowerCase() === currentEmail) {
            // the backend's rule: the new address, trimmed and lower-cased, against the stored one
            // as stored, so a legacy mixed-case address can still be changed to its normalised spelling
            newErrors.newEmail = cat().errors.codes.EMAIL_UNCHANGED;
        }
        if (!currentPassword) {
            newErrors.currentPassword = cat().forms.currentPasswordRequired;
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
                setErrors({ submit: cat().errors.codes.WRONG_PASSWORD });
            } else if (isNetworkOrServerFailure(error instanceof ApiError ? error.status : 0)) {
                setErrors({ submit: cat().settings.changeEmail.notChanged });
            } else {
                setErrors({ submit: errorMessage(error, cat().settings.changeEmail.failed) });
            }
        } finally {
            sending.current = false;
        }
    };

    // noValidate: the form renders its own inline errors below each field, so
    // native browser constraint bubbles must not pre-empt handleSubmit
    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <Input
                label={t.settings.changeEmail.newEmail}
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                error={errors.newEmail}
                placeholder={t.settings.changeEmail.newEmailPlaceholder}
            />
            <Input
                label={t.settings.changeEmail.currentPassword}
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                error={errors.currentPassword}
                placeholder={t.forms.currentPasswordPlaceholder}
            />

            {/* No promise of a mail: an address another account holds is accepted the same way, but never mailed. */}
            <p className="t-footnote text-text-2">
                {t.settings.changeEmail.note}
                {currentEmail && ` ${t.settings.changeEmail.keepNote}`}
            </p>

            <ErrorAlert message={errors.submit ?? null} />

            <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={onCancel} disabled={changeEmailMutation.isLoading}>
                    {t.common.cancel}
                </Button>
                <Button type="submit" loading={changeEmailMutation.isLoading}>
                    {t.settings.changeEmail.submit}
                </Button>
            </div>
        </form>
    );
};
