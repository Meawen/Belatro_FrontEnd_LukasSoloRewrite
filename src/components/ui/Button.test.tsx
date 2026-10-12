import { describe, test, expect, vi } from 'vitest'
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'
import { IconButton } from './IconButton'
import { PixelIcon } from './PixelIcon'
import { blocks, rule, uiCss } from '../../test/css'

describe('Button (spec §3.7)', () => {
    test('is a native button named by its label, type="button" unless a form asks for submit', () => {
        render(<form><Button>Start match</Button><Button type="submit">Create</Button></form>)
        expect(screen.getByRole('button', { name: 'Start match' })).toHaveAttribute('type', 'button')
        expect(screen.getByRole('button', { name: 'Create' })).toHaveAttribute('type', 'submit')
    })

    test('variants are props: primary by default, then secondary, quiet and danger', () => {
        render(<><Button>A</Button><Button variant="secondary">B</Button><Button variant="quiet">C</Button><Button variant="danger">D</Button></>)
        expect(screen.getByRole('button', { name: 'A' })).toHaveClass('ui-btn', 'ui-btn--primary')
        expect(screen.getByRole('button', { name: 'B' })).toHaveClass('ui-btn', 'ui-btn--secondary')
        expect(screen.getByRole('button', { name: 'C' })).toHaveClass('ui-btn', 'ui-btn--quiet')
        expect(screen.getByRole('button', { name: 'D' })).toHaveClass('ui-btn', 'ui-btn--danger')
    })

    test('press feedback is CSS :active: down 2 px in 90 ms, and the primary ledge shrinks from 3 to 1 px', () => {
        const css = uiCss()
        expect(rule('.ui-btn', css)).toMatch(/transition:\s*transform 90ms ease-out;/)
        expect(rule('.ui-btn:active:not(:disabled)', css)).toMatch(/transform:\s*translateY\(2px\);/)
        expect(rule('.ui-btn--primary', css)).toMatch(/--btn-edge:\s*inset 0 -3px 0 var\(--accent-ledge\);/)
        expect(rule('.ui-btn--primary:active:not(:disabled)', css)).toMatch(/--btn-edge:\s*inset 0 -1px 0 var\(--accent-ledge\);/)
    })

    test('disabled: opacity .45, no press, no click', async () => {
        const onClick = vi.fn()
        render(<Button disabled onClick={onClick}>Start match</Button>)
        await userEvent.click(screen.getByRole('button', { name: 'Start match' }))
        expect(onClick).not.toHaveBeenCalled()
        expect(rule('.ui-btn:disabled', uiCss())).toMatch(/opacity:\s*0\.45;/)
    })

    test('loading keeps the label as the accessible name, is busy and takes no click', async () => {
        const onClick = vi.fn()
        render(<Button loading onClick={onClick}>Signing In...</Button>)
        const button = screen.getByRole('button', { name: 'Signing In...' })
        expect(button).toBeDisabled()
        expect(button).toHaveAttribute('aria-busy', 'true')
        await userEvent.click(button)
        expect(onClick).not.toHaveBeenCalled()
    })

    test('the focus ring is drawn inside the notch, in ink on the yellow primary; forced colours add a border', () => {
        const css = uiCss()
        expect(rule('.ui-btn:focus-visible', css)).toMatch(/outline-offset:\s*-5px;/)
        expect(rule('.ui-btn--primary:focus-visible', css)).toMatch(/outline-color:\s*var\(--ink\);/)
        expect(rule('.ui-btn', blocks('@media (forced-colors: active)', css))).toMatch(/border:\s*1px solid;/)
    })

    test('sm looks 36 px tall inside a 44-px hit area; md is 44 px', () => {
        render(<Button size="sm">Refresh</Button>)
        expect(screen.getByRole('button', { name: 'Refresh' })).toHaveClass('ui-btn--sm')
        expect(rule('.ui-btn', uiCss())).toMatch(/min-height:\s*44px;/)
        expect(rule('.ui-btn--sm', uiCss())).toMatch(/--btn-inset:\s*4px 0;/)
    })

    test('a left icon is decoration, and the ref reaches the button', () => {
        const ref = createRef<HTMLButtonElement>()
        render(<Button ref={ref} leftIcon={<PixelIcon name="plus" />}>Create lobby</Button>)
        const button = screen.getByRole('button', { name: 'Create lobby' })
        expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
        expect(ref.current).toBe(button)
    })
})

describe('IconButton (spec §3.7)', () => {
    test('is named by its aria-label, draws its icon and keeps a 44×44 hit area', async () => {
        const onClick = vi.fn()
        render(<IconButton aria-label="Refresh" icon="refresh" onClick={onClick} />)
        const button = screen.getByRole('button', { name: 'Refresh' })
        expect(button).toHaveClass('ui-btn', 'ui-btn--quiet', 'ui-btn--icon')
        expect(button.querySelector('svg')).toBeInTheDocument()
        expect(rule('.ui-btn--icon', uiCss())).toMatch(/min-width:\s*44px;/)
        await userEvent.click(button)
        expect(onClick).toHaveBeenCalledTimes(1)
    })
})
