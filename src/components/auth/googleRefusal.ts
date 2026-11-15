import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { cat } from '../../i18n/t';

/**
 * The line for a Google refusal worth another try: no answer or a 5xx says the generic line (their text isn't the
 * backend's); a 404 is a server with Google sign-in off, whose body has no code, so the page says `offLine` (S1 A-5,
 * S3 A-6); any other refusal its code's line.
 */
export function googleRefusalLine(error: unknown, offLine: string): string {
    const status = error instanceof ApiError ? error.status : 0;
    return isNetworkOrServerFailure(status) ? cat().errors.generic : status === 404 ? offLine : errorMessage(error, cat().errors.generic);
}
