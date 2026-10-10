import {
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useSyncExternalStore,
    type KeyboardEvent,
    type ReactNode,
    type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m, useIsPresent, type HTMLMotionProps } from 'motion/react';
import { fade, spring } from '../../motion/tokens';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { cx } from './cx';
import { IconButton } from './IconButton';

export type SheetSide = 'auto' | 'bottom' | 'center' | 'full';

export interface SheetProps {
    open: boolean;
    onClose: () => void;
    /** The visible title; it names the dialog or region. */
    title: string;
    children: ReactNode;
    /** A modal dialog (default) or a non-modal region that leaves the page usable. */
    modal?: boolean;
    /** Escape and a scrim tap close a modal sheet (default true; Match Found says false). */
    dismissible?: boolean;
    /** 'auto' (default): bottom below 720 px, centre from 720 px. 'full' covers the viewport. */
    side?: SheetSide;
    /** Where focus goes when a modal sheet opens; default the first focusable control. */
    initialFocus?: RefObject<HTMLElement | null>;
    /** A quiet × "Close" button in the header. */
    showClose?: boolean;
    className?: string;
    'data-testid'?: string;
}

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const WIDE = '(min-width: 720px)';

function subscribeToWidth(onChange: () => void) {
    if (typeof window.matchMedia !== 'function') return () => {};
    const query = window.matchMedia(WIDE);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}

const isWide = () => typeof window.matchMedia === 'function' && window.matchMedia(WIDE).matches;

/**
 * A sheet (spec §3.7). Modal: a dialog with a scrim, focus moved in, trapped and returned. Non-modal: a
 * labelled region over the page that leaves the rest usable. A closed sheet renders nothing; while it
 * animates out it is inert, and its content unmounts when the exit ends.
 */
export function Sheet(props: SheetProps) {
    return createPortal(<AnimatePresence>{props.open && <SheetLayer key="sheet" {...props} />}</AnimatePresence>, document.body);
}

type Entrance = Pick<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit' | 'transition'>;

function entrance(side: Exclude<SheetSide, 'auto'>, reduced: boolean): Entrance {
    if (reduced) return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: fade };
    if (side === 'center') {
        return { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.96 }, transition: spring.ui };
    }
    return { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: spring.sheet };
}

function SheetLayer({
    onClose,
    title,
    children,
    modal = true,
    dismissible = true,
    side = 'auto',
    initialFocus,
    showClose = false,
    className,
    'data-testid': testId,
}: SheetProps) {
    const present = useIsPresent();
    const reduced = useReducedMotion();
    const wide = useSyncExternalStore(subscribeToWidth, isWide, () => false);
    const resolved = side === 'auto' ? (wide ? 'center' : 'bottom') : side;
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const returnTo = useRef<HTMLElement | null>(null);

    // Modal: focus moves in on open, and back to whatever had it when the sheet closes or unmounts.
    useLayoutEffect(() => {
        if (!modal) return;
        returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const panel = panelRef.current;
        const target = initialFocus?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
        target?.focus();
        return () => returnTo.current?.focus();
        // runs once per opening: the sheet mounts when it opens
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (modal && !present) returnTo.current?.focus();
    }, [modal, present]);

    // Modal: the page under the sheet does not scroll while it is open.
    useEffect(() => {
        if (!modal || !present) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [modal, present]);

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!modal) return;
        if (event.key === 'Escape') {
            if (dismissible) {
                event.stopPropagation();
                onClose();
            }
            return;
        }
        if (event.key !== 'Tab') return;
        const panel = panelRef.current;
        if (!panel) return;
        const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (items.length === 0) {
            event.preventDefault();
            panel.focus();
            return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || active === panel)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    };

    return (
        <>
            {modal && (
                <m.div
                    className="ui-scrim"
                    aria-hidden="true"
                    inert={!present || undefined}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={reduced ? fade : spring.quick}
                    onClick={dismissible ? onClose : undefined}
                />
            )}
            <div className={cx('ui-sheet-layer', `ui-sheet-layer--${resolved}`, !modal && 'ui-sheet-layer--region')} inert={!present || undefined}>
                <m.div
                    ref={panelRef}
                    role={modal ? 'dialog' : 'region'}
                    aria-modal={modal || undefined}
                    aria-labelledby={titleId}
                    tabIndex={-1}
                    data-testid={testId}
                    className={cx('ui-sheet', `ui-sheet--${resolved}`, className)}
                    onKeyDown={onKeyDown}
                    {...entrance(resolved, reduced)}
                >
                    <div className="ui-sheet__header">
                        <h2 id={titleId} className="t-title">
                            {title}
                        </h2>
                        {showClose && <IconButton icon="x" aria-label="Close" onClick={onClose} />}
                    </div>
                    <div className="ui-sheet__body">{children}</div>
                </m.div>
            </div>
        </>
    );
}
