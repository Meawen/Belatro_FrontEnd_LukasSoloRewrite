import { useLocation } from 'react-router-dom';

/** ProtectedRoute's navigation state: the page a signed-out visitor asked for (D-20). */
export interface ReturnState {
    from: unknown;
}

/**
 * The `{ from }` this auth page was handed, to pass on as the `state` of every in-app hop of the auth
 * flow (spec §4.1): Sign in to Sign up and back, "Forgot password?" and "Back to sign in", and
 * confirm-email's Continue. Undefined when the page was reached without one. Where the flow ends, `safeReturnPath`
 * decides whether `from` is a safe in-app path.
 */
export function useReturnState(): ReturnState | undefined {
    const state = useLocation().state as { from?: unknown } | null;
    return state?.from === undefined ? undefined : { from: state.from };
}
