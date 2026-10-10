/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** The API origin of a production bundle (R-28), baked in by vite.config.ts. */
    readonly VITE_API_BASE_URL: string;
    /** The card art's origin in a production bundle (P-4), baked in by vite.config.ts. */
    readonly VITE_CARD_ART_BASE_URL: string;
}
