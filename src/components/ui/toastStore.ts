/** How long a toast stays (spec §3.7). */
export const TOAST_MS = 1800;

interface Shown {
    id: number;
    message: string;
}

let shown: Shown | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((listener) => listener());
}

/** The Toaster's subscription (useSyncExternalStore). */
export function subscribeToToasts(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** The toast on screen now, or null. */
export function currentToast(): Shown | null {
    return shown;
}

/** Shows one short message for 1.8 s; a newer one replaces it. Works from anywhere, mounted Toaster or not. */
export function showToast(message: string): void {
    shown = { id: nextId++, message };
    clearTimeout(timer);
    timer = setTimeout(() => {
        shown = null;
        emit();
    }, TOAST_MS);
    emit();
}
