# MAKROMENY — STYRINGSDOKUMENT

**Sist oppdatert:** 23. juli 2026
**Eier:** Nicklas Myhren
**Live:** makromeny.netlify.app · **Kode:** github.com/Nicklasmyhren/makromeny

---

## 📍 NESTE ØKT — START HER

**Status:** Supabase-migreringen er fullført og verifisert. «Har hjemme» er ferdig bygget og testet.

**Slik starter du en ny økt:**
1. Last opp dette dokumentet + `index.html` fra GitHub
2. Si hva du vil jobbe med

**Mest nærliggende neste steg (velg selv):**
- Masseprodusere retter inn i Supabase (databasen står klar)
- AI-generere faste fremgangsmåter til alle retter
- E-postbekreftelse ved registrering
- Rydde bort Claude-branding og prototype-forbehold

**Husk:** arbeidsmappa nullstilles mellom økter — `index.html` må lastes opp på nytt hver gang koden skal endres.

---

## IDÉEN

Norsk app som tar dine mål (makroer, livsstil, trening) og setter sammen en uke med middager + ferdig handleliste med totalpris, bygget på ekte norske dagligvarer.

**Bærende prinsipp:** *Claude bestemmer målene og strukturen, koden bestemmer handlekurven.* Claude tolker fritekst og setter ernæringsmål; den deterministiske motoren plukker ekte retter fra databasen. Claude kan aldri finne på en rett eller en pris som ikke finnes i dataene.

**Differensiering:** markedet har trackere og planleggere (Lifesum, MyFitnessPal, Kaloridagbok, Nomit). Nisjen er kombinasjonen makromål + AI-livsstilstolkning + ekte kjøpbar handlekurv med pris — pluss «Har hjemme», som ingen norsk konkurrent har.

---

## ARKITEKTUR

| Lag | Teknologi |
|---|---|
| Frontend | Én HTML-fil (`index.html`), hostet på Netlify |
| Database + innlogging | Supabase (PostgreSQL + Auth) |
| Sikker API-proxy | Netlify Functions |
| AI | Claude (`claude-sonnet-4-6`) via Netlify Function |
| Prisdata | Kassal API (`unique=1`, ikke `unique=true`) |
| Versjonskontroll | GitHub → auto-deploy til Netlify |

**Netlify Functions:** `interpret.mjs` (fritekst → JSON-mål), `kassal.mjs` (priser), `recipe.mjs` (oppskrifter).
**Miljøvariabler i Netlify:** `ANTHROPIC_API_KEY`, `KASSAL_API_KEY`.
**Supabase:** `izgcnwyflmctaxfxwzga.supabase.co` (Free plan, West Europe/London).

---

## DATAMODELL (Supabase)

| Tabell | Innhold | Rader |
|---|---|---|
| `ingredienser` | Råvarer: navn, kategori, næring, pakkestørrelse, pris, allergener, allergen-rolle, `kassal_id` (tom) | 31 |
| `retter` | Retter: navn, tag, veg/vegan, nivå, kjøkken, tid, beskrivelse, `fremgangsmate` (tom) | 48 |
| `rett_ingredienser` | Kobling rett ↔ råvare med gram | 317 |
| `har_hjemme` | Brukerens varebeholdning (RLS: hver bruker ser kun sitt eget) | dynamisk |

**Sikkerhet:** `ingredienser`, `retter`, `rett_ingredienser` har offentlig lesetilgang. `har_hjemme` er privat per bruker.

**Migreringsfiler:** `supabase/01_tabeller.sql`, `02_data.sql`, `03_enheter.sql`. Generert programmatisk via `gen_data.js` (for å unngå at skallet ødelegger anførselstegn).

---

## FERDIGE FUNKSJONER

**Kjerne**
- Fritekstfelt → Claude tolker livsstil, trening og mål → kalori- og makromål + coach-melding
- Deterministisk motor plukker retter, respekterer diett, allergier, filtre og låste retter
- Ukesmeny med makroer per rett, «Bytt rett», «Vis oppskrift»
- Handleliste som kvittering med totalpris og pris per porsjon
- Innlogging (Supabase Auth), profil med fast «om meg»-tekst, menyhistorikk som hindrer gjentakelser

