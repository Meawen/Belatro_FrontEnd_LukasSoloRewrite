import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MatchHistory } from './MatchHistory'
import { apiClient } from '../../services/api'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

afterEach(() => vi.restoreAllMocks())

const SUMMARY = '/user/u1/history/summary?page=0&size=10'
const DETAILED = '/user/u1/history?page=0&size=10'

describe('MatchHistory requests (R-9)', () => {
    test('the summary view asks only for the summary; the detailed view asks for the history once', async () => {
        const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ content: [] })
        render(<MatchHistory />)
        await waitFor(() => expect(get).toHaveBeenCalledWith(SUMMARY))
        expect(get.mock.calls.map(([url]) => url)).toEqual([SUMMARY])

        await userEvent.setup().selectOptions(await screen.findByRole('combobox'), 'detailed')
        await waitFor(() => expect(get).toHaveBeenCalledWith(DETAILED))
        expect(get.mock.calls.map(([url]) => url)).toEqual([SUMMARY, DETAILED])
    })
})
