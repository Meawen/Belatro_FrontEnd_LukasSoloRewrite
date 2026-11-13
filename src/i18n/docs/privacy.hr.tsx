import type { LegalDoc } from './types';
import { SupportEmailLink } from '../../components/layout/LegalLinks';

/** The privacy notice in Croatian (spec §1.2): legal text, a draft for the owner's review (R1). */
export const doc: LegalDoc = {
    updated: 'Zadnja izmjena: listopad 2026.',
    intro: 'Ova obavijest objašnjava što Stiglja, beta-inačica kartaške igre bele, radi s tvojim osobnim podacima.',
    sections: [
        {
            title: 'Tko vodi Stiglju',
            body: (
                <>
                    <p>Stiglju vodi Lukas Miholić, Bregana, Hrvatska.</p>
                    <p>On je voditelj obrade: odlučuje kako se tvoji podaci koriste. Za sve u vezi s tvojim podacima piši na <SupportEmailLink />.</p>
                </>
            ),
        },
        {
            title: 'Što prikupljamo',
            body: (
                <ul className="list-disc pl-6 space-y-2">
                    <li>
                        <strong>Tvoj račun:</strong> korisničko ime, e-adresu (i novu adresu dok čeka potvrdu) i lozinku, koju čuvamo
                        samo kao jednosmjerni sažetak (hash) iz kojeg se lozinka ne može vratiti.
                    </li>
                    <li>
                        <strong>Tvoj jezik:</strong> jezik koji odabereš za stranicu, hrvatski ili engleski. Preglednik ga pamti na
                        ovom uređaju; ako imaš račun, spremamo ga i uz račun i na tom ti jeziku šaljemo e-poštu. Kad se registriraš,
                        račun dobiva jezik na kojem je stranica tada bila.
                    </li>
                    <li>
                        <strong>Tvoje partije:</strong> svaku partiju koju odigraš (licitaciju, karte, prijave prekršaja i
                        rezultate), tvoj zapisnik, tvoj Elo rejting i njegovu povijest, broj partija i razinu, stolove koje otvoriš
                        ili za koje sjedneš te tvoje pajdaše i zahtjeve za pajdaše.
                    </li>
                    <li>
                        <strong>Kao gost:</strong> ako igraš bez računa, stvaramo ti gosta: ime poput gost_4821 (možeš ga
                        promijeniti), jezik stranice, kad je gost stvoren i kad je zadnji put korišten te partije koje odigra
                        (licitaciju, karte, prijave prekršaja i rezultate). Gost nema e-adresu.
                    </li>
                    <li>
                        <strong>U Redu za stol:</strong> kad je registracija puna, možeš ostaviti e-adresu da ti javimo kad se
                        oslobodi mjesto. Čuvamo adresu, jezik stranice u trenutku upisa te vrijeme upisa i potvrde.
                    </li>
                    <li>
                        <strong>Sigurnosni podaci:</strong> tvoju IP adresu, koju držimo samo u memoriji poslužitelja da bismo
                        ograničili koliko se često mogu koristiti prijava, registracija, igra kao gost, Red za stol i brojanje Škole
                        bele, i nikad je ne zapisujemo u bazu podataka; e-adresu upisanu u Red za stol, koju također držimo u
                        memoriji poslužitelja do sat vremena da bismo ograničili koliko se često ista adresa može upisati
                        (najviše 3 puta na sat); te tvoje korisničko ime u zapisima poslužitelja, koji bilježe što je usluga
                        radila (na primjer prijavu ili događaj u partiji).
                    </li>
                    <li>
                        <strong>U tvojem pregledniku:</strong> kad se prijaviš, stranica u lokalnoj pohrani preglednika čuva token za
                        prijavu, tvoj korisnički ID i korisničko ime, da prijava ostane aktivna. Odjava ih briše. Ako igraš kao
                        gost, stranica ondje na isti način čuva gosta i njegov tajni ključ, kojim te preglednik ponovno prijavljuje
                        kao tog gosta kad prijava istekne; odjava briše i ključ. Ondje pamti i tvoj jezik i postavku efekata stola. Lozinku
                        Stola za ekipu koji otvoriš čuva u pohrani te kartice preglednika dok je ne zatvoriš, da je možeš
                        podijeliti. Stiglja ne postavlja kolačiće za oglašavanje ni za analitiku i ne koristi alate za praćenje.
                    </li>
                    <li>
                        <strong>Jednostavni brojevi:</strong> da vidimo radi li beta, poslužitelj vodi nekoliko dnevnih zbrojeva:
                        koliko je partija završilo s barem dvoje ljudi za stolom, koliko je puta pokrenuta Škola bele i koliko je
                        puta završeno svako od njezina dva dijeljenja, koliko se gostiju registriralo te koliko je poveznica za
                        registraciju iz Reda za stol poslano i iskorišteno. To su samo brojevi. Da bi izbrojio igrače koji se
                        vraćaju, poslužitelj bilježi i koji su računi i gosti igrali kojeg dana, samo po korisničkom ID-u, i svaku
                        tu zabilješku briše nakon 40 dana. Kad prolaziš Školu bele, preglednik javlja poslužitelju kad je pokreneš
                        i kad završiš svako dijeljenje; poslužitelj samo povećava dnevni zbroj za jedan i ne bilježi tko si.
                    </li>
                </ul>
            ),
        },
        {
            title: 'Zašto ih koristimo',
            body: (
                <>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>
                            Da ti pružimo igru za koju imaš račun (naš ugovor s tobom): tvoj račun, tvoje partije, rangiranje i
                            pajdaše te e-poštu o tvojem računu (potvrda adrese, nova lozinka, sigurnosne obavijesti).
                        </li>
                        <li>
                            Da možeš igrati kao gost te da ti stranicu prikažemo i e-poštu šaljemo na tvojem jeziku (naš ugovor s
                            tobom).
                        </li>
                        <li>
                            Da vodimo Red za stol, na tvoj zahtjev: šaljemo ti e-poruku za potvrdu adrese i, kad se oslobodi mjesto,
                            poveznicu za registraciju. Na tu adresu ne šaljemo ništa drugo.
                        </li>
                        <li>Da vidimo radi li beta (naš legitimni interes): jednostavni brojevi opisani gore.</li>
                        <li>
                            Da Stiglja bude sigurna i da radi (naš legitimni interes): ograničavamo koliko se često mogu koristiti
                            prijava, registracija, igra kao gost, Red za stol i brojanje Škole bele te vodimo zapise kako bismo
                            pronašli pogreške i zlouporabe.
                        </li>
                    </ul>
                    <p>Tvoje podatke ne prodajemo i ne koristimo ih za oglašavanje.</p>
                </>
            ),
        },
        {
            title: 'Tko ih obrađuje za nas i gdje',
            body: (
                <>
                    <p>Ove tvrtke obrađuju podatke u naše ime, samo da bi Stiglja radila:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li><strong>Fly.io</strong> pokreće poslužitelj igre, u Frankfurtu u Njemačkoj.</li>
                        <li>
                            <strong>MongoDB Atlas</strong> čuva račune, goste, Red za stol, brojeve i povijest partija, na poslužiteljima
                            Amazon Web Services u Frankfurtu u Njemačkoj (eu-central-1).
                        </li>
                        <li>
                            <strong>Redis Cloud</strong> drži partije u tijeku i sesije prijave, na poslužiteljima Amazon Web Services u
                            Frankfurtu u Njemačkoj (eu-central-1).
                        </li>
                        <li><strong>Brevo</strong> šalje našu e-poštu, iz Europske unije.</li>
                        <li>
                            <strong>Cloudflare</strong> poslužuje ovu stranicu i slike karata, vodi DNS naše domene i prosljeđuje
                            poštu poslanu na <SupportEmailLink />.
                        </li>
                    </ul>
                    <p>
                        Fly.io i Cloudflare vide tvoju IP adresu dok prenose tvoj promet. Neke od ovih tvrtki imaju sjedište izvan
                        Europske unije, uglavnom u Sjedinjenim Američkim Državama; gdje god možemo, koristimo njihove lokacije u EU-u.
                    </p>
                </>
            ),
        },
        {
            title: 'Koliko ih dugo čuvamo',
            body: (
                <>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Tvoj račun i povijest partija: dok god račun postoji.</li>
                        <li>
                            Račun čija e-adresa nije potvrđena u roku od 7 dana od registracije: uklanjamo ga kad tih 7 dana istekne.
                            Datum piše u e-poruci koju šaljemo pri registraciji.
                        </li>
                        <li>Gost: uklanjamo ga 30 dana nakon što je zadnji put korišten, ali nikad usred partije.</li>
                        <li>
                            Kad uklonimo gosta ili nepotvrđeni račun, zamijenimo mu ime te obrišemo e-adresu i lozinku. Njegove
                            partije ostaju u zapisnicima drugih igrača, gdje se prikazuje kao „Gost”.
                        </li>
                        <li>
                            Adresa u Redu za stol: brišemo je ako nije potvrđena u roku od 7 dana. Potvrđena adresa ostaje dok se ne
                            registriraš, dok poveznica za registraciju koju ti pošaljemo ne istekne neiskorištena (nakon 7 dana) ili
                            dok ne zatražiš da je uklonimo.
                        </li>
                        <li>Zabilješke o tome tko je kojeg dana igrao, za brojeve: 40 dana. Dnevni zbrojevi ne sadrže osobne podatke.</li>
                        <li>
                            Partija u tijeku: do 24 sata nakon zadnjeg poteza; završena partija: 10 minuta. Njezin zapis zatim ostaje
                            u tvojem zapisniku.
                        </li>
                        <li>
                            IP adrese i e-adrese upisane u Red za stol koje držimo u memoriji poslužitelja radi ograničavanja
                            pokušaja: iz memorije ih brišemo unutar otprilike sat vremena i pri svakom ponovnom pokretanju
                            poslužitelja.
                        </li>
                        <li>Zapisi poslužitelja: samo onoliko dugo koliko ih čuva naš pružatelj hostinga, Fly.io.</li>
                    </ul>
                    <p>
                        Brisanje računa možeš zatražiti u bilo kojem trenutku, gumbom „Zatraži brisanje računa” u Postavkama ili
                        porukom na <SupportEmailLink />. Račun i njegove podatke brišemo u roku od 30 dana od zahtjeva.
                    </p>
                    <p>Ako želiš izaći iz Reda za stol, piši na <SupportEmailLink /> s adrese koja je na popisu i uklonit ćemo je.</p>
                </>
            ),
        },
        {
            title: 'Tvoja prava',
            body: (
                <>
                    <p>
                        Možeš zatražiti kopiju svojih podataka, njihov ispravak ili brisanje, ograničenje ili prestanak njihova
                        korištenja te da ti ih predamo u strojno čitljivom obliku. Piši na <SupportEmailLink />; odgovaramo u roku
                        od mjesec dana.
                    </p>
                    <p>
                        Ako misliš da tvoje podatke obrađujemo nezakonito, možeš podnijeti pritužbu hrvatskom nadzornom tijelu,
                        Agenciji za zaštitu osobnih podataka (AZOP):{' '}
                        <a href="https://azop.hr" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:text-text">azop.hr</a>.
                    </p>
                </>
            ),
        },
        {
            title: 'Dob',
            body: <p>Stiglja je za osobe od 16 godina naviše. Ako još nemaš 16 godina, nemoj se registrirati ni igrati kao gost.</p>,
        },
        {
            title: 'Izmjene ove obavijesti',
            body: (
                <p>
                    Ako promijenimo ovu obavijest, ažurirat ćemo ovu stranicu. Ako promjena utječe na to kako koristimo tvoje
                    podatke, javit ćemo to igračima e-poštom ili u igri prije nego što stupi na snagu.
                </p>
            ),
        },
    ],
};
