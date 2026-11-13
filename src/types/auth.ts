import type { Lang } from '../i18n/lang';

export interface LoginRequestDTO {
    username: string | null;
    password: string | null;
}

export interface SignupRequestDTO {
    username: string | null;
    email: string | null;
    password: string | null;
    /** spec §1.1: the language the site was in; a server before B1 ignores it. */
    language?: Lang;
    /** spec §2.2 (B7): the personal link's token, from /signup?invite=…; it admits even while signup is full. */
    waitlistToken?: string | null;
    /** spec §9 (B7, B9): this browser was a guest; sent only then. */
    wasGuest?: boolean | null;
}

export interface UserLoginDetailsDTO {
    id: string | null;
    username: string | null;
    /** spec §3 (B4): true for a guest; false or absent for a member, and from a server before B4. */
    guest?: boolean | null;
}

export interface JwtResponseDTO {
    token: string | null;
    user: UserLoginDetailsDTO | null;
    message: string | null;
    /** Ruling 32 (B4): the guest's secret, only in POST /api/auth/guest's answer; it signs the guest back in. */
    guestSecret?: string | null;
}