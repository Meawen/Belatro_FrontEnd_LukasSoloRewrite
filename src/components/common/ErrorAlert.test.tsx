import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorAlert } from './ErrorAlert'

describe('ErrorAlert', () => {
    test('renders the message as an alert with the shared error styling', () => {
        render(<ErrorAlert message="Nothing to confirm" />)
        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent(/^Nothing to confirm$/)
        expect(alert).toHaveClass('notch', 'bg-surface', 'text-danger-text', 't-callout', 'px-3', 'py-2')
        expect(alert.className).not.toMatch(/\b(red|emerald|slate|gray)-/)
        expect(alert.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    })

    test('appends an extra className', () => {
        render(<ErrorAlert message="Nothing to confirm" className="mb-4" />)
        expect(screen.getByRole('alert')).toHaveClass('text-danger-text', 'mb-4')
    })

    test('renders nothing without a message', () => {
        const { container } = render(<ErrorAlert message={null} />)
        expect(container).toBeEmptyDOMElement()
    })
})
