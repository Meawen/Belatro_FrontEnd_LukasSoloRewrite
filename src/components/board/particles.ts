import type { Season } from './model/boardModel';

/**
 * The arena's particles (spec §5.7): DB32 pixel sprites at 3-px pixels plus the season's suit icon,
 * drawn on one canvas. Plain data and drawing, no React: the Arena component runs it on
 * requestAnimationFrame and never puts any of it into React state. The colours are the card art's
 * DawnBringer-32 palette (realistic-board.md §7); a canvas can't read CSS custom properties per pixel.
 */

export type FieldMode = 'full' | 'calm' | 'off';

/** Sprites on screen at most: Full 52, Calm 14, Off none (spec §3.8, §5.7). */
export const BUDGET: Record<FieldMode, number> = { full: 52, calm: 14, off: 0 };
/** After a trump call, Full allows ×1.6 sprites for 1.6 s. */
export const BURST = { factor: 1.6, ms: 1600 } as const;
/** One art pixel of a sprite, in CSS px. */
export const PIXEL = 3;
/** A suit icon's size on the canvas (17×16 art px, nearest-neighbour). */
export const ICON = { w: 17, h: 16 } as const;

type Pixels = readonly (readonly [number, number])[];

interface Kind {
    color: string;
    pixels: Pixels;
}

const PETAL: Pixels = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]];
const SQUARE: Pixels = [[0, 0], [1, 0], [0, 1], [1, 1]];
const DOT: Pixels = [[0, 0]];
const LEAF: Pixels = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2]];
const TWIG: Pixels = [[0, 0], [1, 1], [2, 2], [1, 0], [0, 1]];

const KINDS: Record<Exclude<Season, 'none'>, readonly Kind[]> = {
    // pink and white petals drifting down
    spring: [{ color: '#d77bba', pixels: PETAL }, { color: '#ffffff', pixels: SQUARE }],
    // gold motes rising
    summer: [{ color: '#fbf236', pixels: DOT }, { color: '#d9a066', pixels: [[0, 0], [1, 0]] }],
    // orange, brown and gold leaves falling
    autumn: [{ color: '#df7126', pixels: LEAF }, { color: '#8f563b', pixels: TWIG }, { color: '#fbf236', pixels: [[1, 0], [0, 1], [1, 1], [1, 2]] }],
    // snow
    winter: [{ color: '#cbdbfc', pixels: SQUARE }, { color: '#ffffff', pixels: DOT }],
};

/** Herc icons float up in spring and Karo motes rise in summer; everything else falls. */
const RISING: Record<Exclude<Season, 'none'>, { sprites: boolean; icons: boolean }> = {
    spring: { sprites: false, icons: true },
    summer: { sprites: true, icons: true },
    autumn: { sprites: false, icons: false },
    winter: { sprites: false, icons: false },
};

export interface Sprite {
    x: number;
    y: number;
    vx: number;
    vy: number;
    phase: number;
    life: number;
    /** A suit icon instead of pixels. */
    icon: boolean;
    color: string;
    pixels: Pixels;
}

/** The part of a canvas context the field draws with (a real CanvasRenderingContext2D in the app). */
export type Painter = Pick<CanvasRenderingContext2D, 'clearRect' | 'fillRect' | 'drawImage'> & {
    fillStyle: CanvasRenderingContext2D['fillStyle'];
    globalAlpha: number;
    imageSmoothingEnabled: boolean;
};

/** The season's pixel wheat along both bottom edges (summer only), swaying ±1 px at its heads. */
export function drawWheat(painter: Painter, width: number, height: number, sway: (stalk: number) => number): void {
    for (let side = 0; side < 2; side++) {
        for (let i = 0; i < 16; i++) {
            const x = side ? width - 10 - i * 6 : 10 + i * 6;
            const tall = 6 + ((i * 5) % 7);
            const s = sway(i);
            painter.fillStyle = '#d9a066';
            for (let j = 0; j < tall; j++) painter.fillRect(Math.round(x + (j > tall - 3 ? s : 0)), Math.round(height - 12 - j * PIXEL), PIXEL - 1, PIXEL);
            painter.fillStyle = '#fbf236';
            painter.fillRect(Math.round(x + s - 1), Math.round(height - 12 - tall * PIXEL - 3), PIXEL + 1, PIXEL * 2);
        }
    }
}