**Allergier** — rollebasert modell per råvare:
- `tilpassbar` (pasta, tortilla, melk, rømme, revet ost, smør) → retten **beholdes**, OBS-boks om fri-for-variant
- `kritisk` (egg, laksefilet, torskefilet, tofu, edamame) → retten **filtreres bort**
- `detectAllergies(text)` som deterministisk sikkerhetsnett etter Claude-tolkningen
- `ALLERGEN_ROLLE_UNNTAK{}` klar for per-rett-overstyring (tom)

**Filterpanel** (⚙ Filter, folder ut/inn)
- Vertikal glidebryter: vanskelighet (Enkel → Middels → Vanskelig → Ekspert), starter på topp = alt
- Vertikal glidebryter: maks tid (15/30/45/60/90 min), starter på «Ingen grense»
- Søkbar kjøkken-multivalg med 17 land + flagg. **Tomt = alle** (bevisst valg: ingen «Velg alle»-knapp)
- Badge viser antall aktive filtre. Urørte filtre påvirker ingenting.

**Har hjemme** (ferdig 23.07.26)
- Varebeholdning i profilen: søk opp råvare, angi mengde, rediger/slett — lagres i Supabase
- **Automatisk enhet fra pakketekst:** `12 stk` → stk · `1 pose` → pose · `400 ml`/`1 l`/`4 dl` → ml · `500 g`/`1 kg` → gram. Lagres alltid som gram internt.
- Avkrysning «Bruk mest mulig av det jeg har hjemme» (vises kun når beholdningen ikke er tom)
- Motoren gir bonus til retter som utnytter beholdningen (`spenn * 1.5` — én tallverdi å justere)
- Handlelista trekker fra: helt dekkede varer flyttes til «Har du hjemme — ikke handle», sparesum vises
- «Bruk denne menyen» gjør **begge** ting: lagrer i historikk **og** trekker fra beholdningen

---

## LÅSTE BESLUTNINGER

**Rett-mal — en «ferdig» rett har:**
navn · ingredienser med mengder · tag · kostholdsflagg · allergen-roller · vanskelighetsgrad (4 nivåer) · kjøkken/land · tilberedningstid · kort beskrivelse · **fast fremgangsmåte** · *ingen bilde*

