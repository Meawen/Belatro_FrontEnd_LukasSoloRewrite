import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Segmented } from './Segmented'
import { blocks, rule, uiCss } from '../../test/css'

const EFFECTS = [
    { value: 'full', label: 'Full' },
    { value: 'calm', label: 'Calm' },
    { value: 'off', label: 'Off' },
] as const

describe('Segmented (spec §3.7)', () => {
    test('a labelled group of buttons; the selected one is aria-pressed', () => {
        render(<Segmented label="Table effects" options={[...EFFECTS]} value="calm" onChange={() => {}} />)
        const group = screen.getByRole('group', { name: 'Table effects' })
        expect(group).toHaveClass('ui-seg')
        expect(screen.getByRole('button', { name: 'Full' })).toHaveAttribute('aria-pressed', 'false')
        expect(screen.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'false')
    })

    test('choosing another option reports it; the selected one reports nothing', async () => {
        const onChange = vi.fn()
        render(<Segmented label="Table effects" options={[...EFFECTS]} value="full" onChange={onChange} />)
        await userEvent.click(screen.getByRole('button', { name: 'Off' }))
        expect(onChange).toHaveBeenCalledWith('off')
        await userEvent.click(screen.getByRole('button', { name: 'Full' }))
        expect(onChange).toHaveBeenCalledTimes(1)
    })

    test('the selected segment sits on --surface-3 in --text; every segment is a 44-px target that presses', () => {
        const css = uiCss()
        expect(rule('.ui-seg__item[aria-pressed="true"]', css)).toMatch(/--seg-bg:\s*var\(--surface-3\);/)
        expect(rule('.ui-seg__item[aria-pressed="true"]', css)).toMatch(/color:\s*var\(--text\);/)
        expect(rule('.ui-seg__item', css)).toMatch(/min-height:\s*44px;/)
        expect(rule('.ui-seg__item:active', css)).toMatch(/transform:\s*translateY\(2px\);/)
    })

    test('the track edge is --edge-strong; the focus ring sits inside; forced colours keep the boundary and the choice', () => {
        const css = uiCss()
        expect(rule('.ui-seg::before', css)).toMatch(/box-shadow:\s*inset 0 0 0 2px var\(--edge-strong\);/)
        expect(rule('.ui-seg__item:focus-visible', css)).toMatch(/outline-offset:\s*-5px;/)
        const forced = blocks('@media (forced-colors: active)', css)
        expect(rule('.ui-seg', forced)).toMatch(/border:\s*1px solid;/)
        expect(rule('.ui-seg__item[aria-pressed="true"]', forced)).toMatch(/border:\s*1px solid;/)
    })
})
