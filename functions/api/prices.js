export async function onRequestGet() {
  // CORS headers so your site JS can call /api/prices
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,OPTIONS",
  };

  try {
    // TODO: Replace this stub with live Ubiquiti pricing fetch logic
    const data = {
      ok: true,
      ts: new Date().toISOString(),
      products: {
        u7Pro: { name: "UniFi U7 Pro (Indoor)", price: null },
        u6Mesh: { name: "UniFi U6 Mesh (Outdoor)", price: null },
        // add your camera SKUs here
      },
      note: "Stub response. Add live pricing fetch next.",
    };

    return new Response(JSON.stringify(data, null, 2), { headers });
  } catch (err) {
    return new Response(
      JSON.stringify(
        { ok: false, error: String(err?.message || err) },
        null,
        2
      ),
      { status: 500, headers }
    );
  }
}

// Optional: handle preflight if anything ever sends OPTIONS
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
