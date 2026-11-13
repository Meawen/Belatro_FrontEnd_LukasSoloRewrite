import { useSyncExternalStore } from 'react';
import { authService } from '../services/authService';
import { userService } from '../services/userService';

/** The site's language (spec §1.1): Croatian or English. */
export type Lang = 'hr' | 'en';

/** Per device (spec §1.1). */
export const LANG_KEY = 'stiglja:lang';

const isLang = (v: unknown): v is Lang => v === 'hr' || v === 'en';

// spec §1.1: a first visit is in Croatian, whatever the browser's language (the dev server and the build both).
// Vitest gets English, so the existing English tests read as before.
const fallback = (): Lang => (import.meta.env.MODE === 'test' ? 'en' : 'hr');

/** This tab's choice, so a device without storage still keeps it until the tab closes. */
let chosen: Lang | null = null;
const listeners = new Set<() => void>();

function stored(): Lang | null {
    try {
        const value = localStorage.getItem(LANG_KEY);
        return isLang(value) ? value : null;
    } catch {
        return null;
    }
}

/** The site's language: this device's choice, Croatian by default. Never throws. */
export function getLang(): Lang {
    return chosen ?? stored() ?? fallback();
}

/** Stores the language on this device and tells every useLang user. Never throws. */
function keep(l: Lang): void {
    chosen = l;
    try {
        localStorage.setItem(LANG_KEY, l);
    } catch {
        // storage is off (private mode, quota, policy): this tab keeps the choice in memory
    }
    listeners.forEach((listener) => listener());
}

/** The player's pick: kept on this device and, signed in, on the account (best effort). Never throws. */
export function setLang(l: Lang): void {
    keep(l);
    try {
        if (authService.isAuthenticated()) userService.setLanguage(l).catch(() => {});
    } catch {
        // storage is off, or the services aren't there (a test's partial mock): the device keeps the choice
    }
}

/** After sign-in the account's language wins (spec §1.1). Nothing goes back to the server; anything else is ignored. */
export function adoptAccountLang(l: string | null | undefined): void {
    if (isLang(l)) keep(l);
}

function subscribe(listener: () => void) {
    const onStorage = (event: StorageEvent) => {
        if (event.key !== LANG_KEY) return;
        chosen = null; // another tab chose: storage is the truth again
        listener();
    };
    listeners.add(listener);
    window.addEventListener('storage', onStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
    };
}

/** The site's language, in step across components and tabs. Switch with setLang. */
export function useLang(): Lang {
    return useSyncExternalStore(subscribe, getLang, fallback);
}
