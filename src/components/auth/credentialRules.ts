import { cat } from '../../i18n/t';

/**
 * Client-side mirror of the backend's credential rules (stiglja, roadmap C5).
 * The server enforces them; mirroring them here only saves a round trip, and the messages are the catalog's
 * `errors.rules` lines: in English the backend's own words, and the same lines serverErrors shows when the server's
 * field message is one of these rules.
 */

const MIN_PASSWORD_LENGTH = 8;
// BCrypt ignores everything after 72 bytes, so the backend refuses longer passwords.
const MAX_PASSWORD_BYTES = 72;
// backend util/Usernames.PATTERN (spec §1.5): č ć š ž đ and their capitals are letters too. The reserved obrisan_
// prefix is left to the server (USERNAME_RESERVED), which folds the name before it checks.
const USERNAME_PATTERN = /^[A-Za-z0-9_čćšžđČĆŠŽĐ]{3,20}$/;

/** Not a backend rule: the forms' loose shape check for an address; the backend's @Email decides. */
export const EMAIL_PATTERN = /\S+@\S+\.\S+/;

export function passwordRuleError(password: string): string | null {
    // code points, like the backend's codePointCount (an emoji is one character, not two)
    const tooShort = [...password].length < MIN_PASSWORD_LENGTH;
    const tooLong = new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES;
    // the backend refuses a blank password (isBlank) with the same single message
    const blank = password.trim() === '';
    return tooShort || tooLong || blank ? cat().errors.rules.password : null;
}

export function usernameRuleError(username: string): string | null {
    return USERNAME_PATTERN.test(username) ? null : cat().errors.rules.username;
}
