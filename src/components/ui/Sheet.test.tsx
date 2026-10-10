import { describe, test, expect, vi, afterEach } from 'vitest'
import { useRef, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sheet, type SheetSide } from './Sheet'
import { Button } from './Button'
import { MotionProvider } from '../../motion/MotionProvider'
import { blocks, rule, uiCss } from '../../test/css'

afterEach(() => {
    vi.unstubAllGlobals()
})

function screenWidth(wide: boolean) {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: wide && query === '(min-width: 720px)',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
    }))
}

interface HarnessProps {
    modal?: boolean
    dismissible?: boolean
    side?: SheetSide
    showClose?: boolean
    focusAccept?: boolean
    onOutside?: () => void
}

function Harness({ modal, dismissible, side, showClose, focusAccept, onOutside = () => {} }: HarnessProps) {
    const [open, setOpen] = useState(false)
    const accept = useRef<HTMLButtonElement>(null)
    return (
        <MotionProvider>
            <Button onClick={() => setOpen(true)}>Open</Button>
            <Button variant="secondary" onClick={onOutside}>Pass</Button>
            <Sheet
                open={open}
                onClose={() => setOpen(false)}
                title="Close this lobby?"
                modal={modal}
                dismissible={dismissible}
                side={side}
                showClose={showClose}
                initialFocus={focusAccept ? accept : undefined}
                data-testid="lobby-sheet"
            >
                <p>Everyone goes back to the list.</p>
                <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                <Button ref={accept} variant="danger">Close lobby</Button>
            </Sheet>
        </MotionProvider>
    )
}

const openSheet = () => userEvent.click(screen.getByRole('button', { name: 'Open' }))
const gone = () => waitFor(() => expect(document.querySelector('.ui-sheet')).toBeNull())

describe('Sheet (spec §3.7)', () => {
    test('a closed sheet renders nothing', () => {
        render(<Harness />)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(document.querySelector('.ui-scrim')).toBeNull()
        expect(screen.queryByText('Everyone goes back to the list.')).not.toBeInTheDocument()
    })

    test('modal: a dialog labelled by its title, aria-modal, in a portal on the body', async () => {
        const { container } = render(<Harness />)
        await openSheet()
        const dialog = screen.getByRole('dialog', { name: 'Close this lobby?' })
        expect(dialog).toHaveAttribute('aria-modal', 'true')
        expect(dialog).toHaveAttribute('data-testid', 'lobby-sheet')
        expect(container.contains(dialog)).toBe(false)
        expect(screen.getByRole('heading', { name: 'Close this lobby?' })).toHaveClass('t-title')
    })

    test('focus moves in, stays trapped on Tab and Shift+Tab, and returns to the trigger on close', async () => {
        render(<Harness />)
        await openSheet()
        const cancel = screen.getByRole('button', { name: 'Cancel' })
        const close = screen.getByRole('button', { name: 'Close lobby' })
        expect(cancel).toHaveFocus()
        await userEvent.tab()
        expect(close).toHaveFocus()
        await userEvent.tab()
        expect(cancel).toHaveFocus()
        await userEvent.tab({ shift: true })
        expect(close).toHaveFocus()
        await userEvent.click(cancel)
        await waitFor(() => expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus())
    })

    test('initialFocus picks the control that gets focus (Match Found focuses Accept)', async () => {
        render(<Harness focusAccept />)
        await openSheet()
        expect(screen.getByRole('button', { name: 'Close lobby' })).toHaveFocus()
    })

    test('Escape and a scrim tap close a dismissible sheet; showClose adds a Close button', async () => {
        render(<Harness showClose />)
        await openSheet()
        await userEvent.keyboard('{Escape}')
        await gone()
        await openSheet()
        await userEvent.click(document.querySelector('.ui-scrim')!)
        await gone()
        await openSheet()
        await userEvent.click(screen.getByRole('button', { name: 'Close' }))
        await gone()
    })

    test('a non-dismissible sheet ignores Escape and the scrim (Match Found)', async () => {
        render(<Harness dismissible={false} />)
        await openSheet()
        await userEvent.keyboard('{Escape}')
        await userEvent.click(document.querySelector('.ui-scrim')!)
        expect(screen.getByRole('dialog', { name: 'Close this lobby?' })).toBeInTheDocument()
    })

    test('while it closes it is inert and takes no input, then its content unmounts', async () => {
        render(<Harness />)
        await openSheet()
        // a synchronous click, so the assertions run before the exit animation's first frame
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(document.querySelector('.ui-sheet-layer')).toHaveAttribute('inert')
        expect(document.querySelector('.ui-scrim')).toHaveAttribute('inert')
        await gone()
        expect(screen.queryByText('Everyone goes back to the list.')).not.toBeInTheDocument()
        expect(document.querySelector('.ui-scrim')).toBeNull()
        expect(rule('.ui-scrim[inert]', uiCss())).toMatch(/pointer-events:\s*none;/)
    })

    test('non-modal: a labelled region without a scrim or focus move; the page behind keeps working', async () => {
        const onOutside = vi.fn()
        render(<Harness modal={false} onOutside={onOutside} />)
        await openSheet()
        const region = screen.getByRole('region', { name: 'Close this lobby?' })
        expect(region).not.toHaveAttribute('aria-modal')
        expect(document.querySelector('.ui-scrim')).toBeNull()
        expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
        await userEvent.click(screen.getByRole('button', { name: 'Pass' }))
        expect(onOutside).toHaveBeenCalledTimes(1)
        expect(rule('.ui-sheet-layer', uiCss())).toMatch(/pointer-events:\s*none;/)
        expect(rule('.ui-sheet', uiCss())).toMatch(/pointer-events:\s*auto;/)
    })

    test('side: bottom below 720 px, centre from 720 px, full when asked', async () => {
        screenWidth(false)
        const { unmount } = render(<Harness />)
        await openSheet()
        expect(screen.getByRole('dialog')).toHaveClass('ui-sheet--bottom')
        unmount()
        screenWidth(true)
        const second = render(<Harness />)
        await openSheet()
        expect(screen.getByRole('dialog')).toHaveClass('ui-sheet--center')
        second.unmount()
        render(<Harness side="full" />)
        await openSheet()
        expect(screen.getByRole('dialog')).toHaveClass('ui-sheet--full')
    })

    test('a modal sheet stops the page scrolling until it closes', async () => {
        render(<Harness />)
        await openSheet()
        expect(document.body.style.overflow).toBe('hidden')
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        await gone()
        expect(document.body.style.overflow).toBe('')
    })

    test('layers: non-modal 70, scrim 80, modal 90; a centre sheet scrolls inside; ring inside; forced colours add a border', () => {
        const css = uiCss()
        expect(rule('.ui-scrim', css)).toMatch(/z-index:\s*var\(--z-scrim\);/)
        expect(rule('.ui-sheet-layer', css)).toMatch(/z-index:\s*var\(--z-modal\);/)
        expect(rule('.ui-sheet-layer--region', css)).toMatch(/z-index:\s*var\(--z-sheet\);/)
        expect(rule('.ui-sheet__body', css)).toMatch(/overflow:\s*auto;/)
        expect(rule('.ui-sheet--center', css)).toMatch(/max-height:\s*calc\(100dvh - 32px\);/)
        expect(rule('.ui-sheet--full', css)).toMatch(/height:\s*100dvh;/)
        expect(rule('.ui-sheet:focus-visible', css)).toMatch(/outline-offset:\s*-5px;/)
        expect(rule('.ui-sheet', blocks('@media (forced-colors: active)', css))).toMatch(/border:\s*1px solid;/)
    })
})
