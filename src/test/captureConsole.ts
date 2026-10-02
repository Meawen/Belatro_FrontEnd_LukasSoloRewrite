import { vi } from 'vitest'

const METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const

function serialise(arg: unknown): string {
    let json: string | undefined
    try {
        json = JSON.stringify(arg)
    } catch {
        // circular structure: String() below still shows what it can
    }
    return `${String(arg)} ${json ?? ''}`
}

/**
 * Silences console.log/info/warn/error/debug and records every argument passed to them.
 * Undo with vi.restoreAllMocks().
 */
export function captureConsole() {
    const spies = METHODS.map((method) => vi.spyOn(console, method).mockImplementation(() => {}))
    const text = () => spies.flatMap((spy) => spy.mock.calls.flat()).map(serialise).join('\n')
    return {
        text,
        /** the given secrets that appear in anything logged so far */
        leaked: (...secrets: string[]) => secrets.filter((secret) => text().includes(secret)),
    }
}
