import { render, screen } from '@testing-library/react'

test('vitest + jsdom + RTL are wired', () => {
    render(<div>belatro-test-infra</div>)
    expect(screen.getByText('belatro-test-infra')).toBeInTheDocument()
})
