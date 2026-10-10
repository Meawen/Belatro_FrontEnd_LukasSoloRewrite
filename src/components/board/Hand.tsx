import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, m, useIsPresent } from 'motion/react';
import { fade, spring } from '../../motion/tokens';
import { Faces } from './Cards';
import { boxStyle, cardMotion, useArc, type Anchor } from './cardMotion';
import type { HandCardModel } from './model/boardModel';
import type { Target, Targets } from './model/cardTargets';
import type { Entrance } from './stage';

interface HandCardProps {
    card: HandCardModel;
    target: Target;
    layoutId: string | undefined;
    entrance: Entrance | null;
    from: Anchor | null;
    instant: boolean;
    reduced: boolean;
    tabIndex: number;
    onPress?: (id: string) => void;
    register: (id: string, element: HTMLButtonElement | null) => void;
}

/**
 * One of my cards (spec §5.10): a `hand-card` button, `data-card`, named by the card, natively
 * disabled with `aria-disabled` in step. The pending card lifts −20 px and 1.04 with a gold ring
 * (spring.quick); the hover lift and the bidding suit ring are CSS on inner layers (board.css, D-35).
 */
function HandCard({ card, target, layoutId, entrance, from, instant, reduced, tabIndex, onPress, register }: HandCardProps) {
    const arc = useArc();
    const present = useIsPresent();
    const off = !card.enabled || !present;
    return (
        <m.button
            ref={(element: HTMLButtonElement | null) => register(card.id, element)}
            type="button"
            layoutId={layoutId}
            data-testid={present ? 'hand-card' : undefined}
            data-card={card.id}
            data-suit={card.card.boja}
            aria-label={card.label}
            disabled={off}
            aria-disabled={off}
            tabIndex={tabIndex}
            className="board-card board-hand-card"
            style={boxStyle(target)}
            exit={{ opacity: 0, transition: fade }}
            onClick={() => onPress?.(card.id)}
            {...cardMotion({ target, entrance, from, instant, reduced, arc })}
        >
            <m.span
                className="board-card__pend"
                data-pending={card.pending || undefined}
                animate={{ y: card.pending ? -20 : 0, scale: card.pending ? 1.04 : 1 }}
                transition={reduced ? { duration: 0 } : spring.quick}
            >
                <span className="board-card__lift">
                    <Faces card={card.card} width={target.width} />
                    <span className="board-card__ring" aria-hidden="true" />
                </span>
            </m.span>
        </m.button>
    );
}

export interface HandProps {
    cards: HandCardModel[];
    targets: Targets;
    /** The deal: card elements are `${deal}:${cardId}`, shared with the trick region (layoutId). */
    deal: number;
    entrances: Readonly<Record<string, Entrance>>;
    instant: boolean;
    reduced: boolean;
    /** A click on a card (it acts only on what the newest model shows as mine and enabled). */
    onPress?: (id: string) => void;
}

const MOVES: Record<string, (i: number, n: number) => number> = {
    ArrowRight: (i, n) => (i + 1) % n,
    ArrowLeft: (i, n) => (i - 1 + n) % n,
    Home: () => 0,
    End: (_, n) => n - 1,
};

/**
 * My hand (spec §5.3.5 #7, §5.10): a toolbar named "Your hand" that holds only the hand-card buttons.
 * ←/→, Home and End move between the playable cards (one tab stop); Enter and Space play.
 */
export function Hand({ cards, targets, deal, entrances, instant, reduced, onPress }: HandProps) {
    const elements = useRef(new Map<string, HTMLButtonElement>());
    const [active, setActive] = useState<string | null>(null);
    const playable = cards.filter((card) => card.enabled);
    const stop = playable.find((card) => card.id === active) ?? playable[0] ?? null;
    const register = (id: string, element: HTMLButtonElement | null) => {
        if (element) elements.current.set(id, element);
        else elements.current.delete(id);
    };
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const move = MOVES[event.key];
        if (!move || playable.length === 0) return;
        const focused = playable.findIndex((card) => elements.current.get(card.id) === document.activeElement);
        const next = playable[move(Math.max(0, focused), playable.length)];
        event.preventDefault();
        setActive(next.id);
        elements.current.get(next.id)?.focus();
    };

    const buttons: ReactNode[] = cards.map((card) => {
        const target = targets.cards[card.id];
        if (!target) return null;
        const entrance = entrances[card.id] ?? null;
        const key = reduced ? `${deal}:${card.id}@${Math.round(target.left)},${Math.round(target.top)}` : `${deal}:${card.id}`;
        return (
            <HandCard
                key={key}
                card={card}
                target={target}
                layoutId={reduced ? undefined : `${deal}:${card.id}`}
                entrance={entrance}
                from={entrance ? targets.anchors[entrance.from] ?? null : null}
                instant={instant}
                reduced={reduced}
                tabIndex={card.id === stop?.id ? 0 : -1}
                onPress={onPress}
                register={register}
            />
        );
    });

    return (
        <div role="toolbar" aria-label="Your hand" data-testid="hand" className="board-region board-hand" onKeyDown={onKeyDown}>
            {reduced ? <AnimatePresence>{buttons}</AnimatePresence> : buttons}
        </div>
    );
}
