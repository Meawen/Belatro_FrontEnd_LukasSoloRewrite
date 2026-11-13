/**
 * A Stol za ekipu's password, kept in this tab's session storage from its creation so the host can share it with the
 * link (spec §5). The server keeps only its hash; Privacy says the password stays in the tab until the tab closes,
 * and it is never sent anywhere. With storage off, the invite says the host knows the password.
 */
const key = (lobbyId: string) => `stiglja:table-password:${lobbyId}`;

/** Keeps the password of the table this tab just created. Never throws. */
export function rememberTablePassword(lobbyId: string, password: string): void {
    try {
        sessionStorage.setItem(key(lobbyId), password);
    } catch {
        // storage is off (private mode, quota, policy): the invite says the host knows the password
    }
}

/** The password this tab kept for the table, or null. Never throws. */
export function tablePassword(lobbyId: string): string | null {
    try {
        return sessionStorage.getItem(key(lobbyId));
    } catch {
        return null;
    }
}
