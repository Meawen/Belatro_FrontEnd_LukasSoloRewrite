/**
 * Client-side mirror of the backend's credential rules (stiglja, roadmap C5).
 * The server enforces them; mirroring them here only saves a round trip, so the
 * messages are the backend's own, word for word.
 */

/** backend.belatro.validation.ValidPassword */
export const PASSWORD_RULE_MESSAGE = 'Password must be at least 8 characters and at most 72 bytes';

/** SignupRequestDTO.username @Pattern */
export const USERNAME_RULE_MESSAGE = 'Username must be 3-20 characters: letters, digits or underscore';

const MIN_PASSWORD_LENGTH = 8;
// BCrypt ignores everything after 72 bytes, so the backend refuses longer passwords.
const MAX_PASSWORD_BYTES = 72;
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

export function passwordRuleError(password: string): string | null {
    // code points, like the backend's codePointCount (an emoji is one character, not two)
    const tooShort = [...password].length < MIN_PASSWORD_LENGTH;
    const tooLong = new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES;
    return tooShort || tooLong ? PASSWORD_RULE_MESSAGE : null;
}

export function usernameRuleError(username: string): string | null {
    return USERNAME_PATTERN.test(username) ? null : USERNAME_RULE_MESSAGE;
}
