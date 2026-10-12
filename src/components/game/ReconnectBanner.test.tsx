import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// A stand-in for gameSocket's store. The banner only reads it, and never holds the socket.
const fake = vi.hoisted(() => {
    const listeners = new Set<() => void>()
    const store = {
        state: { isConnected: true, isConnecting: false, isReconnecting: false, error: null as string | null },
        gameSocket: {
            getState: () => store.state,
            onStateChange: (listener: () => void) => {
                listeners.add(listener)
                return () => { listeners.delete(listener) }
            },
            retryNow: vi.fn(),
            acquire: vi.fn(),
        },
        set(next: Partial<typeof store.state>) {
            store.state = { ...store.state, ...next }
            listeners.forEach((listener) => listener())
        },
    }
    return store
})
vi.mock('../../services/gameSocket', () => ({ gameSocket: fake.gameSocket }))

import { ReconnectBanner } from './ReconnectBanner'

beforeEach(() => {
    vi.clearAllMocks()
    fake.state = { isConnected: true, isConnecting: false, isReconnecting: false, error: null }
})

describe('ReconnectBanner (R-30)', () => {
    test('renders nothing while the socket is up or making its first connect, and never holds it', () => {
        const { container } = render(<ReconnectBanner />)
        expect(container).toBeEmptyDOMElement()
        act(() => fake.set({ isConnected: false, isConnecting: true }))
        expect(container).toBeEmptyDOMElement()
        expect(fake.gameSocket.acquire).not.toHaveBeenCalled()
    })

    test('while the socket is down: Reconnecting… and Retry, which tries at once; gone once connected', async () => {
        const user = userEvent.setup()
        fake.set({ isConnected: false, isReconnecting: true })
        render(<ReconnectBanner />)
        expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…')
        await user.click(screen.getByRole('button', { name: 'Retry' }))
        expect(fake.gameSocket.retryNow).toHaveBeenCalledTimes(1)
        act(() => fake.set({ isConnected: true, isReconnecting: false }))
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
        expect(screen.queryByText('Reconnecting…')).not.toBeInTheDocument()
    })
})
