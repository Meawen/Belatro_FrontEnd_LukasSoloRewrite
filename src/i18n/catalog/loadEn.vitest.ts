import { en } from './en';
import type { Catalog } from './types';

/** Vitest's loadEn.ts (vitest.config.ts): English is here at once, so the tests, which run in English, read it as before. */
export const enNow: Catalog | null = en;

export const loadEn = async (): Promise<Catalog> => en;
