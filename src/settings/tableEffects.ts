import { useSyncExternalStore } from 'react';

/** How much the table animates (spec §5.7): Full, Calm (fewer, fainter particles) or Off. */
export type TableEffects = 'full' | 'calm' | 'off';

/** Per device (spec §4.13). */
export const TABLE_EFFECTS_KEY = 'stiglja:table-effects';

const VALUES: readonly string[] = ['full', 'calm', 'off'];
const isTableEffects = (value: unknown): value is TableEffects => typeof value === 'string' && VALUES.includes(value);

/** This tab's choice, so a device without storage still keeps it until the tab closes. */
let chosen: TableEffects | null = null;
const listeners = new Set<() => void>();

function stored(): TableEffects | null {
    try {
        const value = localStorage.getItem(TABLE_EFFECTS_KEY);
        return isTableEffects(value) ? value : null;
    } catch {
        return null;
    }
}

/** The stored choice, Full by default. Never throws. */
export function readTableEffects(): TableEffects {
    return chosen ?? stored() ?? 'full';
}

/** Stores the choice on this device and tells every useTableEffects user. Never throws. */
export function writeTableEffects(value: TableEffects): void {
    chosen = value;
    try {
        localStorage.setItem(TABLE_EFFECTS_KEY, value);
    } catch {
        // storage is off (private mode, quota, policy): this tab keeps the choice in memory
    }
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
    const onStorage = (event: StorageEvent) => {
        if (event.key !== TABLE_EFFECTS_KEY) return;
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

/** The Table effects choice and its setter, in step across components and tabs. */
export function useTableEffects(): [TableEffects, (value: TableEffects) => void] {
    const effects = useSyncExternalStore(subscribe, readTableEffects, () => 'full' as TableEffects);
    return [effects, writeTableEffects];
}
