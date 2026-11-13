import { googleClientId } from '../config';
import type { Lang } from '../i18n/lang';

/**
 * Google sign-in in the browser (Google sign-in spec §1, §6.3): Google's script, loaded on demand by the pages that show
 * the button (never in index.html), its button, the address in its ID token, and a new account's pending credential
 * (P-1). The ID token and the address are never logged (spec §6.1), and never stored.
 */

/** The client id, or null: no Google anywhere (src/config.ts reads it). The Google feature imports it from here. */
export { googleClientId };

/** Google Identity Services: the script that draws Google's button and hands over the ID token. */
export const GSI_URL = 'https://accounts.google.com/gsi/client';

/** A script with no answer by then counts as blocked (spec §6.3). */
const GSI_TIMEOUT_MS = 10_000;

/** The two calls this site makes (developers.google.com/identity/gsi/web/reference/js-reference). */
interface GoogleId {
    initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
    renderButton(parent: HTMLElement, options: {
        type: 'standard';
        theme: 'outline';
        size: 'large';
        text: 'continue_with';
        locale: Lang;
        /** The button's width in pixels, 400 at most; Google's own when left out. */
        width?: string;
    }): void;
}

declare global {
    interface Window {
        google?: { accounts?: { id?: GoogleId } };
    }
}

const loadedGoogle = (): GoogleId | undefined => window.google?.accounts?.id;

// the load in flight, shared by everyone who asks; cleared when it settles, so a failed one is tried again (as t.ts)
let loading: Promise<void> | null = null;

/**
 * Google's script, once per page. Rejects when it fails to load (a blocker), loads without google.accounts.id (a
 * blocker's stand-in), or has no answer in 10 s; the tag goes, and the next call loads it again.
 */
export function loadGoogle(): Promise<void> {
    if (loadedGoogle()) return Promise.resolve();
    loading ??= new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = GSI_URL;
        script.async = true;
        const settle = (failure: string | null) => {
            clearTimeout(timer);
            script.onload = null;
            script.onerror = null;
            loading = null;
            if (failure === null) {
                resolve();
                return;
            }
            script.remove();
            reject(new Error(failure));
        };
        const timer = setTimeout(() => settle('Google sign-in did not load in time'), GSI_TIMEOUT_MS);
        script.onload = () => settle(loadedGoogle() ? null : 'Google sign-in loaded without google.accounts.id');
        script.onerror = () => settle('Google sign-in did not load');
        document.head.appendChild(script);
    });
    return loading;
}

// Google asks for one initialize per page (its JS reference), so its callback forwards to the button drawn last
let initialized: GoogleId | null = null;
let handOver: (credential: string) => void = () => {};

/** The width Google's button is drawn at for a slot `measured` px wide: whole pixels, 400 at most (Google's limit). */
export function googleButtonWidth(measured: number): number {
    return Math.min(400, Math.floor(measured));
}

/**
 * Draws Google's button into `el`, replacing what was there: "Continue with Google", in the site's language, `width`
 * wide (the slot's width, as googleButtonWidth; Google's own when 0). Google's answer goes to `onCredential`. Throws when
 * Google isn't loaded or there is no client id.
 */
export function renderGoogleButton(
    el: HTMLElement,
    { locale, width, onCredential }: { locale: Lang; width: number; onCredential: (credential: string) => void },
): void {
    const google = loadedGoogle();
    const clientId = googleClientId();
    if (!google || !clientId) throw new Error('Google sign-in is not available');
    if (initialized !== google) {
        google.initialize({ client_id: clientId, callback: ({ credential }) => handOver(credential) });
        initialized = google;
    }
    handOver = onCredential;
    el.replaceChildren();
    const pixels = googleButtonWidth(width);
    google.renderButton(el, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        locale,
        ...(pixels > 0 ? { width: String(pixels) } : {}),
    });
}

/**
 * The address in a Google ID token's payload, for display only (spec §4: the waitlist's prefill); the server never
 * trusts it. Null for anything that isn't a token with a string `email`.
 */
export function emailFromCredential(credential: string): string | null {
    try {
        const parts = credential.split('.');
        if (parts.length !== 3) return null;
        const bytes = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const json = decodeURIComponent(Array.from(bytes, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
        const email: unknown = JSON.parse(json)?.email;
        return typeof email === 'string' ? email : null;
    } catch {
        return null;
    }
}

/** A Google account with no Stiglja account yet: its ID token, sent again with the chosen name, and its address. */
export interface PendingGoogle {
    credential: string;
    email: string;
}

// P-1: in memory only, never in history.state or storage; a reload loses it, and the page asks for Google again
let pending: PendingGoogle | null = null;
const pendingListeners = new Set<() => void>();
const tellPending = () => pendingListeners.forEach((listener) => listener());

/** A `needsName` answer (or the cap, from /login): the credential the name step sends again (S2). */
export function setPendingGoogle(next: PendingGoogle): void {
    pending = next;
    tellPending();
}

/** The pending credential; the same object until the next set or clear. */
export function peekPendingGoogle(): PendingGoogle | null {
    return pending;
}

/** The name step's way back, and its end (S2). */
export function clearPendingGoogle(): void {
    pending = null;
    tellPending();
}

/**
 * For useSyncExternalStore: tells its listener on every set and clear, so a `needsName` that arrives while /signup is
 * already shown reaches the mounted form. Unused until the name step (S2) reads it.
 */
export function subscribePendingGoogle(listener: () => void): () => void {
    pendingListeners.add(listener);
    return () => {
        pendingListeners.delete(listener);
    };
}
