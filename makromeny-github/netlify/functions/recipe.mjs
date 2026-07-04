// netlify/functions/recipe.mjs
//
// Tar imot { dishName, persons, ingredients:[{amount,unit,name}] } og lar Claude
// skrive fremgangsmåten — men KUN ut fra de oppgitte ingrediensene, slik at
// oppskriften alltid stemmer med handlelista. Ingredienslista bestemmes av
// appen (samme data som bygger handlekurven); Claude skriver bare stegene.

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Bruk POST" }, 405);

  let dishName = "", persons = 2, ingredients = [];
  try {
    const body = await request.json();
    dishName = typeof body.dishName === "string" ? body.dishName.slice(0, 120) : "";
    persons = Math.max(1, Math.min(12, parseInt(body.persons, 10) || 2));
    if (Array.isArray(body.ingredients)) {
      ingredients = body.ingredients
        .filter((i) => i && typeof i.name === "string")
        .slice(0, 40)
        .map((i) => ({
          amount: Number(i.amount) || 0,
          unit: typeof i.unit === "string" ? i.unit : "g",
          name: String(i.name).slice(0, 80),
        }));
    }
  } catch {
    return json({ error: "Ugyldig forespørsel" }, 400);
  }
  if (!dishName || !ingredients.length) return json({ error: "Mangler rett eller ingredienser" }, 400);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: "Mangler ANTHROPIC_API_KEY på serveren" }, 500);

  const ingList = ingredients
    .map((i) => (i.unit === "stk" ? `- ${i.amount} ${i.name}` : `- ${i.amount} ${i.unit} ${i.name}`))
    .join("\n");

  const prompt =
`Du er en erfaren norsk hjemmekokk. Skriv en kort og tydelig oppskrift for retten under, på norsk.

Du får en FAST ingrediensliste med mengder (allerede skalert til ${persons} porsjoner). Bruk KUN disse ingrediensene i fremgangsmåten. Du kan anta at vann, salt og pepper finnes hjemme, men IKKE introduser noen andre ingredienser — handlelista skal stemme nøyaktig.

Returner KUN gyldig JSON, uten markdown og uten tekst rundt:
{"timeMin": <antatt total tid i minutter, tall>, "steps": ["kort konkret steg", "kort konkret steg", ...]}

Bruk 4 til 7 korte steg. Nevn gjerne mengder fra lista der det er nyttig.

Rett: ${dishName}
Ingredienser (${persons} porsjoner):
${ingList}`;

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
