import { useReducedMotionConfig } from 'motion/react';

/**
 * True when moves should cross-fade instead (spec §3.8): the OS preference under the app's
 * MotionProvider, or the provider's forced value. False without a provider.
 */
export function useReducedMotion(): boolean {
    return useReducedMotionConfig() ?? false;
}
