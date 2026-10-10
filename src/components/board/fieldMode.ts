import type { FieldMode } from './particles';

/** The particles' mode: the Table effects setting, Off under reduced motion, Calm at most once the game ended. */
export function fieldMode(effects: FieldMode, reduced: boolean, calm: boolean): FieldMode {
    if (reduced || effects === 'off') return 'off';
    return calm ? 'calm' : effects;
}
