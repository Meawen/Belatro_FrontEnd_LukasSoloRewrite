/**
 * Ruling 32: where a guest's secret is kept on this device, beside its token ('authToken') and user ('user').
 * POST /api/auth/guest answers it once; with the guest's current name it signs the guest back in through the normal
 * sign-in (api.ts signGuestBackIn). Sign-out, a member's sign-in or sign-up, and a refused sign-in forget it.
 */
export const GUEST_SECRET_KEY = 'stiglja:guestSecret';
