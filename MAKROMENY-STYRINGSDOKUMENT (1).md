# MakroMeny — Styringsdokument

> **Hva er dette?** Dette er det levende «kildedokumentet» for MakroMeny — visjon, status, datamodell, veikart og fremdriftslogg samlet på ett sted. Dokumentet bor i prosjektet, slik at det overlever mellom arbeidsøkter. Claude leser det ved starten av hver økt for å vite nøyaktig hvor vi står, og oppdaterer fremdriftsloggen etter hvert som vi bygger.
>
> **Sist oppdatert:** 4. juli 2026
> **Språk:** Norsk bokmål (som resten av produktet)

---

## 1. Visjon

MakroMeny er en **AI-drevet middagsplanlegger for det norske markedet**. Brukeren beskriver hverdagen sin i fritekst — mål, trening, livsstil, kosthold — og appen setter sammen en uke med middager som treffer ernæringsmålene, sammen med en ferdig handleliste med totalpris bygget på **ekte norske dagligvarer**.

**Kjerneprinsipp (arkitektur):** *Claude bestemmer målene og strukturen, koden bestemmer handlekurven.* Claude tolker fritekst til ernæringsmål og strukturelle ønsker. En deterministisk motor, forankret i ekte data, plukker retter og priser. Slik tolker Claude nyanser fritt, men kan aldri finne på en rett eller en pris som ikke finnes i dataene. Alt er ekte og kjøpbart — ingenting hallusineres.

**Bevisst avgrensning:** MakroMeny er en **middagsplanlegger** — ikke frokost/lunsj. «Hva skal vi ha til middag?» er det daglige stresspunktet i en travel familie; frokost og lunsj løser folk selv. Ved å gjøre én ting skikkelig bra blir budskapet skarpt: *«Aldri lur på hva dere skal ha til middag igjen.»*

**Differensiering:** Kombinasjonen av (1) AI-tolkning av livsstil, (2) makro-optimering, og (3) ekte, kjøpbar handlekurv med norsk pris. Markedet har trackere og planleggere fra før (Lifesum, MyFitnessPal, Kaloridagbok, Nomit), men ingen kombinerer disse tre.

**Mulig sluttbruk:** Eget produkt (abonnement, freemium) på kort sikt; lisensiering til en dagligvarekjede på lengre sikt (behandlet som en sekvens, ikke et enten/eller).

---

## 2. Statusoversikt

### Ferdig og live ✅
- **Kjernemotor:** slot-basert menygenerator med makromål, variasjon på tvers av rett-typer, og kvitteringsaktig handleliste med totalpris og pris per porsjon.
- **AI-tolkning:** ekte Claude-integrasjon via sikker Netlify Function (`interpret.mjs`). Tolker fritekst → mål, makroer, preferanse, kostholdsflagg, allergier og strukturelle ønsker (f.eks. «taco på fredag», «to fiskemåltider»).
- **Ekte data:** 31 råvarer med ekte næringsinnhold og priser fra Kassalapp; 48 retter (21 veganske, flere proteinrike med tofu/edamame).
- **Innlogging:** Supabase-auth (e-post/passord), med profil som huskes.
- **Profil-hukommelse:** fast «om deg og familien»-tekst som tas med i hver planlegging, til den endres.
- **Menyhistorikk:** «Bruk denne menyen» lagrer uka; motoren unngår gjentakelser fra de siste ukene (mykt, med graceful fallback).
- **Veganfilter:** ekte filter (ingen animalske produkter), 21 veganretter, «VEGANSK»-merking.
- **Allergifilter (skikkelig modell):** per-råvare allergen-merking med rolle *tilpassbar* vs *bærende*. Gluten/melk = tilpassbar (behold rett + OBS-varsel om å kjøpe fri-for-variant). Fisk/egg/soya = bærende (filtrer bort, finn annen rett). Deterministisk sikkerhetsnett som fanger allergier i teksten uansett hva Claude svarer.
- **Infrastruktur:** kode i GitHub, Netlify auto-deployer ved commit (ingen zip-filer, ingen kvote-tak i praktisk bruk).

