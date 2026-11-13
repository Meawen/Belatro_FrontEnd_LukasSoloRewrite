// after lower-casing, so Č and č alike
const PLAIN: Readonly<Record<string, string>> = { č: 'c', ć: 'c', š: 's', ž: 'z', đ: 'd' };

/**
 * Lower case, with the marks taken off č ć š ž đ: the backend's Usernames.fold (spec §1.5), so a search for "matic"
 * or "duro" finds "matić" and "đuro" as the server's player search does. Every other character is kept.
 */
export function fold(text: string): string {
    return text.toLowerCase().replace(/[čćšžđ]/g, (letter) => PLAIN[letter]);
}
