import { describe, test, expect, vi, afterEach } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { FC } from 'react'
import { RulesPage } from './RulesPage'
import { PrivacyPage } from './PrivacyPage'
import { TermsPage } from './TermsPage'
import { setLang, type Lang } from '../../i18n/lang'

// Tailwind's own colour scale and white/black: the design uses tokens only (spec §3.2)
const RAW_COLOUR = /\b(?:bg|text|border|from|to|via)-(?:(?:amber|emerald|slate|red|purple|gray|blue|yellow|green|orange|teal|lime|pink)-\d|white\b|black\b)/

// signed out: the frame's active-game banner asks nothing
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, token: null }) }))

afterEach(() => setLang('en'))

/** A rendered page's text, whitespace collapsed. */
const read = (container: HTMLElement) => container.textContent!.replace(/\s+/g, ' ')

/** Renders a page in a language and waits for its document (open beta §1.2: each language's text is its own chunk). */
async function renderIn(lang: Lang, Page: FC, firstSection: string) {
    setLang(lang)
    const view = render(<Page />, { wrapper: MemoryRouter })
    await screen.findByRole('heading', { level: 2, name: firstSection })
    return view
}

describe('Rules, Privacy and Terms (spec §4.15)', () => {
    test.each([
        // ranks spec §9: the Rules page opens with its visual guide
        ['en', 'Rules', RulesPage, 'How to play'],
        ['en', 'Privacy notice', PrivacyPage, 'Who runs Stiglja'],
        ['en', 'Terms of use', TermsPage, 'The service'],
        ['hr', 'Pravila', RulesPage, 'Kako se igra'],
        ['hr', 'Obavijest o privatnosti', PrivacyPage, 'Tko vodi Stiglju'],
        ['hr', 'Uvjeti korištenja', TermsPage, 'Usluga'],
    ] as [Lang, string, FC, string][])('each page in each language (%s, %s): the display title, headline sections, token colours only', async (lang, title, Page, firstSection) => {
        setLang(lang)
        const { container } = render(<Page />, { wrapper: MemoryRouter })
        // the frame and its title at once; the text when its document arrives
        expect(screen.getByRole('heading', { level: 1, name: title })).toHaveClass('t-display')
        await screen.findByRole('heading', { level: 2, name: firstSection })
        const sections = screen.getAllByRole('heading', { level: 2 })
        expect(sections[0]).toHaveTextContent(firstSection)
        for (const heading of sections) expect(heading).toHaveClass('t-headline')
        expect(container.innerHTML).not.toMatch(RAW_COLOUR)
    })

    test("Privacy states the open beta's data, word for word, in both languages", async () => {
        const en = read((await renderIn('en', PrivacyPage, 'Who runs Stiglja')).container)
        for (const text of [
            'Stiglja is run by Lukas Miholić, Bregana, Croatia.',
            'Your browser keeps it on this device; if you have an account, we also save it on your account and send your emails in it.',
            'A guest: removed 30 days after it was last used, never in the middle of a game.',
            'An account whose email address is not confirmed within 7 days of signup: removed when those 7 days are over.',
            'A waitlist address: deleted if it is not confirmed within 7 days.',
            'Notes of who played on which day, for the counts: 40 days.',
            'To leave the waitlist, write to support@stiglja.com from the address on the list, and we remove it.',
            // Ruling 28: the waitlist's per-address limit, and every limited action under "Why we use it"
            "the email address you enter for the waitlist, also kept in the server's memory for up to an hour to limit how often one address can join (at most 3 times an hour);",
            "To keep Stiglja secure and working (our legitimate interest): limiting how often sign-in, signup, guest play, the waitlist and Bela school's counts can be used, and keeping logs to find faults and abuse.",
            // Ruling 32: the guest's secret on the device; Ruling 34: the waitlist address in memory, in the retention list
            "If you play as a guest, the site keeps the guest there in the same way, with the guest's secret key, which signs you back in as that guest when your sign-in runs out; signing out removes it too.",
            "IP addresses and waitlist email addresses held in the server's memory to limit attempts: dropped from memory within about an hour, and whenever the server restarts.",
        ]) expect(en, text).toContain(text)
        expect(en).not.toMatch(/invite/i)
        cleanup()

        const hr = read((await renderIn('hr', PrivacyPage, 'Tko vodi Stiglju')).container)
        for (const text of [
            'Stiglju vodi Lukas Miholić, Bregana, Hrvatska.',
            'Preglednik ga pamti na ovom uređaju; ako imaš račun, spremamo ga i uz račun i na tom ti jeziku šaljemo e-poštu.',
            'Gost: uklanjamo ga 30 dana nakon što je zadnji put korišten, ali nikad usred partije.',
            'Račun čija e-adresa nije potvrđena u roku od 7 dana od registracije: uklanjamo ga kad tih 7 dana istekne.',
            'Adresa u Redu za stol: brišemo je ako nije potvrđena u roku od 7 dana.',
            'Zabilješke o tome tko je kojeg dana igrao, za brojeve: 40 dana.',
            'Ako želiš izaći iz Reda za stol, piši na support@stiglja.com s adrese koja je na popisu i uklonit ćemo je.',
            'e-adresu upisanu u Red za stol, koju također držimo u memoriji poslužitelja do sat vremena da bismo ograničili koliko se često ista adresa može upisati (najviše 3 puta na sat);',
            'Da Stiglja bude sigurna i da radi (naš legitimni interes): ograničavamo koliko se često mogu koristiti prijava, registracija, igra kao gost, Red za stol i brojanje Škole bele te vodimo zapise kako bismo pronašli pogreške i zlouporabe.',
            'Ako igraš kao gost, stranica ondje na isti način čuva gosta i njegov tajni ključ, kojim te preglednik ponovno prijavljuje kao tog gosta kad prijava istekne; odjava briše i ključ.',
            'IP adrese i e-adrese upisane u Red za stol koje držimo u memoriji poslužitelja radi ograničavanja pokušaja: iz memorije ih odbacujemo u roku od otprilike sat vremena i pri svakom ponovnom pokretanju poslužitelja.',
        ]) expect(hr, text).toContain(text)
        expect(hr).not.toMatch(/pozivn/i)
    })

    test('Terms: open signup, the waitlist, guests and the 7-day rule; no invite code', async () => {
        const en = read((await renderIn('en', TermsPage, 'The service')).container)
        expect(en).toContain('Signing up takes you off the list.')
        expect(en).toContain('We also remove an account whose email address is not confirmed within 7 days of signing up, and a guest not used for 30 days.')
        expect(en).not.toMatch(/invite/i)
        cleanup()

        const hr = read((await renderIn('hr', TermsPage, 'Usluga')).container)
        expect(hr).toContain('Registracijom izlaziš iz reda.')
        expect(hr).toContain('Uklanjamo i račun čija e-adresa nije potvrđena u roku od 7 dana od registracije te gosta koji se ne koristi 30 dana.')
        expect(hr).not.toMatch(/pozivn/i)
    })

    test('a switch on an open page shows the other language, and a switch back is instant', async () => {
        render(<PrivacyPage />, { wrapper: MemoryRouter })
        await screen.findByRole('heading', { level: 2, name: 'Who runs Stiglja' })
        act(() => setLang('hr'))
        expect(await screen.findByRole('heading', { level: 2, name: 'Tko vodi Stiglju' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { level: 2, name: 'Who runs Stiglja' })).not.toBeInTheDocument()
        act(() => setLang('en'))
        expect(screen.getByRole('heading', { level: 2, name: 'Who runs Stiglja' })).toBeInTheDocument()
    })

    // Ruling 24: a visitor who lands on a public page signed out can switch the language there
    test('the HR · EN switch on a public page switches the page', async () => {
        const user = userEvent.setup()
        render(<TermsPage />, { wrapper: MemoryRouter })
        await screen.findByRole('heading', { level: 2, name: 'The service' })
        const group = within(screen.getByRole('group', { name: 'Site language' }))
        expect(group.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
        await user.click(group.getByRole('button', { name: 'HR' }))
        expect(screen.getByRole('heading', { level: 1, name: 'Uvjeti korištenja' })).toBeInTheDocument()
        expect(await screen.findByRole('heading', { level: 2, name: 'Usluga' })).toBeInTheDocument()
        expect(within(screen.getByRole('group', { name: 'Jezik stranice' })).getByRole('button', { name: 'HR' })).toHaveAttribute('aria-pressed', 'true')
    })
})