### På vei / neste fase 🚧
- **Rydde datamodellen:** flytte råvarer og retter fra kode (`index.html`) til Supabase, slik at retter kan legges til/redigeres uten kodeendringer.
- **Spikre «rett-malen»:** definere alle feltene en ferdig rett skal ha (se seksjon 3) *før* vi masseproduserer retter.
- **Rikere profilside** (se seksjon 4).
- **E-postbekreftelse** ved registrering.
- **Klart for verden:** personvernerklæring + forsiktige helse-formuleringer.
- **Opprydding:** fjerne feilplasserte `makromeny-github`-mapper i GitHub-repoet.

### Bevisst utsatt ⏳
- **Massiv utvidelse av rettbiblioteket** (mange nye retter) — gjøres *etter* at rett-malen og datamodellen er ferdig, så vi slipper å endre hundrevis av retter i ettertid.
- Nye allergener i praksis (nøtter, skalldyr osv.) — «klare i systemet», men aktiveres først når vi legger til retter som faktisk inneholder dem.

---

## 3. Rett-malen (må spikres før masseproduksjon)

En «ferdig» rett i MakroMeny bør ha følgende felter. Dette er utgangspunkt for diskusjon — vi spikrer den sammen.

**Har i dag:**
- `id` — unik nøkkel
- `navn` — visningsnavn (f.eks. «Taco»)
- `tag` — rett-type for variasjon: kylling / storfe / svin / fisk / vegetar
- `veg` / `vegan` — kostholdsflagg (vegan beregnes fra ingrediensene)
- `ing` — liste av `[råvareId, gram]` (mengder for 4 porsjoner)
- allergen-roller — utledet per ingrediens (tilpassbar/bærende)

**Foreslåtte nye felter (fra visjonen):**
- `vanskelighetsgrad` — enkel / middels / avansert (kobles til brukerens ferdighetsnivå i profilen)
- `kjøkken` / `stil` — f.eks. norsk, indisk, thai, meksikansk (for «jeg vil ha indisk i dag»)
- `tilberedningstid` — minutter
- `beskrivelse` — kort, lokkende tekst om retten
- `bilde` — foto av retten
- `fremgangsmåte` — fast lagret oppskrift (vurdere: fast vs AI-generert per gang)

> **Åpent valg:** Oppskrift/fremgangsmåte er i dag AI-generert ved behov (forankret i handlelista). Skal den bli et fast felt per rett, eller fortsette å genereres? Fast gir konsistens og hastighet; generering gir fleksibilitet.

---

## 4. Profil & funksjoner (visjon)

Målet er en **gjennomført profilside** — mer enn dagens «beskriv hverdagen din». Brukerens ønsker, samlet:

- **Fast «om meg/familien»-tekst** *(finnes i dag)* — tas med i hver planlegging.
- **Ferdighetsnivå** — hvor avanserte retter man er komfortabel med å lage. Filtrerer/vekter retter mot `vanskelighetsgrad`.
- **«Har hjemme»-funksjon** — legg inn varer (og mengde) man allerede har. Systemet prioriterer retter som bruker disse. Mål: mindre matsvinn, spart penger, mindre handling. *(Sterk, konkret verdi.)*
- **Kjøkken/stil-ønsker** — «jeg vil ha indisk i dag», thai osv. (kobles til rettens `kjøkken`-felt).
- **Kostholds- og allergiprofil** — vegansk/vegetar + allergier lagret fast (delvis dekket i dag via fritekst).

**Innlogging / registrering:**
- **I dag:** e-post + passord (Supabase), fungerer.
- **Ønsket:** valg mellom (a) registrere ny bruker med **bekreftelses-e-post** vi sender, og (b) vanlig innlogging med e-post/passord som nå.

> Merk: «Har hjemme» og «ferdighetsnivå» avhenger av rett-malen (ingrediensmatching og `vanskelighetsgrad`). Derfor spikres rett-malen og datamodellen *før* disse bygges.

---

## 5. Datamodell (mål: Supabase)

I dag bor råvarer og retter som JavaScript i `index.html`. For et ordentlig produkt bør de flyttes til Supabase, slik at data kan redigeres uten kodeendring, og slik at allergen-/egenskapsmerking blir et **fast felt** man ikke kan glemme.

