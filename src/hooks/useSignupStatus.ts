import { useEffect, useState } from 'react';
import { betaService } from '../services/betaService';

/** Whether signup takes new accounts now (spec §2.2): 'unknown' when the request failed or the server is older. */
export type SignupState = 'asking' | 'open' | 'full' | 'unknown';

/**
 * GET /api/auth/signup-status, asked once per mount (Ruling 6). Only 'full' changes a sign-up door's label to the
 * waitlist's name (auth.waitlist.title); /signup shows the waitlist by the same answer. Off, it asks nothing ('unknown').
 * The route is under /api/auth/, which never reads the token, so it can't end a session.
 */
export function useSignupStatus(enabled = true): SignupState {
    const [state, setState] = useState<SignupState>(enabled ? 'asking' : 'unknown');
    useEffect(() => {
        if (!enabled) return;
        let current = true;
        betaService.signupStatus().then(
            (answer) => { if (current) setState(answer?.open === true ? 'open' : answer?.open === false ? 'full' : 'unknown'); },
            () => { if (current) setState('unknown'); },
        );
        return () => { current = false; };
    }, [enabled]);
    return state;
}
