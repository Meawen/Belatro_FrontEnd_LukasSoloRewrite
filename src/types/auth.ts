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
}

export interface JwtResponseDTO {
    token: string | null;
    user: UserLoginDetailsDTO | null;
    message: string | null;
}