export async function onRequestGet() {

  try {

    const prices = {
      u7_pro: 189,
      u6_mesh: 179,
      g5_bullet: 129,
      g5_dome: 179,
      udm_se: 499,
      poe_switch: 109,
      surveillance_hdd: 199
    };

    return new Response(JSON.stringify({
      ok: true,
      items: prices
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });

  } catch (err) {

    return new Response(JSON.stringify({
      ok: false,
      error: err.toString()
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });

  }