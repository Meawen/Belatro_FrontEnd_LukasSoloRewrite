import { AUTH_REQUIRED_MESSAGE, CONNECT_REFUSED_MESSAGE, SESSION_ENDED_MESSAGE } from '../services/gameSocket';
import { cat } from './t';

/**
 * The game socket's own lines in the site's language. services/gameSocket keeps them in English, since services never
 * import i18n. Anything else, and null, comes back as it is.
 */
export function localiseSocketError(s: string | null): string | null {
    if (s === SESSION_ENDED_MESSAGE) return cat().errors.socket.sessionEnded;
    if (s === CONNECT_REFUSED_MESSAGE) return cat().errors.socket.connectRefused;
    if (s === AUTH_REQUIRED_MESSAGE) return cat().errors.socket.signInNeeded;
    return s;
}
