import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Banner } from './Banner'
import { EmptyState, ErrorState } from './EmptyState'
import { Button } from './Button'

describe('Banner (spec §3.7)', () => {
    test('a region named by its label, with its action at the end and a decorative icon', async () => {
        const onReturn = vi.fn()
        render(
            <Banner tone="info" label="Game in progress" action={<Button size="sm" onClick={onReturn}>Return to your game</Button>}>
                You have a game in progress.
            </Banner>,
        )
        const banner = screen.getByRole('region', { name: 'Game in progress' })
        expect(banner).toHaveTextContent('You have a game in progress.')
        expect(banner).toHaveClass('ui-banner', 'ui-banner--info')
        expect(banner.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
        await userEvent.click(screen.getByRole('button', { name: 'Return to your game' }))
        expect(onReturn).toHaveBeenCalledTimes(1)
    })

    test('warn and danger tones', () => {
        render(<><Banner tone="warn" label="Email confirmation">Confirm</Banner><Banner tone="danger" label="Problem">Down</Banner></>)
        expect(screen.getByRole('region', { name: 'Email confirmation' })).toHaveClass('ui-banner--warn')
        expect(screen.getByRole('region', { name: 'Problem' })).toHaveClass('ui-banner--danger')
    })
})

describe('EmptyState and ErrorState (spec §3.7)', () => {
    test('an empty state shows its title, body and action, without a role', () => {
        render(<EmptyState icon="cards" title="No open lobbies." body="Create one and invite friends." action={<Button>Create lobby</Button>} />)
        expect(screen.getByText('No open lobbies.')).toHaveClass('t-headline')
        expect(screen.getByText('Create one and invite friends.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create lobby' })).toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    test('an error state is an alert with its retry action', async () => {
        const onRetry = vi.fn()
        render(<ErrorState title="Couldn't load this lobby" action={<Button variant="secondary" onClick={onRetry}>Try again</Button>} />)
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this lobby")
        await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(onRetry).toHaveBeenCalledTimes(1)
    })
})