**Fremgangsmåte skal være mengde-NØYTRAL** — ingen absolutte tall («400 g»), bruk relative formuleringer («halvparten», «til gyllen», «til det bobler») og vis til ingredienslista for eksakte mengder. *(Nicklas' innsikt — gjør at oppskriften stemmer uansett antall porsjoner.)*

**Ingen bilder** — for tidkrevende; brukere kan google.

**Kjøkken-fordeling i dag:** Norsk 15 · Italiensk 9 · Meksikansk 7 · Indisk 7 · Kinesisk 6 · Gresk 2 · Thailandsk 1 · Japansk 1. Samlekategorien «Asiatisk» er avviklet til fordel for konkrete land.

**Ærlighet over pynt:** handlelista later ikke som om delvis dekning gir besparelse. Har du 300 g pasta og trenger 360 g, må du fortsatt kjøpe én pakke — og appen sier det.

---

## VEIKART

**Nær sikt**
- [ ] Masseprodusere retter inn i Supabase (alle land, tyngde på norsk)
- [ ] AI-generere faste fremgangsmåter (mengde-nøytrale) for alle retter
- [ ] E-postbekreftelse ved registrering (liten Supabase-innstilling + polish i appen)
- [ ] Rikere profil: ferdighetsnivå, kjøkkenønsker

**Før lansering**
- [ ] Fjerne Claude-branding og utviklernotater · omformulere (ikke slette) hint-tekster · fjerne prototype-forbehold når Kassal-data er live
  - *Sjekk Anthropics krav til attribusjon før all branding fjernes*
- [ ] Personvernerklæring
- [ ] Forsiktig helseformulering
- [ ] Rydde bort tre `makromeny-github*`-mapper i repoet (harmløse)

**Senere**
- [ ] Fjerne innebygde reservedata — **men vent til masseproduksjon starter.** Reserven gir ekte robusthet når Supabase pauser; den blir først villedende når databasen har retter reserven ikke kjenner.
- [ ] Live Kassal-priser i stedet for eksempeldata
- [ ] Monetisering: freemium → betaling (Stripe/Vipps), webhooks, mislykkede trekk, MVA på digitale abonnement
- [ ] Utvide utover middag (frokost/lunsj)

---

## TEKNISKE NOTATER

**Oppstartsflyt:** appen viser «Henter retter og råvarer…», henter tre tabeller fra Supabase, konverterer til intern form (`mmApplyData`) og starter (`mmStartApp`). Kommer ikke data innen **8 sekunder**, brukes innebygde reservedata. Konsollen sier hvilken kilde som ble brukt — *«Data fra Supabase: 31 råvarer, 48 retter, 317 koblinger.»*

**Supabase pauser gratis-prosjekter** etter ~1 ukes inaktivitet → `ERR_NAME_NOT_RESOLVED`, innlogging feiler. Fiks: Supabase-dashboard → **Resume project** (*ikke* «Upgrade to Pro»). Skjedde 15.07 og 23.07.

**Netlify** bruker kredittmodell (300/mnd) og pauser når de er brukt opp.

**GitHub-opplasting — tilbakevendende felle:**
- Last opp **filinnholdet**, ikke mappa (ellers lages undermapper)
- Windows skjuler `.html`-endelsen → gir `index.html.html` eller `index (1).html`. **Slett gammel fil i Nedlastinger *før* nedlasting**, så er navnet ledig.

**Nye råvarer:** `pakke_gram` må alltid være ekte vekt i gram, uansett hva `pakke_tekst` sier. Appen kjenner `stk`, `pose`, `ml`, `dl`, `l`, `g`, `kg` — andre ord (boks, beger, glass) faller tilbake til gram.

**Kontroll etter innlegging av nye varer:**
```sql
select navn, pakke_tekst, pakke_gram from ingredienser order by navn;
```

---

## FREMDRIFTSLOGG

**23.07.2026 — Supabase-migrering + «Har hjemme»**
- Supabase-prosjekt gjenopprettet etter automatisk pause
- Etappe 1–3: datamodell godkjent, fire tabeller opprettet, 31 råvarer + 48 retter + 317 koblinger lagt inn
- Etappe 4: appen henter nå data fra Supabase; konvertering verifisert **identisk** mot innebygde data. Reserve beholdt med 8 sekunders tidsavbrudd
- «Har hjemme» bygget i tre steg: beholdning i profilen → prioritering i motoren + fratrekk i handlelista → oppdatering av beholdning
- Automatisk enhetsgjenkjenning lagt til. **Nicklas fanget at kokosmelk sto i gram** → avdekket at olivenolje og melk hadde samme feil
- Prioriteringsvekt økt fra `spenn*0.9` til `spenn*1.5` etter måling som viste at egg-retter havnet under median
- To knapper slått sammen til én etter Nicklas' innspill — «Bruk denne menyen» gjør nå begge ting

**14.–15.07.2026 — Filtre, allergier, rett-metadata**
- Rollebasert allergimodell (tilpassbar vs. kritisk)
- «Tacofredag med kjøttdeig» → «Taco». Målknapper fjernet (settes nå via fritekst)
- Rett-metadata på alle 48 retter (nivå, kjøkken, tid, beskrivelse)
- Filterpanel med vertikale glidebrytere og søkbart kjøkkenvalg
- Styringsdokument opprettet

---

## ARBEIDSMÅTE

- **Ett konkret steg om gangen**, med visuell bekreftelse mellom hvert
- Nicklas tester i nettleseren og fanger ekte feil — flere bugs og forbedringer i dette dokumentet kom fra hans observasjoner
- Kode syntaks-sjekkes og data verifiseres før levering
- Endringer er additive og rullbare; GitHub er sikkerhetsnettet
- Alt på norsk bokmål
