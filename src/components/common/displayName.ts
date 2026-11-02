import { cat } from '../../i18n/t';

// backend util/Usernames.RESERVED_PREFIX (spec §3.1): signup and a guest's new name refuse it, so only a removed account has it
const REMOVED = 'obrisan_';

/**
 * A player's name as the site shows it (spec §3.1): a removed account (obrisan_…) reads "Gost" / "Guest", any other
 * name as it is. For display only: ids, keys, comparisons and requests keep the username itself.
 */
export function displayName(username: string): string {
    return username.startsWith(REMOVED) ? cat().guest.removed : username;
}
