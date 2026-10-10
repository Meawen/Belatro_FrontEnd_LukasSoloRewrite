import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { fade, spring } from '../../motion/tokens';
import { useReducedMotion } from '../../motion/useReducedMotion';

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

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
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

/** The notched ink strip of a toast. */
export function Toast({ children }: { children: ReactNode }) {
    return <div className="ui-toast t-callout font-semibold">{children}</div>;
}

/** The toast layer: mounted once (main.tsx). A persistent polite status region, top-centre. */
export function Toaster() {
    const toast = useSyncExternalStore(subscribe, () => shown, () => null);
    const reduced = useReducedMotion();
    return createPortal(
        <div className="ui-toaster" role="status">
            <AnimatePresence>
                {toast && (
                    <m.div
                        key={toast.id}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
                        transition={reduced ? fade : spring.quick}
                    >
                        <Toast>{toast.message}</Toast>
                    </m.div>
                )}
            </AnimatePresence>
        </div>,
        document.body,
    );
}
