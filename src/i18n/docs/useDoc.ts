import { useEffect, useState } from 'react';
import { useLang, type Lang } from '../lang';

/** One document's loaders, one per language. Each is an import() of its own module, so each is its own chunk. */
export type DocLoaders<T> = Readonly<Record<Lang, () => Promise<T>>>;

// A document that has arrived stays: going back to the page, or back to a language, shows it at once.
const arrived = new Map<() => Promise<unknown>, unknown>();

/**
 * The document in the site's language (spec §1.2, §10): null until its chunk arrives; a switch fetches the other
 * language's. A chunk that fails to load (offline, or replaced by a deploy) throws to the ErrorBoundary, whose page
 * says to reload. The loaders must be a module-level constant: new functions on every render would load forever.
 */
export function useDoc<T>(loaders: DocLoaders<T>): T | null {
    const load = loaders[useLang()];
    const [, rerender] = useState(0);
    const [failure, setFailure] = useState<{ error: unknown } | null>(null);
    useEffect(() => {
        if (arrived.has(load)) return;
        let live = true;
        load().then(
            (doc) => {
                arrived.set(load, doc);
                if (live) rerender((n) => n + 1);
            },
            (error: unknown) => {
                if (live) setFailure({ error });
            },
        );
        return () => {
            live = false;
        };
    }, [load]);
    if (failure) throw failure.error;
    return arrived.has(load) ? (arrived.get(load) as T) : null;
}
