import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './ErrorBoundary'
import { captureConsole } from '../../test/captureConsole'
import { setLang } from '../../i18n/lang'

function Crash(): never {
    throw new Error('render failed')
}

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    setLang('en')
})

describe('ErrorBoundary (R-29)', () => {
    test('a child that throws renders "Something went wrong" with Reload and Back to home', async () => {
        const user = userEvent.setup()
        const reload = vi.fn()
        const assign = vi.fn()
        vi.stubGlobal('location', { ...window.location, reload, assign })
        // React and componentDidCatch log the caught error
        captureConsole()
        render(<ErrorBoundary><Crash /></ErrorBoundary>)
        expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Reload' }))
        expect(reload).toHaveBeenCalledTimes(1)
        await user.click(screen.getByRole('button', { name: 'Back to home' }))
        expect(assign).toHaveBeenCalledWith('/dashboard')
    })

    test('children render as usual when nothing throws', () => {
        render(<ErrorBoundary><p>Table</p></ErrorBoundary>)
        expect(screen.getByText('Table')).toBeInTheDocument()
        expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    })

    test('the fallback shows no emoji, the pixel warning icon instead (D-36)', () => {
        captureConsole()
        const { container } = render(<ErrorBoundary><Crash /></ErrorBoundary>)
        expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u)
        expect(container.querySelector('svg')).not.toBeNull()
    })

    test("the root boundary's fallback fills the page in the wordmark frame (spec §4.1)", () => {
        captureConsole()
        render(<ErrorBoundary fullPage><Crash /></ErrorBoundary>)
        expect(screen.getByText('Stiglja')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Back to home' })).toBeInTheDocument()
    })

    test('the fallback in Croatian (open beta §1.1)', () => {
        setLang('hr')
        captureConsole()
        render(<ErrorBoundary fullPage><Crash /></ErrorBoundary>)
        expect(screen.getByRole('heading', { name: 'Nešto je pošlo po zlu' })).toBeInTheDocument()
        expect(screen.getByText('Dogodila se neočekivana pogreška. Osvježi stranicu ili pokušaj malo kasnije.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Učitaj ponovno' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Vrati se Doma' })).toBeInTheDocument()
    })
})
