import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { reportGuideEvent, type GuideEvent } from './guideEvents'
import { captureConsole } from '../test/captureConsole'

// Škola bele's three counts (open beta spec §9, B9): POST /api/public/guide-events, best effort, and never who you are

/** A stored member session, with a guest's secret beside it: none of it may ride with a count. */
function signedIn() {
    localStorage.setItem('authToken', 'm-tok')
    localStorage.setItem('user', JSON.stringify({ id: 'u1', username: 'ana' }))
    localStorage.setItem('stiglja:guestSecret', 's')
}
const session = () => [localStorage.getItem('authToken'), localStorage.getItem('user'), localStorage.getItem('stiglja:guestSecret')]

/** A hand-built answer, as authService.test's jsonResponse. */
function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: `status-${status}`,
        headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
    } as unknown as Response
}

beforeEach(() => signedIn())
afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('reportGuideEvent (open beta spec §9, B9)', () => {
    test('each event goes out as {"event": …} JSON to /api/public/guide-events, with no token or cookie, even signed in (spec §9, Privacy)', async () => {
        const fetch = vi.fn(async () => ({ ok: true, status: 204, statusText: 'No Content', headers: { get: () => null } }) as unknown as Response)
        vi.stubGlobal('fetch', fetch)
        const events: GuideEvent[] = ['started', 'hand1', 'hand2']
        for (const e of events) await reportGuideEvent(e)
        expect(fetch).toHaveBeenCalledTimes(3)
        events.forEach((e, n) => {
            const [url, init] = fetch.mock.calls[n] as unknown as [string, RequestInit]
            expect(url, e).toMatch(/\/api\/public\/guide-events$/)
            expect(init, e).toEqual({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: e }), credentials: 'omit' })
        })
        expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body).toBe('{"event":"started"}')
    })

    test('a refusal, a failure or no answer is silent, sends once, and leaves the session as it was', async () => {
        const logged = captureConsole()
        const before = session()
        const answers: [string, () => unknown][] = [
            ['400 GUIDE_EVENT_INVALID', async () => jsonResponse(400, { error: 'Not a guide event', code: 'GUIDE_EVENT_INVALID' })],
            ['401 with a refused token', async () => jsonResponse(401, { error: 'Session expired, please sign in again' }, { 'www-authenticate': 'Bearer error="invalid_token"' })],
            ['429 RATE_LIMITED', async () => jsonResponse(429, { error: 'Too many requests, try again later', code: 'RATE_LIMITED' })],
            ['503', async () => jsonResponse(503, { error: 'Service Unavailable' })],
            ['no answer', async () => { throw new TypeError('Failed to fetch') }],
            ['a fetch that throws at once', () => { throw new TypeError('Failed to fetch') }],
            ['a bare vi.fn()', () => undefined],
        ]
        for (const [name, answer] of answers) {
            const fetch = vi.fn(answer)
            vi.stubGlobal('fetch', fetch)
            await expect(reportGuideEvent('hand1'), name).resolves.toBeUndefined()
            expect(fetch, name).toHaveBeenCalledTimes(1)
        }
        expect(logged.text()).toBe('')
        expect(session()).toEqual(before)
        expect(before).toEqual(['m-tok', JSON.stringify({ id: 'u1', username: 'ana' }), 's'])
    })
})
