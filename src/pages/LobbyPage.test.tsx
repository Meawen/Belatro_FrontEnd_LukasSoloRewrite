import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LobbyPage } from './LobbyPage'
import { preloadCardArt } from '../services/cardArt'

vi.mock('../services/cardArt', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../services/cardArt')>()),
    preloadCardArt: vi.fn(() => Promise.resolve()),
}))
vi.mock('../components/lobby/LobbyRoom', () => ({ LobbyRoom: ({ lobbyId }: { lobbyId: string }) => <p>room {lobbyId}</p> }))

describe('/lobby/:lobbyId (spec §4.7, §3.6)', () => {
    test('entering a lobby preloads the card art and shows that lobby', () => {
        render(
            <MemoryRouter initialEntries={['/lobby/l7']}>
                <Routes>
                    <Route path="/lobby/:lobbyId" element={<LobbyPage />} />
                </Routes>
            </MemoryRouter>,
        )
        expect(screen.getByText('room l7')).toBeInTheDocument()
        expect(preloadCardArt).toHaveBeenCalledTimes(1)
    })
})
