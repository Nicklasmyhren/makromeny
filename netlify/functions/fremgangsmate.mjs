// netlify/functions/fremgangsmate.mjs
// Genererer en fast, mengde-NØYTRAL fremgangsmåte for én rett.
// Kalles fra admin-siden i appen. Krever ANTHROPIC_API_KEY som miljøvariabel.

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "ugyldig json" }), { status: 400 }); }

  const { dishName, ingredients = [], beskrivelse = "", tid = null } = body || {};
  if (!dishName || !Array.isArray(ingredients) || !ingredients.length) {
    return new Response(JSON.stringify({ error: "mangler dishName/ingredients" }), { status: 400 });
  }

  const prompt = `Du er kokk og skriver en fast fremgangsmåte for retten "${dishName}" i en norsk middags-app.

Ingredienser i retten (kun disse): ${ingredients.join(", ")}
${beskrivelse ? `Kort beskrivelse av retten: ${beskrivelse}` : ""}
${tid ? `Cirka tilberedningstid: ${tid} minutter` : ""}

KRAV — følg alle:
- Returner KUN gyldig JSON uten markdown, uten kodeblokk, uten tekst rundt: {"timeMin":<tall>,"steps":["...","..."]}
- 4 til 8 steg. Korte, imperative setninger på norsk bokmål.
- MENGDE-NØYTRAL: bruk ALDRI absolutte mengder (ikke "400 g", "2 ss", "1 boks", "3 stk"). Bruk relative formuleringer i stedet: "halvparten av løken", "alt kjøttet", "til gyllen", "til det bobler", "til risen er mør". Mengdene står i appens ingrediensliste, som skalerer med antall porsjoner — fremgangsmåten skal fungere uansett porsjonstall.
- Ovnstemperaturer (f.eks. 200 grader) og tider i minutter er LOV — de er ikke mengder.
- Bruk kun ingrediensene i lista, pluss salt, pepper og vann.
- Ikke nevn antall porsjoner.

Svar med KUN JSON-objektet. Ingen innledning, ingen forklaring, ingen tekst etter. Første tegn i svaret ditt skal være { og siste tegn skal være }.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [
        { role: "user", content: prompt },
        { role: "assistant", content: "{" }
      ]
    })
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    return new Response(JSON.stringify({ error: "anthropic " + res.status, detail }), { status: 502 });
  }

  const data = await res.json();
  const cont = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  // Vi forhåndsutfylte svaret med "{", så legg den på igjen for gyldig JSON.
  const raw = cont.startsWith("{") ? cont : "{" + cont;
  return new Response(JSON.stringify({ raw }), {
    headers: { "Content-Type": "application/json" }
  });
};