**Tabeller allerede på plass:**
- `profiles` — brukerprofil (mål, preferanse, antall middager/personer, fritekst, «om meg»). Row Level Security: hver bruker ser kun sitt eget.
- `menus` — lagret menyhistorikk (recipe_ids + tidspunkt). RLS på plass.
- Supabase-auth — brukere (e-post/passord).

**Foreslåtte tabeller (neste fase):**
- `ingredienser` — råvare med næringsinnhold, pris, pakkestørrelse, **allergener + rolle**, kilde (Kassal-ID).
- `retter` — rett med alle felt fra rett-malen (seksjon 3).
- `rett_ingredienser` — kobling rett↔råvare med mengde og evt. allergen-rolle-unntak per rett.
- `pantry` / `har_hjemme` — brukerens varer og mengder (for matsvinn-funksjonen).

**Viktig prinsipp:** allergen-info må være et obligatorisk felt på hver råvare, så det er umulig å legge til en ny vare uten å ta stilling til allergener. Filteret er bare så godt som merkingen.

---

## 6. Veikart (rekkefølge)

Rekkefølgen er bevisst: **ferdigstill formen før du masseproduserer.**

1. **Styringsdokument** *(dette dokumentet — ferdig)* ✅
2. **Spikre rett-malen** — bli enige om alle felt en ferdig rett skal ha.
3. **Flytt datamodellen til Supabase** — råvarer og retter ut av koden, inn i database.
4. **Bygg rikere profilside** — ferdighetsnivå, «har hjemme», stil-ønsker, e-postbekreftelse.
5. **Klart for verden** — personvern, helse-formuleringer, rydde GitHub-rot.
6. **Masseprodusér retter** — fyll inn mange retter i den ferdige strukturen, korrekt fra start.
7. **Test med ekte brukere** — få det i hendene på folk, lær, iterer.
8. **Monetisering** — freemium først, deretter betalt nivå (Stripe/Vipps), VAT på norske digitale abonnementer.

---

## 7. Fremdriftslogg

*Nyeste øverst. Claude fyller på her etter hvert som vi bygger.*

### 📍 NESTE ØKT — start her (fra ~15. juli 2026)
**Vi starter på veikart-steg 2 og 3: fundamentet.** Nicklas har bestemt seg for å gjøre datamodellen stabil *før* nye funksjoner og masseproduksjon av retter. Konkret neste steg:

1. **Spikre rett-malen** (seksjon 3). Status da vi stoppet: Nicklas vil «gjøre fundamentet stabilt» først. Vi hadde lagt fram feltforslag, men ikke låst dem. Beslutninger som gjenstår:
   - Nye felt fra visjonen: **vanskelighetsgrad**, **kjøkken/stil**, **tilberedningstid** — Nicklas heller mot å ta disse med (de låser opp profil-funksjoner), men ikke endelig bekreftet.
   - Større valg utsatt av Nicklas: **bilde** per rett, **kort beskrivelse**, **fast vs AI-generert oppskrift**. Ta stilling til disse når vi spikrer malen.
2. **Flytt datamodellen til Supabase** (seksjon 5) — råvarer og retter ut av `index.html`, inn i `ingredienser`/`retter`/`rett_ingredienser`-tabeller med allergen-info som obligatorisk felt.

Rikere profilside, e-postbekreftelse, «klart for verden» og masseproduksjon av retter kommer *etter* at fundamentet står.

### 4. juli 2026
- **Pause:** Nicklas på ferie til ~15. juli. Fortsetter med fundamentet (steg 2–3) etterpå.
- Opprettet dette styringsdokumentet med full visjon, status, rett-mal, datamodell, veikart og logg. (Word-versjon droppet inntil videre; `.md` bor i prosjektet.)
- **Allergifilter — skikkelig modell:** innførte rolle per allergen-bærende råvare (*tilpassbar* vs *bærende*). Gluten/melk beholder retten og viser OBS-boks («kjøp fri-for-variant, pris kan avvike»); fisk/egg/soya filtreres bort. La til deterministisk sikkerhetsnett (`detectAllergies`) som fanger allergier i teksten uansett Claude-svar — etter at et første forsøk viste at Claude beskrev allergien i coach-meldingen i stedet for å sette `avoid`-feltet.
- Døpte om «Tacofredag med kjøttdeig» → «Taco».
- Feilsøkte GitHub-opplasting: filer havnet i undermapper (`makromeny-github/`) i stedet for toppnivå; løst ved å laste opp *innholdet* i mappa. `index.html` og `netlify/functions` nå korrekt på toppnivå.

