import type { Lang } from '../i18n/lang';

export interface LoginRequestDTO {
    username: string | null;
    password: string | null;
}

export interface SignupRequestDTO {
    username: string | null;
    email: string | null;
    password: string | null;
    /** R-11: required by the server while SIGNUP_INVITE_CODE is set; absent otherwise. */
    inviteCode?: string | null;
    /** spec §1.1: the language the site was in; a server before B1 ignores it. */
    language?: Lang;
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