import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorAlert } from './ErrorAlert'

describe('ErrorAlert', () => {
    test('renders the message as an alert with the shared error styling', () => {
        render(<ErrorAlert message="Nothing to confirm" />)
        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent('Nothing to confirm')
        expect(alert).toHaveClass('text-red-400', 'text-sm', 'bg-red-900/20', 'p-3', 'rounded', 'border', 'border-red-500/30')
    })

    test('appends an extra className', () => {
        render(<ErrorAlert message="Nothing to confirm" className="mb-4" />)
        expect(screen.getByRole('alert')).toHaveClass('bg-red-900/20', 'mb-4')
    })

    test('renders nothing without a message', () => {
        const { container } = render(<ErrorAlert message={null} />)
        expect(container).toBeEmptyDOMElement()
    })
})
