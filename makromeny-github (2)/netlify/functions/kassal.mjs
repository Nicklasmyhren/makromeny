// netlify/functions/kassal.mjs
//
// Slår opp dagligvarer i Kassalapp-API-et og returnerer en ryddet liste med
// navn, pris, vekt, butikk og de fire makroene (per 100 g) vi trenger til ING-tabellen.
// Kassal-nøkkelen leses fra miljøvariabelen KASSAL_API_KEY og sendes aldri til nettleseren.
//
// Test direkte i nettleser:  /.netlify/functions/kassal?search=kyllingfilet

export default async (request) => {
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim();
  if (!search) return json({ error: "Mangler søk (?search=...)" }, 400);

  const key = process.env.KASSAL_API_KEY;
  if (!key) return json({ error: "Mangler KASSAL_API_KEY på serveren" }, 500);

  // Hold forespørselen minimal; unique=1 gir én rad per vare (Kassal vil ha 1/0, ikke true/false).
  const api = `https://kassal.app/api/v1/products?search=${encodeURIComponent(search)}&unique=1`;

  try {
    const res = await fetch(api, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!res.ok) {
      let detail = await res.text();
      try { detail = JSON.parse(detail); } catch {}
      return json({ error: "Kassal-kall feilet", status: res.status, detail }, 502);
    }
    const data = await res.json();

    // Næringsinnhold kommer som liste [{code, amount, unit}] — plukk ut det vi vil ha.
    const nut = (arr, code) => {
      const f = (arr || []).find((x) => x.code === code);
      return f && typeof f.amount === "number" ? f.amount : null;
    };

    const products = (data.data || []).map((p) => ({
      name: p.name,
      store: p.store?.name ?? null,
      price: p.current_price ?? null,
      unitPrice: p.current_unit_price ?? null,
      weight: p.weight ?? null,
      weightUnit: p.weight_unit ?? null,
      ean: p.ean ?? null,
      image: p.image ?? null,
      url: p.url ?? null,
      // makroer per 100 g
      kcal: nut(p.nutrition, "energi_kcal"),
      protein: nut(p.nutrition, "protein"),
      carbs: nut(p.nutrition, "karbohydrater"),
      fat: nut(p.nutrition, "fett_totalt"),
    }));

    return json({ search, count: products.length, products });
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
