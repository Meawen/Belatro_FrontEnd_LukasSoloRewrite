import { describe, test, expect } from 'vitest'
import { en } from './en'
import { hr } from './hr'

/** Every leaf of a catalog as [dotted.path, value], depth-first. */
function leaves(node: object, prefix = ''): [string, unknown][] {
    return Object.entries(node).flatMap(([key, value]): [string, unknown][] => {
        const path = prefix ? `${prefix}.${key}` : key
        return value !== null && typeof value === 'object' ? leaves(value, path) : [[path, value]]
    })
}

describe('the catalogs (spec §1.2)', () => {
    test('hr has every key of en and nothing else, each non-empty (deep key walk)', () => {
        const enLeaves = new Map(leaves(en))
        const hrLeaves = new Map(leaves(hr))
        expect([...hrLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort())
        for (const [path, enValue] of enLeaves) {
            const hrValue = hrLeaves.get(path)
            for (const value of [enValue, hrValue]) {
                if (typeof value === 'string') expect(value.trim(), path).not.toBe('')
                else expect(typeof value, path).toBe('function')
            }
            expect(typeof hrValue, path).toBe(typeof enValue)
            if (typeof enValue === 'function' && typeof hrValue === 'function') expect(hrValue.length, path).toBe(enValue.length)
        }
    })

    test('the §1.4 names in the page titles', () => {
        const names = (titles: typeof en.titles) => [titles.home, titles.tables, titles.table, titles.matches, titles.friends, titles.profile, titles.settings, titles.ranked]
        expect(names(hr.titles)).toEqual(['Doma', 'Birtija', 'Stol', 'Zapisnik', 'Pajdaši', 'Profil', 'Postavke', 'Rangirano'])
        expect(names(en.titles)).toEqual(['Home', 'Tables', 'Table', 'Matches', 'Friends', 'Profile', 'Settings', 'Ranked'])
    })

    test('the §1.4 names S4 shows', () => {
        expect(hr.tables.privateTable).toBe('Stol za ekipu')
        expect(hr.ranked.find).toBe('Igraj rangirano')
        expect(hr.ranked.searching).toBe('Tražimo ti pajdaše…')
        expect(hr.matchDetails.capot).toBe('ŠTIGLJA')
        expect(hr.matchDetails.pass).toBe('DALJE')
        expect(en.tables.privateTable).toBe('Private table')
        expect(en.ranked.searching).toBe('Finding players…')
    })

    test('the §1.4 names S9 shows', () => {
        expect(hr.landing.learn.action).toBe('Navči me')
        expect(en.landing.learn.action).toBe('Teach me')
        expect(hr.landing.learn.title).toBe('Škola bele')
        expect(en.landing.learn.title).toBe('Bela school')
        expect(hr.home.people.ranked).toBe('Igraj rangirano')
        expect(hr.home.people.private).toBe('Stol za ekipu')
        expect(en.home.people.private).toBe('Private table')
        expect(hr.home.people.tables(3)).toBe('Birtija (3)')
        expect(hr.home.newToBela.action).toBe('Škola bele')
    })

    test('the words S10 shows (§1.4, §5, §6)', () => {
        expect(hr.board.end.playAgain).toBe('Ajmo još jednu!')
        expect(en.board.end.playAgain).toBe('Play again')
        expect(hr.titles.home).toBe('Doma')
        expect(hr.tables.privateTable).toBe('Stol za ekipu')
        expect(hr.board.end.withPeople).toBe('Igraj s ljudima')
        expect(hr.common.back).toBe('Natrag')
        expect(hr.tables.form.privateName('ana')).toBe('Kod ana')
        expect(hr.table.sharePassword('kuna7')).toBe('Lozinka: kuna7')
        expect(hr.table.shareHostKnows).toBe('Lozinku zna domaćin.')
        expect(hr.tables.emptyBots).toBe('Igraj protiv botova')
    })

    test("Ruling 48's Croatian for the landing page and Doma", () => {
        expect(hr.landing.ended.label).toBe('Sesija gosta je završila')
        expect(hr.landing.ended.body).toBe('Tvoja sesija gosta je završila. Odaberi ispod kako ćeš krenuti ispočetka.')
        expect(hr.landing.bots.body).toBe('Znam igrati: partija protiv tri bota, odmah, kao gost.')
        expect(hr.home.people.body).toBe('Pravi igrači: rangirane partije za rejting, stolovi za društvo.')
        expect(hr.landing.guest.body).toBe('Ovaj preglednik pamti tvoje ime gosta. Promijeni ga kad god želiš: to ime vide svi za stolom.')
        expect(hr.landing.rename.title).toBe('Promijeni ime gosta')
    })

    test("Ruling 44's Croatian for the needs-an-account lines", () => {
        expect(hr.guest.needsAccount.what.home).toBe('Tvoja statistika, zadnje partije i svi načini igre na jednom mjestu.')
        expect(en.guest.needsAccount.what.home).toBe('Your stats, your recent games and all the ways to play, in one place.')
        expect(hr.guest.needsAccount.what.profile).toBe('Tvoj rang, kretanje rejtinga, tvoje partije i profili drugih igrača.')
        expect(hr.guest.needsAccount.what.tables).toBe('Otvoreni stolovi: sjedni za stol s drugim igračima ili otvori svoj stol.')
    })

    test("S4's counts: three Croatian forms around 11–14 and 21–24", () => {
        expect([1, 2, 5, 11, 12, 21, 22, 25].map(hr.matches.count)).toEqual(
            ['1 partija', '2 partije', '5 partija', '11 partija', '12 partija', '21 partija', '22 partije', '25 partija'])
        expect([1, 2, 5, 21, 22].map(hr.tables.bots)).toEqual(['1 bot', '2 bota', '5 botova', '21 bot', '22 bota'])
        expect([1, 2, 5].map(hr.tables.open)).toEqual(['1 otvoren stol', '2 otvorena stola', '5 otvorenih stolova'])
        expect([1, 2, 12].map(hr.admin.users.found)).toEqual(['Pronađen 1 korisnik', 'Pronađena 2 korisnika', 'Pronađeno 12 korisnika'])
        expect([1, 2, 4].map(hr.matchDetails.cardCount)).toEqual(['1 karta', '2 karte', '4 karte'])
    })

    test("§1.4's game moments, word for word", () => {
        const moments = (c: typeof en) => [
            c.board.result.fellMine, c.board.result.fellTheirs, c.game.end.won, c.game.end.lost, c.board.bid.mustCall, c.board.away,
            c.board.peek.lastTrick, c.common.loading, c.board.end.playAgain, c.board.capot, c.board.pass, c.board.yourTurn, c.board.bela.chip,
        ]
        expect(moments(hr)).toEqual([
            'Pad! Pali ste.', 'Pad! Pali su.', 'Kaj ste dobri, pajdaši!', 'Bu bolje drugi put.', 'Mus! Moraš zvati.', 'Zaspal si?',
            'Zadnji štih', 'Mešamo karte…', 'Ajmo još jednu!', 'Štiglja!', 'Dalje', 'Na tebi je!', 'Bela!',
        ])
        expect(moments(en)).toEqual([
            'Fell! You fell.', 'They fell.', 'You won!', 'Next time.', 'You must call trump.', 'Still there?',
            'Last trick', 'Shuffling…', 'Play again', 'Capot', 'Pass', 'Your turn', 'Bela!',
        ])
        // the seat's card count, for screen readers (S5 call 13)
        expect([1, 2, 5, 11, 21, 22].map(hr.board.seat.cards)).toEqual(['karta', 'karte', 'karata', 'karata', 'karta', 'karte'])
        expect([1, 2].map(en.board.seat.cards)).toEqual(['card', 'cards'])
    })

    test("S5's Croatian, corrected (Ruling 25): a four agrees with karte, and a challenge that finds no foul", () => {
        expect(hr.board.moment.fourMine('A', 100)).toBe('Imaš četiri iste, to tuče niz: ekipa A piše 100')
        expect(hr.board.moment.four('ivo', 'A', 100)).toBe('ivo ima četiri iste, to tuče niz: ekipa A piše 100')
        expect(hr.board.say.failed('ivo')).toBe('ivo prijavljuje prekršaj, ali prekršaja nema')
    })

    test("S4's Croatian, corrected (Ruling 23)", () => {
        expect(hr.table.removed).toBe('Više nisi za ovim stolom.')
        expect(hr.table.removeTitle('ana')).toBe('Maknuti igrača ana sa stola?')
        expect(hr.table.removeConfirm('ana')).toBe('Makni igrača ana')
        expect([1, 2, 5, 21].map(hr.rank.ladder.placing)).toEqual(
            ['1 igrač se još svrstava', '2 igrača se još svrstavaju', '5 igrača se još svrstava', '21 igrač se još svrstava'])
        expect(hr.rank.forecast.far('Majster', 100)).toBe('Ovim tempom: Majster za više od 100 partija.')
        expect([1, 2, 7].map(hr.rank.ladder.toJoin)).toEqual([
            'Odigraj još 1 rangiranu partiju da se svrstaš.',
            'Odigraj još 2 rangirane partije da se svrstaš.',
            'Odigraj još 7 rangiranih partija da se svrstaš.',
        ])
    })

    test("the guest's words: Gost (§1.4) and the after-guide buttons (spec §7.4)", () => {
        expect(hr.guest.removed).toBe('Gost')
        expect(en.guest.removed).toBe('Guest')
        expect(hr.guest.needsAccount.signUp).toBe('Registriraj se')
        expect(hr.guest.needsAccount.bots).toBe('Igraj protiv botova kao gost')
    })

    test("the guest codes' lines: what happened, then what to do (Ruling 4)", () => {
        const lines = (c: typeof en) => [c.errors.codes.IN_GAME, c.errors.codes.GUEST_ONLY, c.errors.codes.ALREADY_IN_GAME]
        expect(lines(en)).toEqual([
            "You can't change your name while you're at a table or in a game. Leave the table or finish the game, then try again.",
            'Only a guest can change their name this way.',
            // B5's sentence, then what to do
            'You already have a game in progress. Go back to it first.',
        ])
        expect(lines(hr)).toEqual([
            'Ime ne možeš mijenjati dok sjediš za stolom ili igraš partiju. Napusti stol ili dovrši partiju pa pokušaj ponovno.',
            'Ime na ovaj način može promijeniti samo gost.',
            'Već imaš partiju u tijeku. Prvo se vrati u nju.',
        ])
    })

    test("S7's username lines, corrected (Ruling 34)", () => {
        expect(en.errors.codes.USERNAME_TAKEN).toBe(
            'Username is already taken. Names that differ only in capitals or in the marks on č ć š ž đ count as the same name. Choose another one.')
        expect(hr.errors.codes.USERNAME_TAKEN).toBe(
            'To korisničko ime već je zauzeto. Imena koja se razlikuju samo po velikim i malim slovima ili po kvačicama (č ć š ž đ) smatraju se istim imenom. Odaberi drugo.')
        expect(hr.errors.codes.USERNAME_RESERVED).toBe('Imena koja počinju s obrisan_ rezervirana su. Odaberi drugo ime.')
        expect(hr.errors.rules.username).toBe('Korisničko ime mora imati 3–20 znakova: slova (uključujući č ć š ž đ), brojke ili donju crtu.')
    })

    test("the waitlist is Red za stol / Waitlist (§1.4), and the invite field's keys are gone (spec §2.1)", () => {
        expect(hr.auth.waitlist.title).toBe('Red za stol')
        expect(hr.titles.waitlist).toBe('Red za stol')
        expect(en.auth.waitlist.title).toBe('Waitlist')
        expect(en.titles.waitlist).toBe('Waitlist')
        for (const signUp of [en.auth.signUp, hr.auth.signUp]) {
            expect(Object.keys(signUp).filter((key) => key.startsWith('inviteCode'))).toEqual([])
        }
        // the server still answers it while signup.invite-code is set (B7, flag 7)
        expect(en.errors.codes.INVITE_CODE_INVALID).toBeTruthy()
    })

    test("Ruling 62's Croatian for the waitlist and the cap: no 'u redu' that reads as 'okay', no 'puna registracija'", () => {
        expect(hr.auth.waitlist.lead).toBe('Zasad nema slobodnih mjesta. Ostavi e-adresu i javit ćemo ti se čim se oslobodi mjesto.')
        expect(hr.auth.waitlist.confirmFirst).toBe('Najprije ćemo ti poslati poveznicu za potvrdu. Mjesto ti čuvamo tek kad potvrdiš adresu.')
        expect(hr.auth.waitlistConfirm.button).toBe('Potvrdi svoje mjesto')
        expect(hr.auth.waitlistConfirm.failed).toBe('Tvoje mjesto nismo uspjeli potvrditi.')
        expect(hr.admin.beta.waiting).toBe('Čekaju u redu (potvrđeni)')
        expect(hr.admin.beta.cap).toBe('Najveći broj računa')
        expect(hr.admin.beta.capHelper).toBe(
            'Najviše računa u beti; botovi i gosti se ne broje. Ostavi prazno ako ograničenja nema. Kad povećaš ograničenje, sljedeći u redu odmah dobivaju e-poruku.')
        expect(hr.errors.codes.SIGNUP_FULL).toBe(
            'Slobodnih mjesta više nema pa račun nije izrađen. Ispod se upiši u Red za stol i javit ćemo ti se e-porukom čim se oslobodi mjesto.')
        expect(hr.errors.codes.INVITE_LINK_INVALID).toBe(
            'Ova poveznica za registraciju ne vrijedi ili je istekla, a slobodnih mjesta trenutno nema. Ponovno se upiši ispod u Red za stol ili igraj kao gost.')
    })

    test("the line when English didn't load (Ruling 62): what happened, and what to do", () => {
        expect(en.langSwitch.englishFailed).toBe("English didn't load. Reload the page to try again.")
        expect(hr.langSwitch.englishFailed).toBe('Engleski se nije učitao. Ponovno učitaj stranicu pa pokušaj opet.')
    })

    test('the §1.4 words S13 shows', () => {
        expect(hr.titles.learn).toBe('Škola bele')
        expect(en.titles.learn).toBe('Bela school')
        expect(hr.guide.lessons.mus.title).toBe('Mus! Moraš zvati.')
        expect(en.guide.lessons.mus.title).toBe('You must call trump.')
        expect(hr.guide.lessons.padanje.title).toBe('Pad! Pali ste.')
        expect(en.guide.lessons.padanje.title).toBe('Fell! You fell.')
        expect(hr.guide.lessons.lastTrick.title).toBe('Zadnji štih')
        expect(hr.guide.do.challenge).toContain('Prijavi prekršaj')
        expect(hr.guide.exit.label).toBe('Izađi')
        expect(en.guide.exit.label).toBe('Exit')
        // a lesson-only stop's button is not "Dalje", which is the bid's Pass (§1.4)
        expect(hr.guide.next).toBe('Nastavi')
        expect(hr.guide.next).not.toBe(hr.board.pass)
        expect(en.guide.next).toBe('Next')
    })

    test("Ruling 69's corrections to Škola bele's copy: the 152/162 count, and the Croatian found by its text", () => {
        expect(en.guide.intro.lastTrick).toBe("The last trick is worth 10 more: a hand's cards are worth 152, and 162 with the last trick.")
        expect(hr.guide.intro.lastTrick).toBe('Zadnji štih vrijedi još 10: karte jednog dijeljenja vrijede 152 boda, a sa zadnjim štihom 162.')
        expect(hr.guide.intro.deck).toMatch(/^Bela se igra s 32 karte: /)
        expect(hr.guide.intro.trumpNote).toContain('na početku dijeljenja; ona tuče sve ostale boje.')
        expect(hr.guide.lessons.dalje.body).toContain('a Ivo i Ana igraju protiv vas')
        expect(hr.guide.lessons.dalje.body).toContain('Redom, počevši od igrača nakon djelitelja,')
        expect(hr.guide.lessons.dalje.body).toContain('pa si na redu na kraju.')
        expect(hr.guide.lessons.mus.body).toContain('Kad svi ostali kažu „Dalje”')
        expect(hr.guide.lessons.mus.body).toContain('a Kralj i Baba aduta čine belu')
        expect(hr.guide.lessons.zvanja.body).toContain('Igra sama pronalazi zvanja i objavljuje ih')
        expect(hr.guide.lessons.followSuit.body).toContain('s tvojom kartom te četiri karte čine štih')
        expect(hr.guide.lessons.bela.body).toContain('Kralj i Baba aduta čine belu')
        expect(hr.guide.lessons.bela.body).toContain('igra sama ne broji belu')
        expect(hr.guide.lessons.followTrump.body).toContain('Kad netko otvori adutom')
        expect(hr.guide.lessons.lead.body).toContain('As Tref je već pao')
        expect(hr.guide.lessons.padanje.body).toContain('tvoja ih nema više')
        expect(hr.guide.lessons.padanje.body).toContain('sva 232 boda')
        expect(hr.guide.illegal.bela).toBe('Ivo je otvorio Hercom, a ti ga imaš: moraš odgovoriti Hercom.')
        expect(hr.guide.illegal.followTrump).toBe('Ana je otvorila adutom, a ti imaš Herc: moraš odgovoriti adutom.')
        expect(hr.guide.refuse.bela).toContain('inače nećeš dobiti njezinih 20 bodova')
        expect(hr.guide.refuse.challengeEarly).toMatch(/^U pravoj igri možeš prijaviti čim/)
        expect(hr.guide.refuse.challengeFoul).toContain('točna bi prijava sad odmah završila')
        expect(hr.guide.end.learned).toContain('zbrojiti bodove dijeljenja')
        expect(en.guide.lessons.followSuit.body).toContain('with your card these four cards make a trick')
        expect(en.guide.lessons.lead.body).toContain('The As Tref has been played, so')
        // every "smiješ" says what you may do, and no "Smiješ i nju"
        for (const [path, value] of leaves(hr.guide)) {
            if (typeof value !== 'string') continue
            expect(value, path).not.toMatch(/smiješ bilo/i)
            expect(value, path).not.toContain('Smiješ i nju')
        }
    })
})
