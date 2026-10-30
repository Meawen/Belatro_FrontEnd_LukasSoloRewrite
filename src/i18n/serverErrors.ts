import type { ApiError } from '../services/api';
import type { Catalog } from './catalog/types';
import { getLang } from './lang';
import { cat } from './t';

/** A code the catalogs have a line for: the backend's REST codes and the game's refusals. */
export type ErrorCode = keyof Catalog['errors']['codes'];

// Never call cat() at module top level (see t.ts). These lists are the server's own English, matched by text.

/** The two credential rules' field messages (backend ValidPassword; SignupRequestDTO.username @Pattern). */
const RULE_SENTENCES = new Map<string, keyof Catalog['errors']['rules']>([
    ['Password must be at least 8 characters and at most 72 bytes', 'password'],
    ['Username must be 3–20 characters: letters (including č ć š ž đ), digits or _', 'username'],
]);

/**
 * What /user/queue/errors sends (backend ErrorCodesTest.STOMP_SENTENCES and STOMP_PREFIXES): plain strings with no
 * code, so the SPA maps them by their text. A sentence the backend adds fails its ErrorCodesTest until listed there.
 */
const STOMP_SENTENCES = new Map<string, ErrorCode>([
    ['Game not found', 'GAME_NOT_FOUND'],
    ["You can't challenge now", 'CANT_CHALLENGE'],
    ['Declarations are being said', 'DECLARATIONS_BEING_SAID'],
    ['The dealer must call trump', 'DEALER_MUST_CALL'],
    ['Wait for the post-hand pause to end', 'WAIT_FOR_PAUSE'],
]);
const STOMP_PREFIXES: [string, ErrorCode][] = [
    ['Not a participant in game ', 'NOT_A_PARTICIPANT'],
    ['Rematch is not available for game ', 'REMATCH_UNAVAILABLE'],
];

/** The decline cooldown's seconds, at the end of its sentence ("… you can queue again in 97 s"). */
const SECONDS = /(\d+) s$/;

function isCode(code: string | undefined): code is ErrorCode {
    return code !== undefined && Object.hasOwn(cat().errors.codes, code);
}

/** The code's line, or null when the line needs a number the sentence doesn't carry. */
function lineFor(code: ErrorCode, sentence: string): string | null {
    const line = cat().errors.codes[code];
    if (typeof line === 'string') return line;
    const seconds = SECONDS.exec(sentence);
    return seconds ? line(Number(seconds[1])) : null;
}

/** Nothing to map: Croatian says the generic line, English keeps the server's own sentence. */
function unmapped(sentence: string): string {
    return getLang() === 'en' ? sentence : cat().errors.generic;
}

/** An API error in the site's language (spec §1.1, §8). */
export function localiseApiError(err: ApiError): string {
    const rule = RULE_SENTENCES.get(err.message);
    if (rule) return cat().errors.rules[rule];
    const line = isCode(err.code) ? lineFor(err.code, err.message) : null;
    return line ?? unmapped(err.message);
}

/**
 * Sign-in's refusal (Ruling 16): Spring Security translates "Bad credentials" by Accept-Language, a translation has
 * no entry in the server's table, so it arrives as HTTP_401. At sign-in a 401 is a wrong name or password.
 */
export function localiseLoginError(err: ApiError): string {
    return err.code === 'HTTP_401' ? cat().errors.codes.BAD_CREDENTIALS : localiseApiError(err);
}

/** The code of a sentence /user/queue/errors sent, or null for one the SPA doesn't know. */
export function stompErrorCode(s: string): ErrorCode | null {
    return STOMP_SENTENCES.get(s) ?? STOMP_PREFIXES.find(([start]) => s.startsWith(start))?.[1] ?? null;
}

/** A refused move or Play again, in the site's language. */
export function localiseStompError(sentence: string): string {
    const code = stompErrorCode(sentence);
    return (code ? lineFor(code, sentence) : null) ?? unmapped(sentence);
}
