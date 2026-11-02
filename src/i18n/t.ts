import { hr } from './catalog/hr';
import { enNow, loadEn } from './catalog/loadEn';
import type { Catalog } from './catalog/types';
import { getLang, setLang, useLang, type Lang } from './lang';

// Croatian ships in the entry chunk (spec §1.2, §10); English is its own chunk, loaded on demand (catalog/loadEn.ts), to
// keep the entry chunk within its limit. Until it arrives English reads as Croatian, so every way to English waits for
// it: the first render on a device that chose it (main.tsx), switchLang, and a sign-in that adopts it (useAuth).
let enCatalog: Catalog | null = enNow;

// Never call cat() at module top level: it would freeze the language at import time, and lang.ts imports the
// services, so once a service imports i18n a top-level call would hit a binding that isn't initialised yet.

/** Loads the language's catalog if it isn't here yet (only English ever needs to); rejects when its chunk can't load. */
export async function ensureCatalog(l: Lang): Promise<void> {
    if (l === 'en' && !enCatalog) enCatalog = await loadEn();
}

/**
 * The player's pick (setLang), once its catalog is here: at once for Croatian or an English already loaded, otherwise
 * when the English chunk arrives, so no page is ever half in English. The HR · EN switch and Settings → Language.
 */
export function switchLang(l: Lang): void {
    if (l === 'hr' || enCatalog) {
        setLang(l);
        return;
    }
    ensureCatalog(l).then(
        () => setLang(l),
        () => {
            // the chunk didn't arrive (offline, or replaced by a deploy): the site stays in its language; a press tries again
        },
    );
}

const catalogOf = (l: Lang): Catalog => (l === 'en' ? enCatalog ?? hr : hr);

/** The catalog of the language at call time, for code outside components (models, services). */
export function cat(): Catalog {
    return catalogOf(getLang());
}

/** The catalog of the site's language; the component re-renders on a switch. */
export function useT(): Catalog {
    return catalogOf(useLang());
}
