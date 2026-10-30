import type { Catalog } from './types';

// The Croatian catalog (spec §1.2): en.ts's keys, in natural Croatian (informal "ti"). The notes on where each string
// shows, and the rule for every catalog file, are in en.ts.
export const hr = {
    meta: {
        description: 'Stiglja: bela za četvero, online.',
    },
    titles: {
        home: 'Doma',
        tables: 'Birtija',
        table: 'Stol',
        matches: 'Zapisnik',
        matchDetails: 'Detalji partije',
        friends: 'Pajdaši',
        profile: 'Profil',
        settings: 'Postavke',
        ranked: 'Rangirano',
        leaderboard: 'Ljestvica',
        admin: 'Administracija',
        game: 'Partija',
        rules: 'Pravila',
        privacy: 'Obavijest o privatnosti',
        terms: 'Uvjeti korištenja',
        signIn: 'Prijava',
        signUp: 'Registracija',
        forgotPassword: 'Zaboravljena lozinka',
        resetPassword: 'Nova lozinka',
        confirmEmail: 'Potvrda e-adrese',
        notFound: 'Stranica nije pronađena',
    },
    langSwitch: {
        label: 'Jezik stranice',
    },
    settings: {
        language: {
            heading: 'Jezik',
            body: 'Jezik stranice. Pamtimo ga na ovom uređaju i na tvom računu.',
            hr: 'Hrvatski',
            en: 'English',
        },
    },
    time: {
        justNow: 'maloprije',
    },
} satisfies Catalog;
