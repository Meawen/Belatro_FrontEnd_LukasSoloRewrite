// vite.config.ts runs in Node, but this repo has no @types/node (Google sign-in A-11): the one Node function the config
// uses, to read public/_headers (P-3). tsconfig.node.json type-checks the config with it; the app never sees it.
declare module 'node:fs' {
    export function readFileSync(path: string, encoding: 'utf8'): string;
}
