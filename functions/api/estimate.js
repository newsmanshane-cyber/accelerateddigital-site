export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => null);
    if (!body) return j({ ok: false, error: "Invalid JSON." }, 400);

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const notes = String(body.notes || "").trim();
    const token = String(body.turnstileToken || "").trim();
    const estimate = body.estimate || null;

    if (!name || !email) return j({ ok: false, error: "Name and email are required." }, 400);
    if (!token) return j({ ok: false, error: "Please complete verification." }, 400);
    if (!estimate?.totals) return j({ ok: false, error: "Missing estimate payload." }, 400);

    // ✅ Accept either TURNSTILE_SECRET (your Worker uses this) or TURNSTILE_SECRET_KEY
    const TURNSTILE_SECRET = env.TURNSTILE_SECRET || env.TURNSTILE_SECRET_KEY;
    if (!TURNSTILE_SECRET) {
      return j({ ok: false, error: "Turnstile secret not configured on Pages." }, 500);
    }
/////
    // Verify Turnstile
    const ip = request.headers.get("CF-Connecting-IP") || "";
    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });

    const verify = await verifyRes.json().catch(() => ({}));
    if (!verify?.success) {
      // include error codes so debugging is easy
      return j({ ok: false, error: "Verification failed.", codes: verify?.["error-codes"] || [] }, 403);
    }

    // Resend config (must exist in Pages env vars)
    const RESEND_API_KEY = env.RESEND_API_KEY;
    const TO_EMAIL = env.CONTACT_TO_EMAIL;        // your inbox
    const FROM_EMAIL = env.CONTACT_FROM_EMAIL;    // verified sender, like: "ADS Website <info@accelerateddigital.net>"
    if (!RESEND_API_KEY || !TO_EMAIL || !FROM_EMAIL) {
      return j({ ok: false, error: "Email service not configured on Pages." }, 500);
    }

    const subjectToYou = `ADS Estimate — ${money(estimate.totals.grand)} — ${name}`;
    const subjectToClient = `Your ADS Estimate — ${money(estimate.totals.grand)}`;

    const summary = buildTextSummary({ name, email, notes, estimate, ip });

    // Send to YOU
    await resendSend({
      apiKey: RESEND_API_KEY,
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: subjectToYou,
      text: summary,
      replyTo: email,
    });

    // Send to CLIENT
    await resendSend({
      apiKey: RESEND_API_KEY,
      from: FROM_EMAIL,
      to: email,
      subject: subjectToClient,
      text: `Hi ${name},\n\nHere’s a copy of your estimate request:\n\n${summary}\n\n— Accelerated Digital Solutions`,
      replyTo: TO_EMAIL,
    });

    return j({ ok: true }, 200);
  } catch (e) {
    return j({ ok: false, error: "Server error." }, 500);
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

function j(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

async function resendSend({ apiKey, from, to, subject, text, replyTo }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
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

function buildTextSummary({ name, email, notes, estimate, ip }) {
  const t = estimate.totals || {};
  const s = estimate.selections || {};
  const hw = estimate.lines?.hardware || [];
  const lb = estimate.lines?.labor || [];

  const lines = [];
  lines.push(`New estimate request`);
  lines.push(``);
  lines.push(`Name: ${name}`);
  lines.push(`Email: ${email}`);
  if (ip) lines.push(`IP: ${ip}`);
  if (notes) lines.push(`Notes: ${notes}`);
  lines.push(``);
  lines.push(`TOTAL: ${money(t.grand)}`);
  lines.push(`Hardware: ${money(t.hardware)}`);
  lines.push(`Labor/Wiring: ${money(t.labor)}`);
  lines.push(``);
  lines.push(`Selections:`);
  lines.push(`- Indoor APs (U7 Pro): ${s.indoor || 0}`);
  lines.push(`- Outdoor APs (U6 Mesh): ${s.outdoor || 0}`);
  lines.push(`- Cameras: Bullet ${s.g5bullet || 0}, Flex ${s.g5flex || 0}, Turret ${s.g5turretultra || 0}`);
  lines.push(`- Console: ${s.console || "none"}`);
  lines.push(`- NVR: ${s.nvr || "none"}`);
  lines.push(`- PoE Switch: ${s.poe || "none"}`);
  lines.push(`- Cat6 drops: ${s.drops || 0}`);
  lines.push(`- Tier: ${s.tier || "standard"}`);
  lines.push(``);
  lines.push(`Hardware breakdown:`);
  if (hw.length) hw.forEach(l => lines.push(`- ${l.label}: ${money(l.ext)}`));
  else lines.push(`- (none)`);
  lines.push(``);
  lines.push(`Labor/Wiring breakdown:`);
  if (lb.length) lb.forEach(l => lines.push(`- ${l.label}: ${money(l.ext)}`));
  else lines.push(`- (none)`);
  lines.push(``);
  lines.push(`Disclaimer: Estimate only. Final pricing depends on site conditions, taxes/shipping, and availability.`);
  return lines.join("\n");
}