/** The particles of one arena. `random` is injectable so tests are deterministic. */
export class ParticleField {
    season: Season = 'none';
    mode: FieldMode = 'full';
    sprites: Sprite[] = [];
    private burstUntil = -Infinity;
    private readonly random: () => number;

    constructor(random: () => number = Math.random) {
        this.random = random;
    }

    /** A new season starts empty; `burst` (a trump call, never a snap) allows ×1.6 for 1.6 s. */
    setSeason(season: Season, now: number, burst: boolean): void {
        if (season !== this.season) this.sprites = [];
        this.season = season;
        if (burst) this.burstUntil = now + BURST.ms;
    }

    setMode(mode: FieldMode): void {
        if (mode === this.mode) return;
        this.mode = mode;
        if (mode === 'off') this.sprites = [];
    }

    /** How many sprites may be on screen now. */
    budget(now: number): number {
        if (this.season === 'none') return 0;
        const base = BUDGET[this.mode];
        return this.mode === 'full' && now < this.burstUntil ? Math.floor(base * BURST.factor) : base;
    }

    /** Moves every sprite `dt` seconds, drops those off the canvas, and maybe spawns one. */
    step(dt: number, now: number, width: number, height: number): void {
        for (const sprite of this.sprites) {
            sprite.life += dt;
            sprite.phase += dt;
            sprite.x += (sprite.vx + Math.sin(sprite.phase) * 6) * dt;
            sprite.y += sprite.vy * dt;
        }
        this.sprites = this.sprites.filter((sprite) => sprite.y <= height + 20 && sprite.y >= -22);
        const budget = this.budget(now);
        if (this.sprites.length > budget) this.sprites.length = budget;
        const rate = now < this.burstUntil ? 0.6 : 0.12;
        if (this.season !== 'none' && this.sprites.length < budget && this.random() < rate) this.spawn(width, height);
    }

    private spawn(width: number, height: number): void {
        const season = this.season as Exclude<Season, 'none'>;
        const icon = this.random() < 0.22;
        const up = icon ? RISING[season].icons : RISING[season].sprites;
        const kinds = KINDS[season];
        const kind = kinds[Math.floor(this.random() * kinds.length)];
        this.sprites.push({
            x: this.random() * width,
            y: up ? height + 8 : -8,
            vx: (this.random() - 0.5) * 12,
            vy: up ? -(8 + this.random() * 10) : 14 + this.random() * 22,
            phase: this.random() * Math.PI * 2,
            life: 0,
            icon,
            color: kind.color,
            pixels: kind.pixels,
        });
    }

    /** Clears the canvas and draws the sprites (and summer's wheat); `icon` is the season's suit icon, once loaded. */
    draw(painter: Painter, width: number, height: number, now: number, icon: CanvasImageSource | null, swaying: boolean): void {
        painter.clearRect(0, 0, width, height);
        const strength = this.mode === 'calm' ? 0.55 : 0.85;
        for (const sprite of this.sprites) {
            painter.globalAlpha = Math.min(1, sprite.life * 2) * strength;
            if (sprite.icon) {
                if (icon) {
                    painter.imageSmoothingEnabled = false;
                    painter.drawImage(icon, Math.round(sprite.x), Math.round(sprite.y), ICON.w, ICON.h);
                }
                continue;
            }
            painter.fillStyle = sprite.color;
            for (const [a, b] of sprite.pixels) painter.fillRect(Math.round(sprite.x + a * PIXEL), Math.round(sprite.y + b * PIXEL), PIXEL, PIXEL);
        }
        painter.globalAlpha = 1;
        if (this.season === 'summer') drawWheat(painter, width, height, (i) => (swaying ? Math.round(Math.sin(now / 900 + i)) : 0));
    }
}
