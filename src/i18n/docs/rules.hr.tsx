import type { RulesDoc } from './types';
import { RULE_RANKS } from '../../components/info/rulesData';
import type { RankKey } from '../../types/user';

// the Ranks table's "From" column
const RANK_FROM: Record<RankKey, string> = {
    CUCEK: 'manje od 10 rangiranih partija',
    DECEC: 'ispod 1000',
    FAKIN: '1000',
    PAJDAS: '1200',
    GOSPON: '1400',
    MAJSTER: '1600',
    KAJKAVAC: '1800',
};

/** The Rules page in Croatian (spec §1.2, §1.3): a draft for the owner's review (R1). */
export const doc: RulesDoc = {
    intro: 'Stiglja je bela za četvero igrača, u dvije ekipe po dvoje: ekipa A i ekipa B. Suigrači sjede jedan nasuprot drugome. Pobjeđuje ekipa koja prva skupi 1001 bod.',
    steps: {
        teams: { title: 'Dvije ekipe', text: 'Suigrači sjede jedan nasuprot drugome. Pobjeđuje ekipa koja prva skupi 1001 bod.' },
        cards: { title: '32 karte, dva redoslijeda', text: 'U adutu Dečko i 9 skaču na vrh. Zadnji štih vrijedi još 10: u dijeljenju su 162 boda.' },
        bidding: {
            title: 'Zovi adut ili reci „Dalje”',
            text: 'Svatko dobije šest karata. Zovi adut ili reci „Dalje”; ako svi kažu „Dalje”, djelitelj mora zvati (mus). Zatim stižu još dvije karte.',
        },
        follow: {
            title: 'Odgovori na boju',
            text: 'Odgovori na boju i nadjačaj najjaču kartu ako možeš. Nemaš te boje? Reži adutom, jačim ako možeš. Nemaš ni aduta? Baci bilo koju kartu.',
        },
        declarations: {
            title: 'Zvanja i bela',
            text: 'Zvanja se kažu naglas kad se zove adut, prije prve karte: 3 zaredom 20, 4 zaredom 50, 5 do 7 zaredom 100; svih osam karata jedne boje dobiva partiju. Ekipa s najjačim zvanjem piše sva svoja. Belu zoveš gumbom „Baci + bela”.',
        },
        hand: {
            title: 'Dobij dijeljenje',
            text: 'Ekipa koja je zvala adut mora imati više bodova, inače pada i druga ekipa nosi cijelo dijeljenje. Svih osam štihova: još 90.',
        },
        challenge: {
            title: 'Prijavi prekršaj',
            text: 'Igra ne blokira nedopuštene karte. Pritisni „Prijavi prekršaj” tijekom dijeljenja ili u 10 sekundi nakon njega: ako je druga ekipa prekršila pravila, tvoja ekipa nosi dijeljenje. Ako nisi u pravu, ne gubiš bodove, ali do kraja partije više nemaš prijave.',
        },
        ranks: { title: 'Rangovi', text: 'Svi kreću od 1200. Nakon 10 partija svrstavanja rang prati tvoj rejting.' },
    },
    sections: {
        'rules-cards': {
            title: 'Karte',
            body: (
                <>
                    <p>U beli su 32 karte: 7, 8, 9, 10, Dečko, Baba, Kralj i As, u četiri boje: Herc, Karo, Pik i Tref.</p>
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="t-callout text-left text-text-2">
                                <th className="py-1 pr-4">Redoslijed, od najjače</th>
                                <th className="py-1">Bodovi karata</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-t-2 border-edge">
                                <td className="py-2 pr-4">Adut: Dečko, 9, As, 10, Kralj, Baba, 8, 7</td>
                                <td className="py-2">Dečko 20, 9 14, As 11, 10 10, Kralj 4, Baba 3, 8 i 7 ništa</td>
                            </tr>
                            <tr className="border-t-2 border-edge">
                                <td className="py-2 pr-4">Ostale boje: As, 10, Kralj, Baba, Dečko, 9, 8, 7</td>
                                <td className="py-2">As 11, 10 10, Kralj 4, Baba 3, Dečko 2, 9, 8 i 7 ništa</td>
                            </tr>
                        </tbody>
                    </table>
                    <p>Zadnji štih u dijeljenju vrijedi još 10 bodova, pa su u kartama jednog dijeljenja ukupno 162 boda.</p>
                </>
            ),
        },
        'rules-bidding': {
            title: 'Dijeljenje i licitacija',
            body: (
                <ul className="list-disc pl-6 space-y-2">
                    <li>Prvi djelitelj određuje se nasumce; nakon svakog dijeljenja dijeli sljedeći igrač.</li>
                    <li>Svatko dobije šest karata. Počevši od igrača nakon djelitelja, svaki igrač ili zove adut ili kaže „Dalje”.</li>
                    <li>Prvi igrač koji zove boju čini je adutom, a njegova ekipa mora dobiti dijeljenje (vidi Bodovanje dijeljenja).</li>
                    <li>Ako ostala tri igrača kažu „Dalje”, djelitelj mora zvati adut (mus): djelitelj ne može reći „Dalje”.</li>
                    <li>Zatim svatko dobije još dvije karte, ukupno osam.</li>
                </ul>
            ),
        },
        'rules-playing': {
            title: 'Tijek igre',
            body: (
                <>
                    <p>
                        Prvi štih otvara igrač nakon djelitelja; tko odnese štih, otvara sljedeći. Štih nosi najjači adut u njemu, a ako u njemu nema aduta, najjača karta boje koja je prva bačena.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>
                            Ako imaš kartu boje koja je prva bačena, moraš odgovoriti na boju.
                            <ul className="list-[circle] pl-6 mt-2 space-y-2">
                                <li>Ako još nitko nije rezao adutom, moraš nadjačati najjaču kartu te boje na stolu ako možeš.</li>
                                <li>Kad je netko već rezao adutom, smiješ baciti bilo koju kartu boje koja je prva bačena.</li>
                                <li>Ako je prvi bačen adut, moraš baciti jači adut od najjačeg na stolu ako možeš.</li>
                            </ul>
                        </li>
                        <li>Ako nemaš karte boje koja je prva bačena, moraš rezati adutom: jačim od svakog aduta koji je već u štihu, ako možeš.</li>
                        <li>Ako nemaš ni jedno ni drugo, baci bilo koju kartu.</li>
                    </ul>
                </>
            ),
        },
        'rules-declarations': {
            title: 'Zvanja i bela',
            body: (
                <>
                    <p>
                        Igra sama pronađe zvanja kad se zove adut. Prije prve karte objavljuje ih redom, od igrača nakon djelitelja, i pričeka nekoliko sekundi.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>
                            Niz su tri ili više karata zaredom u istoj boji, redom 7, 8, 9, 10, Dečko, Baba, Kralj, As. Tri zaredom vrijede 20, četiri 50, a pet, šest ili sedam 100. Broji se svaki niz koji imaš, pa i dva u istoj boji.
                        </li>
                        <li>
                            Četiri iste: četiri Dečka vrijede 200, četiri Devetke 150, a četiri Asa, Desetke, Kralja ili Babe 100. Četiri Sedmice ili četiri Osmice ne vrijede ništa. Ista karta može se brojiti i u nizu i u četiri iste.
                        </li>
                        <li>
                            Belot: svih osam karata jedne boje. Partija odmah završava i ta ekipa pobjeđuje, a njezin se rezultat podiže na 1001.
                        </li>
                        <li>
                            Zvanja piše samo jedna ekipa: ona koja ima najjače zvanje. Ona piše sva zvanja oba svoja igrača; druga ekipa ne piše nijedno.
                        </li>
                        <li>
                            Jače je zvanje koje vrijedi više. Ako dva vrijede jednako, četiri iste tuku niz; zatim odlučuje najviša karta zvanja (7 je najniža, As najviša), a među četiri iste As tuče 10, 10 tuče Kralja, a Kralj Babu. Ako su zvanja i tada jednaka, pobjeđuje igrač koji je prvi na redu nakon djelitelja. Adut tu ništa ne mijenja.
                        </li>
                        <li>
                            Svaki igrač kaže vrijednost svojeg najjačeg zvanja. Kad su vrijednosti dviju ekipa jednake, ti igrači kažu i do koje karte im ide zvanje („do Babe”); suigrači ne moraju. Karte iz zvanja ekipe koja je dobila prikazuju se kraj njihovih mjesta dok se ne odnese prvi štih; karte druge ekipe ostaju skrivene.
                        </li>
                        <li>Ekipa koja u dijeljenju ne odnese nijedan štih gubi svoja zvanja i belu za to dijeljenje.</li>
                        <li>
                            Bela je par Kralja i Babe u adutu u istoj ruci i vrijedi 20. Ne broji se sama: kad bacaš prvu od tih dviju karata, odaberi „Baci + bela”.
                        </li>
                    </ul>
                </>
            ),
        },
        'rules-scoring': {
            title: 'Bodovanje dijeljenja',
            body: (
                <ul className="list-disc pl-6 space-y-2">
                    <li>Svaka ekipa zbraja bodove karata iz štihova koje je odnijela, svoja zvanja i svoju belu.</li>
                    <li>
                        Ekipa koja je zvala adut mora imati više bodova od druge ekipe. Ako ima jednako ili manje, pada (padanje): druga ekipa dobiva sve bodove dijeljenja.
                    </li>
                    <li>Ekipa koja odnese svih osam štihova (štiglja) dobiva još 90 bodova.</li>
                    <li>
                        Kad nakon dijeljenja neka ekipa ima 1001 bod ili više, pobjeđuje ekipa s više bodova, ali tek kad istekne 10 sekundi tog dijeljenja za prijave prekršaja. Ako su izjednačene, igra se još jedno dijeljenje.
                    </li>
                </ul>
            ),
        },
        'rules-challenge': {
            title: 'Nedopuštene karte i prijava prekršaja',
            body: (
                <>
                    <p>
                        Igra te ne sprječava da baciš kartu koju pravila ne dopuštaju; bilježi je kao prekršaj. Ako misliš da je protivnik u ovom dijeljenju bacio nedopuštenu kartu, pritisni „Prijavi prekršaj” tijekom dijeljenja ili u 10 sekundi nakon što završi. To vrijedi i za dijeljenje u kojem neka ekipa prijeđe 1001: partija završava tek kad istekne tih 10 sekundi.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>
                            Ako je druga ekipa u ovom dijeljenju prekršila pravila (čak i ako je i tvoja), prijava je točna: tvoja ekipa nosi cijelo dijeljenje, 162 boda i još zvanja i belu svoje ekipe, a druga ekipa za to dijeljenje ne piše ništa. Dijeljenje završava kao i inače, sa svojih 10 sekundi, a prijava ti ostaje.
                        </li>
                        <li>
                            Ako nitko nije prekršio pravila, ili samo tvoja ekipa, prijava nije točna: rezultat se ne mijenja, ali do kraja partije više nemaš prijave. To vide svi za stolom.
                        </li>
                        <li>Svaki igrač ima jednu prijavu po partiji. Točna prijava ostaje, a netočna se troši.</li>
                        <li>Prekršaj možeš prijaviti čim je bačena prva karta dijeljenja, sve dok ne istekne njegovih 10 sekundi.</li>
                        <li>Koje su karte bile nedopuštene, vidi se u Detaljima partije tek kad partija završi s pobjednikom.</li>
                    </ul>
                </>
            ),
        },
        'rules-modes': {
            title: 'Nerangirane i rangirane partije',
            body: (
                <ul className="list-disc pl-6 space-y-2">
                    <li>
                        Nerangirano: otvori stol ili sjedni za tuđi (za Stol za ekipu treba lozinka), odaberi ekipu, a domaćin pokreće partiju. Nerangirane partije nikad ne mijenjaju tvoj rejting.
                    </li>
                    <li>
                        Rangirano: pritisni „Igraj rangirano” na stranici Rangirano; treba ti potvrđena e-adresa. Stiglja spaja četvero igrača u potrazi s najbližim rejtingom; što dulje čekaju, to veću razliku u rejtingu prihvaća, najviše 1600 bodova između najvišeg i najnižeg. Rejting ti se mijenja s rezultatom ekipe: pobjeda ga podiže, a poraz spušta; pobjeda protiv ekipe s višim rejtingom donosi više, a poraz od nje manje košta. Mijenja se to više što je konačna razlika u rezultatu veća, a više i u tvojim prvim rangiranim partijama. Nakon vrlo tijesne pobjede prikazani broj može ostati isti.
                    </li>
                </ul>
            ),
        },
        'rules-ranks': {
            title: 'Rangovi',
            body: (
                <>
                    <table className="w-full text-sm border-collapse">
                        <caption className="sr-only">Rangovi</caption>
                        <thead>
                            <tr className="t-callout text-left text-text-2">
                                <th className="py-1 pr-4">Rang</th>
                                <th className="py-1 pr-4">Od</th>
                                <th className="py-1">Uzrečica</th>
                            </tr>
                        </thead>
                        <tbody>
                            {RULE_RANKS.map((rank) => (
                                <tr key={rank.key} className="border-t-2 border-edge">
                                    <td className="py-2 pr-4">{rank.name}</td>
                                    <td className="py-2 pr-4">{RANK_FROM[rank.key]}</td>
                                    <td className="py-2">{rank.tagline}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p>Svi kreću od 1200. Prvih 10 rangiranih partija služi za svrstavanje: dok ih ne odigraš, ti si Cucek.</p>
                </>
            ),
        },
        'rules-away': {
            title: 'Kad igrača nema',
            body: (
                <>
                    <p>
                        Svaki potez traje 30 sekundi. Ako igrač ne odigra na vrijeme, poslužitelj igra umjesto njega: u licitaciji kaže „Dalje” (ili zove nasumičan adut za djelitelja koji mora zvati), a u igri baca dopuštenu kartu.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Svaka tvoja licitacija, bačena karta ili prijava prekršaja vraća broj tvojih propuštenih poteza na nulu.</li>
                        <li>
                            Nakon 5 propuštenih poteza zaredom istog igrača partija završava. Nerangirana partija se prekida, bez rezultata. U rangiranoj partiji ekipa odsutnog igrača gubi: rejting odsutnog igrača pada kao za poraz 1001–0, rejting njegova suigrača za pola običnog poraza, a pobjednici dobivaju kao za običnu pobjedu.
                        </li>
                        <li>Ako i oba igrača druge ekipe propuštaju poteze, partija se prekida bez rezultata.</li>
                        <li>Ako napustiš stol, traka „Vrati se u igru” vraća te na tvoje mjesto.</li>
                    </ul>
                </>
            ),
        },
        'rules-decline': {
            title: 'Odbijanje rangirane partije',
            body: (
                <p>
                    Kad se pronađe rangirana partija, u prozoru „Našli smo ti partiju!” možeš pritisnuti „Odbij”, dok još nitko nije licitirao i dok nije prošlo više od 30 sekundi. Partija se otkazuje bez promjene rejtinga, ostala tri igrača vraćaju se u potragu na svoja mjesta, a ti se 2 minute ne možeš ponovno uključiti u potragu.
                </p>
            ),
        },
        'rules-again': {
            title: 'Ajmo još jednu!',
            body: (
                <p>
                    Nakon partije koja završi s pobjednikom, „Ajmo još jednu!” pita sva četiri igrača žele li igrati opet. Ako sva četiri pristanu u roku od 2 minute, počinje nova partija s istim ekipama. Nova je partija uvijek nerangirana, i nakon rangirane. Ako netko ode, nove partije nema.
                </p>
            ),
        },
    },
};
