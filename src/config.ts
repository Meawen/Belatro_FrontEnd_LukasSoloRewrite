/**
 * Where the backend lives (R-28).
 *
 * Dev goes through the Vite proxy (vite.config.ts): REST under /backend, which the proxy strips (not
 * /api, which the backend's own /api/auth routes use), and the SockJS endpoint at /ws. A production
 * bundle talks to the API origin in VITE_API_BASE_URL. `vite build` refuses to run without it and
 * bakes it in without trailing slashes (src/apiBase.ts). Both values below use it inline, so the
 * bundle carries them as plain strings.
 */
export const API_BASE_URL: string = import.meta.env.DEV ? '/backend' : import.meta.env.VITE_API_BASE_URL;

/** SockJS endpoint: the dev proxy's /ws, or the API origin's /ws in production. */
export const WS_URL: string = import.meta.env.DEV ? '/ws' : `${import.meta.env.VITE_API_BASE_URL}/ws`;
