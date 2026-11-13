import { useSyncExternalStore } from 'react';
import { hr } from './catalog/hr';
import { enNow, loadEn } from './catalog/loadEn';
import type { Catalog } from './catalog/types';
import { getLang, LANG_KEY, setLang, useLang, type Lang } from './lang';
import { showToast } from '../components/ui/toastStore';

// Croatian ships in the entry chunk (spec §1.2, §10); English is its own chunk, loaded on demand (catalog/loadEn.ts), to
// keep the entry chunk within its limit. Until it arrives English reads as Croatian, so every way to English waits for
// it: the first paint on a device that chose it (main.tsx), switchLang, a sign-in that adopts it (useAuth), and another
// tab's choice (followOtherTabs). useT follows the catalog as a store, so a page in English repaints when it arrives.
let enCatalog: Catalog | null = enNow;
// the load in flight, shared by everyone who asks; cleared when it fails, so the next ask fetches again
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribeCatalog(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

const englishNow = () => enCatalog;

// Never call cat() at module top level: it would freeze the language at import time, and lang.ts imports the
// services, so once a service imports i18n a top-level call would hit a binding that isn't initialised yet.

/** How long a first paint, a switch or a sign-in waits for English before it says it didn't load. */
export const ENGLISH_WAIT_MS = 3000;

/** The language's catalog is here: Croatian always, English once its chunk has arrived. */
export function catalogReady(l: Lang): boolean {
    return l === 'hr' || enCatalog !== null;
}

/** Loads the language's catalog if it isn't here yet (only English ever needs to); rejects when its chunk can't load. */
export function ensureCatalog(l: Lang): Promise<void> {
    if (catalogReady(l)) return Promise.resolve();
    loading ??= loadEn().then(
        (catalog) => {
            enCatalog = catalog;
            listeners.forEach((listener) => listener());
        },
        (error: unknown) => {
            loading = null;
            throw error;
        },
    );
    return loading;
}

// Ruling 64: the wait in flight, shared by everyone who asks meanwhile (one timer, one answer, one toast). A later ask is
// a new wait with its own toast, even on a load still in flight: a deliberate retry after the toast gets feedback again
let waiting: Promise<boolean> | null = null;

/**
 * English, for a first paint, a switch or a sign-in: true once it is here. False when it failed or took longer than
 * ENGLISH_WAIT_MS; then one toast says so, in the page's language (Croatian, since English isn't here), once per wait.
 * English that arrives after the wait still shows wherever the site is in English: useT follows it.
 */
export function loadEnglish(): Promise<boolean> {
    if (catalogReady('en')) return Promise.resolve(true);
    waiting ??= new Promise((resolve) => {
        const load = ensureCatalog('en');
        let settled = false;
        const settle = (arrived: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            waiting = null;
            if (!arrived) showToast(cat().langSwitch.englishFailed);
            resolve(arrived);
        };
        const timer = setTimeout(() => settle(false), ENGLISH_WAIT_MS);
        load.then(() => settle(true), () => settle(false));
    });
    return waiting;
}

/**
 * The player's pick (setLang), once its catalog is here: at once for Croatian or an English already loaded, otherwise
 * when the English chunk arrives, so no page is ever half in English. The HR · EN switch and Settings → Language. With
 * English chosen but never arrived, it tries the load again; a pick that failed or timed out keeps the page.
 */
export function switchLang(l: Lang): void {
    if (catalogReady(l)) {
        setLang(l);
        return;
    }
    void loadEnglish().then((arrived) => {
        // already chosen (its catalog had failed): nothing to store or send, and useT repaints on its own
        if (arrived && getLang() !== l) setLang(l);
    });
}

/** The first paint (main.tsx): on a device that chose English it waits for its catalog, at most ENGLISH_WAIT_MS. */
export async function catalogForFirstPaint(): Promise<void> {
    if (getLang() === 'en') await loadEnglish();
}

/**
 * Another tab chose English (main.tsx): lang.ts follows it at once, and this loads its catalog, which useT then shows.
 * Returns the way to stop listening.
 */
export function followOtherTabs(): () => void {
    const onStorage = (event: StorageEvent) => {
        if (event.key === LANG_KEY && event.newValue === 'en') void loadEnglish();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
}

const catalogOf = (l: Lang, english: Catalog | null): Catalog => (l === 'en' ? english ?? hr : hr);

/** The catalog of the language at call time, for code outside components (models, services). */
export function cat(): Catalog {
    return catalogOf(getLang(), enCatalog);
}

/** The catalog of the site's language; the component re-renders on a switch, and when English arrives. */
export function useT(): Catalog {
    const lang = useLang();
    const english = useSyncExternalStore(subscribeCatalog, englishNow, englishNow);
    return catalogOf(lang, english);
}
