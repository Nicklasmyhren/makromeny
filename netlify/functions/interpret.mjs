// netlify/functions/interpret.mjs
//
// Tar imot { text } fra frontend, kaller Claude trygt på serversiden med en
// hemmelig API-nøkkel, og returnerer den rå JSON-teksten tilbake.
// Frontend (index.html) validerer og klamrer verdiene i normalize().
//
// API-nøkkelen leses fra miljøvariabelen ANTHROPIC_API_KEY, som du setter i
// Netlify (Site configuration -> Environment variables). Den sendes ALDRI til
// nettleseren — derfor er dette laget som en serverless-funksjon.

export default async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Bruk POST" }, 405);
  }

  // Les inn beskrivelsen fra forespørselen
  let text = "";
  try {
    const body = await request.json();
    text = body && typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return json({ error: "Ugyldig forespørsel" }, 400);
  }
  if (!text) return json({ error: "Tom beskrivelse" }, 400);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: "Mangler ANTHROPIC_API_KEY på serveren" }, 500);
  }

  const prompt =
`Du er en norsk ernæringsplanlegger. Brukeren beskriver hverdagen, treningen og målene sine i fritekst. Returner KUN gyldig JSON uten markdown, uten kodeblokk, uten tekst rundt.

Tilgjengelige retter (recipeId — navn — type):
kylling_ris — Kylling og ris med brokkoli — kylling
bolognese — Kjøttdeig og pasta (bolognese) — storfe
taco — Tacofredag med kjøttdeig — storfe
laks — Ovnsbakt laks med poteter — fisk
torsk — Torsk med poteter og gulrot — fisk
wok — Kyllingwok med grønnsaker — kylling
svin — Svinekoteletter med potet — svin
kyllinglar — Kyllinglår med ovnsbakte poteter — kylling
grateng — Fiskegrateng med makaroni — fisk
linsegryte — Linsegryte med kokos — vegetar · vegansk
kikertgryte — Kikertgryte med ris — vegetar · vegansk
kyllingsalat — Kyllingsalat med cherrytomat — kylling
omelett — Omelett med ost og grønnsaker — vegetar
pasta_squash — Pasta med tomat og squash — vegetar
kyllinggryte — Kyllinggryte med paprika og ris — kylling
kremet_kyllingpasta — Kremet kyllingpasta med brokkoli — kylling
kjottdeig_ris — Kjøttdeiggryte med ris — storfe
pastaform — Pastaform med kjøttdeig og ost — storfe
tacobowl — Tacobowl med kjøttdeig og ris — storfe
laks_pasta — Laks med pasta og squash — fisk
torsk_ris — Torsk med ris og grønnsaker — fisk
kylling_poteter — Kyllingfilet med ovnspoteter — kylling
svin_ris — Svinekotelett med ris og paprika — svin
stektris_egg — Stekt ris med egg og grønnsaker — vegetar
vegtaco_linser — Vegetartaco med linser — vegetar
pasta_kikerter — Pasta med kikerter og tomat — vegetar
frittata — Potetfrittata med ost — vegetar
kyllingfajita — Kyllingfajitas — kylling
fiskesuppe — Kremet fiskesuppe — fisk
veg_pasta_tomat — Vegansk pasta med tomat og squash — vegetar · vegansk
veg_pasta_linser — Vegansk tomatpasta med linser — vegetar · vegansk
veg_stektris — Vegansk stekt ris med grønnsaker — vegetar · vegansk
veg_kikertcurry — Kikert- og potetcurry — vegetar · vegansk
veg_linsetaco — Vegansk linsetaco — vegetar · vegansk
veg_kikertwok — Kikertwok med squash og ris — vegetar · vegansk
veg_linsesuppe — Krydret linse- og kokossuppe — vegetar · vegansk
veg_kikertsalat — Kikertsalat med cherrytomat — vegetar · vegansk
veg_potetcurry — Potet- og grønnsakscurry — vegetar · vegansk
veg_tomatris — Tomatris med grønnsaker — vegetar · vegansk
veg_kikertwrap — Kikertwraps med salat — vegetar · vegansk
veg_squashpasta — Pasta med squash og hvitløk — vegetar · vegansk
veg_gronnsakwok — Grønnsakswok med ris — vegetar · vegansk
veg_baktepoteter — Bakte poteter med kikerter og salsa — vegetar · vegansk
tofu_wok — Tofuwok med grønnsaker og ris — vegetar · vegansk
tofu_curry — Tofukarri med kokos — vegetar · vegansk
edamame_ris — Edamame- og grønnsaksris — vegetar · vegansk
tofu_taco — Tofutaco med salsa — vegetar · vegansk
protein_gryte — Proteingryte med linser og edamame — vegetar · vegansk

Gyldige typer: kylling, storfe, svin, fisk, vegetar. Gyldige dager: mandag, tirsdag, onsdag, torsdag, fredag, lørdag, søndag.

Schema:
{"goal":"muskler"|"ned"|"holde","kcal":<daglig kaloribehov, tall>,"protein":<daglig gram, tall>,"carbs":<daglig gram, tall>,"fat":<daglig gram, tall>,"preference":"protein"|"karbo"|"billig"|"balansert","vegOnly":<boolean>,"veganOnly":<boolean>,"avoid":[<allergener som må unngås: "gluten","melk","egg","fisk","soya","nøtter","skalldyr","sesam","selleri">],"constraints":{"pinned":[{"day":"<ukedag>","recipeId":"<id fra listen>"}],"tagMin":[{"tag":"<type>","count":<tall>}]},"note":"<kort vennlig melding på norsk, maks 2 setninger>"}

Regler for constraints (DETTE er det som faktisk styrer menyen — ikke bare nevn ønskene i note, legg dem inn her):
- Vil brukeren ha en bestemt rett på en bestemt dag (f.eks. "taco på fredag") -> pinned med riktig recipeId og day.
- Vil brukeren ha et visst antall av en type (f.eks. "to fiskemåltider i uka") -> tagMin med {tag, count}.
- Vage dag-ønsker som "typisk helgemat lørdag og søndag" -> pin en passende konkret rett til de dagene (f.eks. taco, laks eller svin).
- Bruk KUN recipeId-er og typer fra listen over. Tomme lister [] hvis brukeren ikke har slike ønsker.
- Er brukeren vegansk (veganOnly), pin KUN retter merket "vegansk" i lista.

Sett ellers realistiske dagsverdier for en voksen, og vektlegg det brukeren sier (utholdenhet -> mer karbo; styrke/muskler -> mer protein; vektnedgang -> lavere kcal og goal ned; student/lite penger -> preference billig; vegetar (uten kjøtt og fisk, men ost og egg er ok) -> vegOnly true; vegansk eller plantebasert (INGEN animalske produkter, heller ikke ost, egg, melk, rømme, smør) -> veganOnly true).

ALLERGIER er viktig for sikkerhet. Legg allergener brukeren ikke tåler i "avoid"-lista. Tolk vanlige norske uttrykk: cøliaki/glutenintoleranse/glutenfri -> "gluten"; laktoseintolerant/melkeallergi/melkefri -> "melk"; eggallergi -> "egg"; fiskeallergi -> "fisk"; soyaallergi -> "soya"; nøtteallergi/peanøttallergi -> "nøtter"; skalldyrallergi -> "skalldyr". Er du i tvil om brukeren nevner en allergi, ta den heller med enn å utelate den. La "avoid" være tom [] hvis ingen allergier nevnes.

Brukerens beskrivelse: "${text.replace(/"/g, "'")}"`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: "Claude-kall feilet", status: res.status, detail }, 502);
    }

    const data = await res.json();
    const raw = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    // Send den rå JSON-teksten tilbake; frontend parser og validerer den.
    return json({ raw: clean });
  } catch (err) {
    return json({ error: "Serverfeil", detail: String(err) }, 500);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
