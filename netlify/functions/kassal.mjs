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
  const ean = (url.searchParams.get("ean") || "").trim();
  if (!search && !ean) return json({ error: "Mangler søk (?search=... eller ?ean=...)" }, 400);

  const key = process.env.KASSAL_API_KEY;
  if (!key) return json({ error: "Mangler KASSAL_API_KEY på serveren" }, 500);

  // Oppslag på strekkode gir samme produkt hver gang — trygt for prisoppdatering.
  // Søk gir en liste å velge fra (brukes når man kobler råvaren første gang).
  const api = ean
    ? `https://kassal.app/api/v1/products/ean/${encodeURIComponent(ean)}`
    : `https://kassal.app/api/v1/products?search=${encodeURIComponent(search)}&unique=1`;

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

    // Pris og vekt kommer i ulike former: tall, tekst, eller objekt ({price, date}).
    // Strekkode-oppslaget og søket svarer ikke likt, så vi graver ut tallet uansett form.
    const tall = (v, dybde = 0) => {
      if (v == null || dybde > 3) return null;
      if (typeof v === "number") return isFinite(v) ? v : null;
      if (typeof v === "string") { const n = parseFloat(v.replace(",", ".")); return isNaN(n) ? null : n; }
      if (typeof v === "object") {
        return tall(v.price ?? v.current_price ?? v.amount ?? v.value ?? v.kr, dybde + 1);
      }
      return null;
    };

    // EAN-oppslaget svarer i et annet format enn søket, så vi normaliserer begge
    // til samme liste. Noen felt (vekt, navn) kan ligge på «foreldre»-objektet.
    const rot = data.data;
    const forelder = (rot && !Array.isArray(rot)) ? rot : null;
    const liste = Array.isArray(rot) ? rot
                : (forelder && Array.isArray(forelder.products)) ? forelder.products
                : (forelder ? [forelder] : []);

    const products = liste.map((p) => ({
      name: p.name ?? forelder?.name ?? null,
      store: p.store?.name ?? (typeof p.store === "string" ? p.store : null),
      price: tall(p.current_price ?? p.price),
      unitPrice: tall(p.current_unit_price ?? p.unit_price),
      weight: tall(p.weight ?? forelder?.weight),
      weightUnit: p.weight_unit ?? forelder?.weight_unit ?? null,
      ean: p.ean ?? forelder?.ean ?? null,
      image: p.image ?? forelder?.image ?? null,
      url: p.url ?? null,
      // makroer per 100 g
      kcal: nut(p.nutrition ?? forelder?.nutrition, "energi_kcal"),
      protein: nut(p.nutrition ?? forelder?.nutrition, "protein"),
      carbs: nut(p.nutrition ?? forelder?.nutrition, "karbohydrater"),
      fat: nut(p.nutrition ?? forelder?.nutrition, "fett_totalt"),
    })).filter((p) => typeof p.price === "number" && p.price > 0);

    // Fant vi ingenting? Ta med et lite hint om hvordan svaret faktisk så ut,
    // så feilsøking ikke blir gjetting.
    const svar = { search: search || null, ean: ean || null, count: products.length, products };
    if (!products.length) {
      const p0 = liste[0] || null;
      svar.hint = {
        antallRader: liste.length,
        felter: p0 ? Object.keys(p0).slice(0, 25) : (forelder ? Object.keys(forelder).slice(0, 25) : []),
        prisFelt: p0 ? { current_price: p0.current_price, price: p0.price } : null,
      };
    }
    return json(svar);
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
