import type { Catalog } from './types';

/**
 * The English catalog is its own chunk, to keep the entry chunk within its limit (the bundle rule): nothing until it is
 * loaded. t.ts loads it before the first render on a device that chose English, on the switch to English, and on a
 * sign-in that adopts it. vitest.config.ts puts loadEn.vitest.ts in this module's place, so tests read English at once.
 */
export const enNow: Catalog | null = null;

export const loadEn = (): Promise<Catalog> => import('./en').then((module) => module.en);
