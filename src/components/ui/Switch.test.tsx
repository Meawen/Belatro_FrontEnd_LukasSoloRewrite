import { describe, test, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Switch } from './Switch'
import { blocks, rule, uiCss } from '../../test/css'

function Controlled({ onChange = () => {} }: { onChange?: (checked: boolean) => void }) {
    const [on, setOn] = useState(false)
    return <Switch label="Private lobby" checked={on} onChange={(checked) => { setOn(checked); onChange(checked) }} />
}

describe('Switch (spec §3.7)', () => {
    test('a switch named by its tied label, with a stable id', () => {
        const { rerender } = render(<Switch label="Private lobby" checked={false} onChange={() => {}} />)
        const control = screen.getByRole('switch', { name: 'Private lobby' })
        const id = control.id
        expect(screen.getByText('Private lobby').closest('label')).toHaveAttribute('for', id)
        expect(control).not.toBeChecked()
        rerender(<Switch label="Private lobby" checked onChange={() => {}} />)
        expect(screen.getByRole('switch', { name: 'Private lobby' })).toBeChecked()
        expect(control.id).toBe(id)
    })

    test('tapping the switch or its label toggles it', async () => {
        const onChange = vi.fn()
        render(<Controlled onChange={onChange} />)
        await userEvent.click(screen.getByRole('switch', { name: 'Private lobby' }))
        expect(onChange).toHaveBeenLastCalledWith(true)
        await userEvent.click(screen.getByText('Private lobby'))
        expect(onChange).toHaveBeenLastCalledWith(false)
        expect(screen.getByRole('switch', { name: 'Private lobby' })).not.toBeChecked()
    })

    test('a helper describes it; disabled takes no tap', async () => {
        const onChange = vi.fn()
        render(<Switch label="Private lobby" helper="Guests need the password" checked={false} disabled onChange={onChange} />)
        const control = screen.getByRole('switch', { name: 'Private lobby' })
        expect(control).toHaveAccessibleDescription('Guests need the password')
        await userEvent.click(control)
        expect(onChange).not.toHaveBeenCalled()
    })

    test('the knob slides by transform; the track is edged in --edge-strong; the ring goes round the 44-px row', () => {
        const css = uiCss()
        expect(rule('.ui-switch__knob', css)).toMatch(/transition:\s*transform 160ms ease-out;/)
        expect(rule('.ui-switch__input:checked + .ui-switch__label .ui-switch__knob', css)).toMatch(/transform:\s*translateX\(20px\);/)
        expect(rule('.ui-switch__track::before', css)).toMatch(/box-shadow:\s*inset 0 0 0 2px var\(--edge-strong\);/)
        expect(rule('.ui-switch__input:focus-visible + .ui-switch__label', css)).toMatch(/outline:\s*2px solid var\(--accent\);/)
        expect(rule('.ui-switch__label', css)).toMatch(/min-height:\s*44px;/)
        expect(rule('.ui-switch__track', blocks('@media (forced-colors: active)', css))).toMatch(/border:\s*1px solid;/)
    })
})
