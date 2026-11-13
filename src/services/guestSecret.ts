/**
 * Ruling 32: where a guest's secret is kept on this device, beside its token ('authToken') and user ('user').
 * POST /api/auth/guest answers it once; with the guest's current name it signs the guest back in through the normal
 * sign-in (api.ts signGuestBackIn). Sign-out, a member's sign-in or sign-up, and a refused sign-in forget it.
 */
export const GUEST_SECRET_KEY = 'stiglja:guestSecret';

/**
 * Forgets this browser's session whole: its token, its user and a guest's secret (Ruling 44: one helper, so no path
 * that clears the session leaves the secret behind). Sign-out, a stored session that can't be read, a password reset
 * and a guest's end (gameSocket.endGuestSession) use it. A member whose session the server ended keeps its user:
 * gameSocket.signOutToLogin clears only the token, and says why.
 */
export function forgetSession(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem(GUEST_SECRET_KEY);
}
