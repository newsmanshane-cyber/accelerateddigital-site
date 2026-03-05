export async function onRequestGet() {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,OPTIONS",
    "cache-control": "no-store",
  };

  // Fallback prices (USD). These keep the estimator functional even if live pricing is unavailable.
  // You can tune these anytime.
  const fallback = {
    u7pro: { name: "UniFi U7 Pro (Indoor)", price: 189 },
    u6mesh: { name: "UniFi U6 Mesh (Outdoor)", price: 179 },

    udmpro: { name: "Dream Machine Pro (UDM Pro)", price: 379 },
    cloudkeyplus: { name: "Cloud Key Gen2 Plus", price: 199 },

    unvr: { name: "UNVR", price: 299 },

    g5bullet: { name: "G5 Bullet", price: 129 },
    g5flex: { name: "G5 Flex", price: 99 },
    g5turretultra: { name: "G5 Turret Ultra", price: 129 },

    usw16poe: { name: "USW 16 PoE", price: 299 },
    usw24poe: { name: "USW 24 PoE", price: 399 },
  };

  // ---- LIVE PRICING HOOK (optional) ----
  // If you later implement real Ubiquiti price scraping/lookup, do it here and overwrite fallback prices.
  // For now, we keep it simple and reliable.
  //
  // Example shape to overwrite:
  // live = { u7pro: { price: 179 }, udmpro: { price: 349 }, ... }
  const live = null;

  const merged = { ...fallback };

  if (live && typeof live === "object") {
    for (const [k, v] of Object.entries(live)) {
      if (!merged[k]) continue;
      if (typeof v?.price === "number") merged[k].price = v.price;
    }
  }

  // Backwards-compatible aliases (your current API uses u7Pro / u6Mesh)
  const aliases = {
    u7Pro: merged.u7pro,
    u6Mesh: merged.u6mesh,
  };

  const body = {
    ok: true,
    ts: new Date().toISOString(),
    products: {
      ...merged,
      ...aliases,
    },
    note:
      "Using fallback pricing (live pricing hook not enabled yet).",
  };

  return new Response(JSON.stringify(body, null, 2), { headers });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
