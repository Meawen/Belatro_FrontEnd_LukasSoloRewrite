// The recorded view sequences (spec §4.17): every src/test/fixtures/views/recorded-*.json, by its file
// name without ".json". Dev builds only: src/dev is imported behind import.meta.env.DEV || VITE_DEV_BOARD.
import type { RecordedViews } from './devTable';

const files = import.meta.glob<RecordedViews>('../test/fixtures/views/recorded-*.json', { eager: true, import: 'default' });

export const RECORDINGS: Readonly<Record<string, RecordedViews>> = Object.fromEntries(
    Object.entries(files).map(([path, recording]) => [path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, ''), recording]),
);
