import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { EMAIL_PATTERN, passwordRuleError, usernameRuleError } from './credentialRules';
import { AUTH_LINK } from './AuthFrame';
import { useReturnState } from './returnState';
import { cat, useT } from '../../i18n/t';

export interface SignupFormProps {
    onSuccess?: () => void;
}

/** A link inside running text (the R-40 line): underlined, in the accent. */
const TEXT_LINK = 'text-accent underline underline-offset-2 hover:text-text';

/** Create an account (spec §4.2). "Sign in" is the other URL (X-2) and carries the return path (§4.1). */
export function SignupForm({ onSuccess }: SignupFormProps) {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        inviteCode: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [createdEmail, setCreatedEmail] = useState<string | null>(null);

    const { signup, isSignupLoading } = useAuth();
    const returnState = useReturnState();
    const t = useT();

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.username.trim()) {
            newErrors.username = cat().forms.usernameRequired;
        } else {
            const usernameError = usernameRuleError(formData.username.trim());
            if (usernameError) newErrors.username = usernameError;
        }

        if (!formData.email.trim()) {
            newErrors.email = cat().forms.emailRequired;
        } else if (!EMAIL_PATTERN.test(formData.email)) {
            newErrors.email = cat().forms.emailInvalid;
        }

        if (!formData.password) {
            newErrors.password = cat().forms.passwordRequired;
        } else {
            const passwordError = passwordRuleError(formData.password);
            if (passwordError) newErrors.password = passwordError;
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = cat().auth.signUp.confirmPasswordRequired;
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = cat().forms.passwordsDontMatch;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            setErrors({}); // Clear any previous errors

            const inviteCode = formData.inviteCode.trim();
            await signup({
                // the backend validates the raw value, so stray spaces would be a 400
                username: formData.username.trim(),
                email: formData.email.trim(),
                password: formData.password,
                // R-11: the server requires it only while SIGNUP_INVITE_CODE is set; sent when typed
                ...(inviteCode ? { inviteCode } : {}),
            });

            // The account works now; the address still needs its confirmation link.
            setCreatedEmail(formData.email.trim());
        } catch (error) {
            console.error('Signup error:', error);
            // a 500 while the backend's session store is down, or no answer: not the raw text
            const status = error instanceof ApiError ? error.status : 0;
            // R-11: signup's only 403 is a missing or wrong invite code ("Invalid invite code")
            if (status === 403) {
                setErrors({ inviteCode: errorMessage(error, cat().auth.signUp.inviteCodeInvalid) });
                return;
            }
            setErrors({
                submit: isNetworkOrServerFailure(status) ? cat().errors.generic : errorMessage(error, cat().auth.signUp.failed)
            });
        }
    };

    if (createdEmail) {
        return (
            <div className="flex flex-col gap-4 text-center">
                <h1 className="t-title">{t.auth.signUp.checkInbox.heading}</h1>
                {/* The same answer comes for an address another account holds, and that one gets no
                    link (spec section 1), so this must not promise a mail. */}
                <p className="t-body text-text-2">
                    {t.auth.signUp.checkInbox.before}{' '}<strong className="text-text">{createdEmail}</strong>{t.auth.signUp.checkInbox.after}
                </p>
                <Button block onClick={() => onSuccess?.()}>
                    {t.common.continue}
                </Button>
            </div>
        );
    }

    return (
        <>
            <div className="mb-6 text-center">
                <h1 className="t-title">{t.auth.signUp.createAccount}</h1>
                <p className="t-callout mt-2 text-text-2">{t.auth.signUp.subtitle}</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                    label={t.forms.username}
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    error={errors.username}
                    placeholder={t.auth.signUp.usernamePlaceholder}
                />

                <Input
                    label={t.forms.email}
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    error={errors.email}
                    placeholder={t.forms.emailPlaceholder}
                />

                <Input
                    label={t.forms.password}
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    error={errors.password}
                    placeholder={t.auth.signUp.passwordPlaceholder}
                />

                <Input
                    label={t.auth.signUp.confirmPassword}
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    error={errors.confirmPassword}
                    placeholder={t.auth.signUp.confirmPasswordPlaceholder}
                />

                <Input
                    label={t.auth.signUp.inviteCode}
                    name="inviteCode"
                    type="text"
                    value={formData.inviteCode}
                    onChange={handleChange}
                    error={errors.inviteCode}
                    placeholder={t.auth.signUp.inviteCodePlaceholder}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                />

                <ErrorAlert message={errors.submit ?? null} />

                <Button type="submit" block loading={isSignupLoading}>
                    {isSignupLoading ? t.auth.signUp.submitting : t.auth.signUp.createAccount}
                </Button>

                {/* R-40: the pages open in a new tab, so the form keeps what was typed */}
                <p className="t-footnote text-center text-text-2">
                    {t.auth.signUp.termsBefore}{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>{t.auth.signUp.termsLink}</a>{t.auth.signUp.termsBetween}{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>{t.auth.signUp.privacyLink}</a>.
                </p>
            </form>

            <p className="t-callout mt-4 text-center text-text-2">
                {t.auth.signUp.haveAccount}{' '}
                <Link to="/login" state={returnState} className={`inline-flex min-h-11 items-center ${AUTH_LINK}`}>
                    {t.common.signIn}
                </Link>
            </p>
        </>
    );
}
