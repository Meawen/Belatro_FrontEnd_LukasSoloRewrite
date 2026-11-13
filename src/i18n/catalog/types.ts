import type { en } from './en';

/** A catalog's shape: en's keys with string or function leaves (en has no `as const`, so its type is already wide). */
export type Catalog = typeof en;
