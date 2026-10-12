import { describe, test, expect, vi } from 'vitest'
import { createRef, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'
import { Select } from './Select'
import { blocks, rule, uiCss } from '../../test/css'

describe('Input (spec §3.7)', () => {
    test('its label is tied by an id that stays the same on every render (today: a new random id each time)', () => {
        const { rerender } = render(<Input label="Lobby name" value="" onChange={() => {}} />)
        const input = screen.getByLabelText('Lobby name')
        const id = input.id
        expect(id).not.toBe('')
        expect(screen.getByText('Lobby name')).toHaveAttribute('for', id)
        rerender(<Input label="Lobby name" value="Kod Mire" onChange={() => {}} />)
        expect(screen.getByLabelText('Lobby name')).toBe(input)
        expect(input.id).toBe(id)
    })

    test('an id passed in wins', () => {
        render(<Input label="Password" id="password" type="password" />)
        expect(screen.getByLabelText('Password')).toHaveAttribute('id', 'password')
    })

    test('helper and error describe the field; an error marks it invalid and replaces the helper', () => {
        const { rerender } = render(<Input label="Lobby name" helper="Up to 50 characters" />)
        const input = screen.getByLabelText('Lobby name')
        expect(input).toHaveAccessibleDescription('Up to 50 characters')
        expect(input).not.toHaveAttribute('aria-invalid')
        rerender(<Input label="Lobby name" helper="Up to 50 characters" error="Lobby name is required" />)
        expect(input).toHaveAccessibleDescription('Lobby name is required')
        expect(input).toHaveAttribute('aria-invalid', 'true')
        expect(screen.queryByText('Up to 50 characters')).not.toBeInTheDocument()
    })

    test('a hidden label still names the field', () => {
        render(<Input label="Search lobbies" hideLabel type="search" />)
        expect(screen.getByRole('searchbox', { name: 'Search lobbies' })).toBeInTheDocument()
        expect(screen.getByText('Search lobbies')).toHaveClass('sr-only')
    })

    test('typing goes through, and the ref reaches the input', async () => {
        const ref = createRef<HTMLInputElement>()
        function Controlled() {
            const [value, setValue] = useState('')
            return <Input ref={ref} label="Lobby name" value={value} onChange={(event) => setValue(event.target.value)} />
        }
        render(<Controlled />)
        await userEvent.type(screen.getByLabelText('Lobby name'), 'Kod Mire')
        expect(screen.getByLabelText('Lobby name')).toHaveValue('Kod Mire')
        expect(ref.current).toBe(screen.getByLabelText('Lobby name'))
    })

    test('the edge is --edge-strong (≥ 3:1); the focus ring is the 2-px accent outline inside the box; forced colours add a border', () => {
        const css = uiCss()
        expect(rule('.ui-field__box', css)).toMatch(/--field-edge:\s*var\(--edge-strong\);/)
        expect(rule('.ui-field__box:has(:focus-visible)', css)).toMatch(/outline:\s*2px solid var\(--accent\);\s*outline-offset:\s*-5px;/)
        expect(rule('.ui-field__control:focus-visible', css)).toMatch(/outline:\s*none;/)
        expect(rule('.ui-field__control', css)).toMatch(/font-size:\s*1rem;/)
        expect(rule('.ui-field__box', blocks('@media (forced-colors: active)', css))).toMatch(/border:\s*1px solid;/)
    })
})

describe('Select (spec §3.7)', () => {
    test('its label is tied (today it is not), and a choice reports the value', async () => {
        const onChange = vi.fn()
        render(
            <Select
                label="Sort by"
                value="newest"
                onChange={onChange}
                options={[{ value: 'newest', label: 'Newest' }, { value: 'name', label: 'Name' }, { value: 'players', label: 'Most players' }]}
            />,
        )
        const select = screen.getByRole('combobox', { name: 'Sort by' })
        expect(select).toHaveValue('newest')
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Newest', 'Name', 'Most players'])
        await userEvent.selectOptions(select, 'Most players')
        expect(onChange).toHaveBeenCalledWith('players')
    })

    test('helper and error describe it like an Input', () => {
        render(<Select label="Sort by" value="a" onChange={() => {}} options={[{ value: 'a', label: 'A' }]} error="Pick one" />)
        expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveAccessibleDescription('Pick one')
    })
})
