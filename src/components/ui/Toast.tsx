import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { fade, spring } from '../../motion/tokens';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { currentToast, subscribeToToasts } from './toastStore';

/** The notched ink strip of a toast. */
export function Toast({ children }: { children: ReactNode }) {
    return <div className="ui-toast t-callout font-semibold">{children}</div>;
}

/** The toast layer: mounted once (main.tsx). A persistent polite status region, top-centre. */
export function Toaster() {
    const toast = useSyncExternalStore(subscribeToToasts, currentToast, () => null);
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
