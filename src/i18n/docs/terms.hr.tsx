import type { LegalDoc } from './types';
import { SupportEmailLink } from '../../components/layout/LegalLinks';

/** The terms of use in Croatian (spec §1.2): legal text, a draft for the owner's review (R1). */
export const doc: LegalDoc = {
    updated: 'Zadnja izmjena: listopad 2026.',
    intro: 'Izradom računa ili igrom kao gost prihvaćaš ove uvjete.',
    sections: [
        {
            title: 'Usluga',
            body: (
                <p>
                    Stiglja je online inačica kartaške igre bele, a vodi je Lukas Miholić, Bregana, Hrvatska
                    (<SupportEmailLink />). Ovo je beta: igranje je besplatno, a mogućnosti se mogu mijenjati dok testiramo.
                </p>
            ),
        },
        {
            title: 'Bez jamstva',
            body: (
                <p>
                    Beta se pruža takva kakva jest, bez ikakvog jamstva. Trudimo se da radi i da tvoji podaci budu sigurni, ali
                    može biti nedostupna, izgubiti partiju u tijeku ili sadržavati pogreške. U mjeri u kojoj zakon to dopušta, ne
                    odgovaramo za štetu nastalu njezinim korištenjem.
                </p>
            ),
        },
        {
            title: 'Tvoj račun',
            body: <p>Moraš imati najmanje 16 godina. Lozinku nikome ne odaj: za sve što se radi s tvojim računom odgovornost snosiš ti.</p>,
        },
        {
            title: 'Registracija i Red za stol',
            body: (
                <>
                    <p>
                        Dok u beti ima mjesta, registrirati se može svatko. Broj računa je ograničen, a ograničenje možemo
                        promijeniti u bilo kojem trenutku. Potvrdi e-adresu u roku od 7 dana od registracije, inače se račun
                        uklanja; e-poruka za potvrdu navodi datum.
                    </p>
                    <p>
                        Kad je beta puna, možeš se e-adresom upisati u Red za stol. Potvrdi je putem e-poruke koju ti pošaljemo, u
                        roku od 7 dana, inače se adresa briše. Kad se oslobodi mjesto, sljedećoj potvrđenoj adresi šaljemo osobnu
                        poveznicu za registraciju, redom kojim su adrese potvrđene. Poveznica vrijedi 7 dana, čak i ako je
                        registracija u međuvremenu opet puna; ako se ne iskoristi, mjesto ide sljedećem u redu. Registracijom
                        izlaziš iz reda.
                    </p>
                </>
            ),
        },
        {
            title: 'Igra kao gost',
            body: (
                <>
                    <p>
                        Možeš igrati i bez računa, kao gost: protiv botova i za stolom čiju ti je poveznicu netko poslao. I gosti
                        moraju imati najmanje 16 godina. Gost dobiva ime poput gost_4821, koje možeš promijeniti; za imena gostiju
                        vrijede ista pravila kao za korisnička imena (vidi Korisnička imena).
                    </p>
                    <p>
                        Gost pripada pregledniku u kojem je nastao: ako obrišeš pohranu tog preglednika, gost je izgubljen, a gost
                        koji se ne koristi 30 dana uklanja se. Za rangirane partije, rejting, pajdaše i zapisnik treba račun. Ako se
                        registriraš u istom pregledniku, počinješ ispočetka: ime gosta možeš zadržati, ali njegove partije ne
                        prelaze na tvoj račun.
                    </p>
                </>
            ),
        },
        {
            title: 'Poštena igra',
            body: (
                <>
                    <p>Igraj da pobijediš, i to pošteno. Posebno nemoj:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>drugom igraču otkrivati svoje karte ni dogovarati s njim poteze izvan igre;</li>
                        <li>koristiti više od jednog računa ni dopustiti da netko drugi igra na tvojem;</li>
                        <li>koristiti botove, skripte ili bilo što drugo što igra ili čita igru umjesto tebe;</li>
                        <li>iskorištavati pogreške u igri (radije ih prijavi);</li>
                        <li>vrijeđati druge igrače, prijetiti im ili ih uznemiravati.</li>
                    </ul>
                </>
            ),
        },
        {
            title: 'Korisnička imena',
            body: (
                <p>
                    Odaberi korisničko ime koje nije uvredljivo, ne predstavlja te kao nekog drugog i ne sadrži tuđe privatne
                    podatke. Račun čije ime krši ovo pravilo možemo preimenovati ili ukloniti.
                </p>
            ),
        },
        {
            title: 'Prijava problema',
            body: <p>Igrača, korisničko ime, pogrešku ili sigurnosni problem prijavi porukom na <SupportEmailLink />.</p>,
        },
        {
            title: 'Uklanjanje računa',
            body: (
                <p>
                    Račun ili gosta koji vara, uznemirava druge igrače, zlorabi uslugu ili na drugi način krši ove uvjete možemo
                    suspendirati ili ukloniti. Stiglju možeš prestati koristiti u bilo kojem trenutku i zatražiti brisanje računa
                    (vidi Obavijest o privatnosti). Uklanjamo i račun čija e-adresa nije potvrđena u roku od 7 dana od
                    registracije te gosta koji se ne koristi 30 dana.
                </p>
            ),
        },
        {
            title: 'Izmjene i mjerodavno pravo',
            body: (
                <p>
                    Ove uvjete možemo izmijeniti. Ako je promjena za tebe važna, javit ćemo ti e-poštom ili u igri prije nego što
                    stupi na snagu. Na ove se uvjete primjenjuje hrvatsko pravo.
                </p>
            ),
        },
    ],
};
