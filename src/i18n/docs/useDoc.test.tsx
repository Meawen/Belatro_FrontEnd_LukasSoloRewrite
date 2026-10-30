import { describe, test, expect, vi, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useDoc } from './useDoc'
import { setLang } from '../lang'
import { ErrorBoundary } from '../../components/common/ErrorBoundary'
import { captureConsole } from '../../test/captureConsole'

// Each test makes its own loaders: a document that arrived is kept per loader function, for the whole file
afterEach(() => {
    setLang('en')
    vi.restoreAllMocks()
})

describe('useDoc: a document in the site’s language, fetched when shown (spec §1.2, §10)', () => {
    test('null until the document arrives, and only the site’s language is fetched', async () => {
        const loaders = { hr: vi.fn(async () => 'HR'), en: vi.fn(async () => 'EN') }
        function Probe() {
            return <p>{useDoc(loaders) ?? 'none'}</p>
        }
        render(<Probe />)
        expect(screen.getByText('none')).toBeInTheDocument()
        expect(await screen.findByText('EN')).toBeInTheDocument()
        expect(loaders.en).toHaveBeenCalledTimes(1)
        expect(loaders.hr).not.toHaveBeenCalled()
    })

    test('a switch fetches the other language; a switch back shows the kept one without fetching again', async () => {
        const loaders = { hr: vi.fn(async () => 'HR'), en: vi.fn(async () => 'EN') }
        function Probe() {
            return <p>{useDoc(loaders) ?? 'none'}</p>
        }
        render(<Probe />)
        await screen.findByText('EN')
        act(() => setLang('hr'))
        expect(await screen.findByText('HR')).toBeInTheDocument()
        act(() => setLang('en'))
        expect(screen.getByText('EN')).toBeInTheDocument()
        expect(loaders.en).toHaveBeenCalledTimes(1)
        expect(loaders.hr).toHaveBeenCalledTimes(1)
    })

    test('a chunk that fails to load reaches the error boundary', async () => {
        // React and the boundary report the caught error on the console
        captureConsole()
        const loaders = {
            hr: vi.fn(async () => 'HR'),
            en: vi.fn(async (): Promise<string> => {
                throw new Error('chunk')
            }),
        }
        function Probe() {
            return <p>{useDoc(loaders) ?? 'none'}</p>
        }
        render(<ErrorBoundary><Probe /></ErrorBoundary>)
        expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
        expect(screen.queryByText('none')).not.toBeInTheDocument()
    })
})
