import { en } from './catalog/en';
import { hr } from './catalog/hr';
import type { Catalog } from './catalog/types';
import { getLang, useLang, type Lang } from './lang';

// Both catalogs ship in the entry chunk (spec §1.2, §10).
const CATALOGS: Record<Lang, Catalog> = { hr, en };

// Never call cat() at module top level: it would freeze the language at import time, and lang.ts imports the
// services, so once a service imports i18n a top-level call would hit a binding that isn't initialised yet.

/** The catalog of the language at call time, for code outside components (models, services). */
export function cat(): Catalog {
    return CATALOGS[getLang()];
}

/** The catalog of the site's language; the component re-renders on a switch. */
export function useT(): Catalog {
    return CATALOGS[useLang()];
}
