export async function onRequestPost(context) {
  const { request, env } = context;

  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  };

  try {
    const body = await request.json().catch(() => null);
    if (!body) return json({ ok: false, error: "Invalid JSON." }, 400, headers);

    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const notes = (body.notes || "").trim();
    const turnstileToken = (body.turnstileToken || "").trim();
    const estimate = body.estimate || null;

    if (!name || !email) return json({ ok: false, error: "Name and email are required." }, 400, headers);
    if (!turnstileToken) return json({ ok: false, error: "Missing verification token." }, 400, headers);
    if (!estimate || !estimate.totals) return json({ ok: false, error: "Missing estimate payload." }, 400, headers);

    // Server-side Turnstile validation
    // Requires env.TURNSTILE_SECRET_KEY
    const tsOK = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, turnstileToken, request);
    if (!tsOK.ok) return json({ ok: false, error: "Verification failed." }, 403, headers);

    // Resend config
    const RESEND_API_KEY = env.RESEND_API_KEY;
    const TO_EMAIL = env.CONTACT_TO_EMAIL;
    const FROM_EMAIL = env.CONTACT_FROM_EMAIL; // e.g. "ADS <noreply@yourdomain.com>"
    if (!RESEND_API_KEY || !TO_EMAIL || !FROM_EMAIL) {
      return json({ ok: false, error: "Email service not configured." }, 500, headers);
    }

    const totals = estimate.totals || {};
    const selections = estimate.selections || {};
    const lines = estimate.lines || {};
    const hardwareLines = Array.isArray(lines.hardware) ? lines.hardware : [];
    const laborLines = Array.isArray(lines.labor) ? lines.labor : [];

    const subject = `ADS Estimate – ${money(totals.grand)} – ${name}`;

    const summaryText = buildTextSummary({
      name,
      email,
      notes,
      totals,
      selections,
      hardwareLines,
      laborLines,
    });

    // Email to you (internal)
    await resendSend({
      apiKey: RESEND_API_KEY,
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject,
      text: summaryText,
      replyTo: email,
    });

    // Email to client (receipt)
    await resendSend({
      apiKey: RESEND_API_KEY,
      from: FROM_EMAIL,
      to: email,
      subject: `Your ADS Estimate – ${money(totals.grand)}`,
      text: `Hi ${name},\n\nHere’s a copy of your estimate request:\n\n${summaryText}\n\n— Accelerated Digital Solutions`,
      replyTo: TO_EMAIL,
    });

    return json({ ok: true }, 200, headers);
  } catch (err) {
    return json({ ok: false, error: "Server error." }, 500, headers);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers });
}

async function verifyTurnstile(secret, token, request) {
  if (!secret) return { ok: false };

  const ip = request.headers.get("CF-Connecting-IP") || "";
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);

  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });

  const data = await resp.json().catch(() => null);
  return { ok: !!data?.success, data };
}

async function resendSend({ apiKey, from, to, subject, text, replyTo }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      reply_to: replyTo || undefined,
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Resend error: ${res.status} ${msg}`);
  }
}

function money(n) {
  const x = Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
  return x.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function buildTextSummary({ name, email, notes, totals, selections, hardwareLines, laborLines }) {
  const lines = [];

  lines.push(`Name: ${name}`);
  lines.push(`Email: ${email}`);
  if (notes) lines.push(`Notes: ${notes}`);
  lines.push("");

  lines.push(`TOTAL: ${money(totals.grand)}`);
  lines.push(`Hardware: ${money(totals.hardware)}`);
  lines.push(`Labor/Wiring: ${money(totals.labor)}`);
  lines.push("");

  lines.push("Selections:");
  lines.push(`- Indoor APs (U7 Pro): ${selections.indoor || 0}`);
  lines.push(`- Outdoor APs (U6 Mesh): ${selections.outdoor || 0}`);
  lines.push(`- Cameras: Bullet ${selections.g5bullet || 0}, Flex ${selections.g5flex || 0}, Turret ${selections.g5turretultra || 0}`);
  lines.push(`- UniFi Console: ${selections.console || "none"}`);
  lines.push(`- NVR: ${selections.nvr || "none"}`);
  lines.push(`- PoE Switch: ${selections.poe || "none"}`);
  lines.push(`- Cat6 drops: ${selections.drops || 0}`);
  lines.push(`- Tier: ${selections.tier || "standard"}`);
  lines.push("");

  lines.push("Breakdown (Hardware):");
  if (hardwareLines.length) {
    for (const l of hardwareLines) lines.push(`- ${l.label}: ${money(l.ext)}`);
  } else {
    lines.push("- (none)");
  }

  lines.push("");
  lines.push("Breakdown (Labor/Wiring):");
  if (laborLines.length) {
    for (const l of laborLines) lines.push(`- ${l.label}: ${money(l.ext)}`);
  } else {
    lines.push("- (none)");
  }

  lines.push("");
  lines.push("Disclaimer: Estimate only. Final pricing depends on site conditions, taxes/shipping, and availability.");

  return lines.join("\n");
}
