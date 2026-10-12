/** Rows per page of /matches: GET /user/{id}/history/summary?size=10 (spec §4.9). */
export const MATCHES_PAGE_SIZE = 10;

/** The list's address for a 1-based page: /matches, /matches?page=2 (spec §4.9: Back returns to it). */
export function matchesPath(page: number): string {
    return page > 1 ? `/matches?page=${page}` : '/matches';
}

function wholePage(value: unknown): number {
    const page = Number(value);
    return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** The list's 1-based page from its URL; anything but a whole number from 1 up is page 1. */
export function pageFromSearch(search: URLSearchParams): number {
    return wholePage(search.get('page'));
}

/** What a list row carries to the details page as router state, for "‹ Match History". */
export interface MatchesBackState {
    page: number;
}

/** The list page a details page goes back to: the row's page, or 1 (a link from anywhere else). */
export function pageFromState(state: unknown): number {
    return wholePage((state as Partial<MatchesBackState> | null)?.page);
}
