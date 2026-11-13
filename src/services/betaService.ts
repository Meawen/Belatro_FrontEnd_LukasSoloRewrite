import { apiClient } from './api';
import type { Lang } from '../i18n/lang';

/** GET /api/auth/signup-status (open beta §2.2, B7): whether the open form takes signups now. */
export interface SignupStatusAnswer {
    open: boolean;
}

/** One Europe/Zagreb day's totals in GET /admin/beta's counts (open beta spec §9; B9's BetaCountsDTO.Day). */
export interface BetaDay {
    day: string; // yyyy-MM-dd, a Zagreb date
    casualWithHumans: number;
    ranked: number;
    guideStarted: number;
    guideHand1: number;
    guideHand2: number;
    guestSignups: number;
    invitesSent: number;
    invitesUsed: number;
}

/** GET /admin/beta's counts (spec §9, B9): the 7- and 28-day numbers end today, in Zagreb days; perDay is 14 days, oldest first. */
export interface BetaCounts {
    returning7: number;
    returning28: number;
    casualWithHumans7: number;
    ranked7: number;
    guideStarted7: number;
    guideHand1_7: number;
    guideHand2_7: number;
    guestSignups7: number;
    invitesSent7: number;
    invitesUsed7: number;
    perDay: BetaDay[];
}

/** GET /admin/beta (open beta §2.2; B7): the cap (null: none) and the four numbers. B9 appends its counts (S15). */
export interface BetaAdmin {
    cap: number | null;
    accounts: number;
    waiting: number;
    unconfirmed: number;
    invitesOutstanding: number;
    /** spec §9 (B9): the beta's counts; an older backend sends none, and the panel shows no counts. */
    counts?: BetaCounts | null;
}

/** The signup cap and the waitlist (spec §2): the sign-up doors, /signup, /waitlist/confirm and Admin. */
export const betaService = {
    signupStatus(): Promise<SignupStatusAnswer> {
        return apiClient.get<SignupStatusAnswer>('/api/auth/signup-status');
    },
    // 202 for every address, listed or not (B7): nothing in the answer says which
    async joinWaitlist(email: string, language: Lang): Promise<void> {
        await apiClient.post<void>('/api/auth/waitlist', { email, language });
    },
    // 204, a second click too; 400 WAITLIST_LINK_INVALID for an expired or unknown link (Ruling 42)
    async confirmWaitlist(token: string): Promise<void> {
        await apiClient.post<void>('/api/auth/waitlist/confirm', { token });
    },
    getBeta(): Promise<BetaAdmin> {
        return apiClient.get<BetaAdmin>('/admin/beta');
    },
    // null removes the cap; the answer is the fresh numbers, after the next people waiting were emailed (D-10)
    setCap(cap: number | null): Promise<BetaAdmin> {
        return apiClient.put<BetaAdmin>('/admin/beta/cap', { cap });
    },
};
