import { useEffect, useRef } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { spring } from '../../motion/tokens';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { suitIconUrl } from '../../services/cardArt';
import { useTableEffects } from '../../settings/tableEffects';
import { ParticleField } from './particles';
import { fieldMode } from './fieldMode';
import type { Season } from './model/boardModel';
import type { Boja } from '../../types/game';
import './board.css';

const SUIT_OF: Record<Exclude<Season, 'none'>, Boja> = { spring: 'HERC', summer: 'KARA', autumn: 'PIK', winter: 'TREF' };
const INSTANT = { duration: 0 } as const;

export interface ArenaProps {
    season: Season;
    /** Goes up at every trump call: the season's 1.6-s burst. A snap never raises it. */
    burst: number;
    /** Set the felt without its cross-fade (a snap). */
    instant: boolean;
    /** The game has ended: the last season stays, its particles at Calm at most (spec §5.3.3). */
    calm: boolean;
}

/**
 * The arena (spec §5.7, D-22, D-35): two felt layers cross-fading to the trump's season, and one
 * particle canvas (layer 1) that pauses while the tab is hidden and never touches React state.
 * Reduced motion: no particles, and the felt changes at once.
 */
export function Arena({ season, burst, instant, calm }: ArenaProps) {
    const [effects] = useTableEffects();
    const reduced = useReducedMotion();
    const mode = fieldMode(effects, reduced, calm);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const field = useRef<ParticleField | null>(null);
    field.current ??= new ParticleField();
    const burstSeen = useRef(burst);

    useEffect(() => {
        const now = performance.now();
        const fresh = burst !== burstSeen.current;
        burstSeen.current = burst;
        field.current!.setSeason(season, now, fresh && !instant);
    }, [season, burst, instant]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const painter = canvas?.getContext('2d') ?? null;
        const particles = field.current!;
        particles.setMode(mode);
        if (!canvas || !painter) return;
        const icon = season === 'none' ? null : new Image();
        if (icon) icon.src = suitIconUrl(SUIT_OF[season as Exclude<Season, 'none'>]);
        const ready = () => (icon && icon.complete && icon.naturalWidth > 0 ? icon : null);

        const fit = () => {
            const dpr = window.devicePixelRatio || 1;
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
            if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
            painter.setTransform(dpr, 0, 0, dpr, 0, 0);
            return { width, height };
        };
        const still = () => {
            const { width, height } = fit();
            particles.draw(painter, width, height, 0, null, false);
        };
        if (mode === 'off') {
            // no moving sprites; summer's wheat stands still
            still();
            window.addEventListener('resize', still);
            return () => window.removeEventListener('resize', still);
        }

        let frameId = 0;
        let running = false;
        let last = 0;
        const frame = (t: number) => {
            const { width, height } = fit();
            particles.step(Math.min(0.05, (t - last) / 1000), t, width, height);
            particles.draw(painter, width, height, t, ready(), true);
            last = t;
            frameId = requestAnimationFrame(frame);
        };
        const start = () => {
            if (running || document.hidden) return;
            running = true;
            last = performance.now();
            frameId = requestAnimationFrame(frame);
        };
        const stop = () => {
            running = false;
            cancelAnimationFrame(frameId);
        };
        const onVisibility = () => (document.hidden ? stop() : start());
        start();
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [mode, season]);

    const felt = instant || reduced ? INSTANT : spring.felt;
    return (
        <div data-testid="arena" data-season={season} className="board-arena" aria-hidden="true">
            <AnimatePresence initial={false}>
                <m.div
                    key={season}
                    className={season === 'none' ? 'board-arena__felt felt' : `board-arena__felt felt felt-${season}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={felt}
                />
            </AnimatePresence>
            <div className="board-arena__wash" />
            <canvas ref={canvasRef} className="board-arena__particles" data-effects={mode} />
        </div>
    );
}