### Rundt 1.–3. juli 2026 (infrastruktur)
- Netlify traff kreditt-tak (ny kreditt-modell, 300/mnd). Koblet prosjektet til **GitHub** for automatisk deploy og romsligere gratisnivå. Ny live-adresse: `makromeny.netlify.app`. Miljøvariabler (`ANTHROPIC_API_KEY`, `KASSAL_API_KEY`) lagt inn på nytt i det GitHub-koblede prosjektet.

### Tidligere (kronologisk oppsummert)
- **Grunnmotor:** slot-basert menygenerator, makromål, kvitterings-handleliste.
- **Claude-integrasjon:** `interpret.mjs` (fritekst → mål/makroer/preferanse/flagg/constraints), med sikker server-side nøkkel.
- **Strukturelle constraints:** pinning (rett på bestemt dag) + tagMin (minst N av en type), håndhevet av motoren.
- **Oppskriftsgenerering:** `recipe.mjs` + «Vis oppskrift», forankret i handlelista.
- **Kassal-integrasjon:** `kassal.mjs`. Kritisk oppdagelse: API-et krever `unique=1`, ikke `unique=true` (ellers 422).
- **Ekte råvaredata:** bygde `kassal-mapping.html` (v2 med nedtrekksvalg) for å mappe hver råvare til ekte Kassal-produkt. Auto-plukk var upålitelig (marsipanegg for «egg», potetgull for «olivenolje»), så manuell utvelgelse fra kandidater ble løsningen. Ryddet 0-kalori-treff og feilprodukter; beholdt ekte data der rent, standardverdier ellers.
- **Rettbibliotek:** utvidet 14 → 48 retter. Doblet veganbiblioteket (8 → 16 → 21), la til proteinrike veganretter med **tofu og edamame** (mappet mot ekte Kassal-pris).
- **Supabase:** koblet til, bygde innlogging inn i appen (header-knapp, modal, sesjon som huskes, logg ut). La til `profiles`-tabell + RLS og profil-hukommelse («om meg»-tekst). La til `menus`-tabell + RLS og «Bruk denne menyen» med gjentakelses-unngåelse.
- **Opprydding:** fjernet «dummy/prototype»-tekst siden dataene nå er ekte; rundet av priser til hele kroner i handlelista.

---

## 8. Tekniske notater (for Claude / utvikling)

- **Filer:** `index.html` (hele appen — data, logikk, stil samlet; ~65 kB), `netlify/functions/interpret.mjs` (Claude-tolkning), `kassal.mjs` (priser), `recipe.mjs` (oppskrifter). Testsider: `kassal-test.html`, `kassal-mapping.html`, `supabase-test.html`.
- **Deploy:** commit til GitHub `main` → Netlify auto-deployer. Ved opplasting via GitHub-web: dra inn *innholdet* i mappa (ikke selve mappa), så filene havner på toppnivå.
- **API-nøkler:** ligger som miljøvariabler i Netlify. Anthropic-nøkkel starter med `sk-ant-api03-`. Supabase publiserbar nøkkel er trygg i klienten (sikkerhet via RLS).
- **Allergen-rolle:** definert i `ALLERGEN_ROLLE` (per råvare) med `ALLERGEN_ROLLE_UNNTAK` (per rett) for framtidige unntak. `recipeAllergyInfo(rett, avoid)` returnerer `{safe, warn}`.
- **Verifisering:** Claude syntaks-sjekker JS og validerer data før hver pakking. Nicklas tester alltid visuelt (skjermbilder) — en vane som har fanget flere ekte feil.
