/**
 * Cloudflare Pages Function
 * File location in your repo: functions/api/contact.js
 *
 * Required environment variables (set in Cloudflare Pages → Settings → Environment Variables):
 *   RESEND_API_KEY       — from resend.com
 *   CONTACT_TO_EMAIL     — your primary inbox, e.g. info@accelerateddigital.net
 *   CONTACT_TO_EMAIL_2   — optional second inbox, e.g. accelerateddigitalllc@gmail.com
 *   CONTACT_FROM_EMAIL   — verified Resend sender, e.g. ADS Website <info@accelerateddigital.net>
 *   TURNSTILE_SECRET     — secret key from Cloudflare Turnstile dashboard
 */

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  const name    = String(body.name    || "").trim();
  const email   = String(body.email   || "").trim();
  const message = String(body.message || "").trim();
  const fax     = String(body.fax     || "").trim(); // honeypot
  const token   = String(body.turnstileToken || "").trim();

  // ── 2. Honeypot check ──────────────────────────────────────────────────────
  if (fax) {
    // Bot filled the hidden field — silently succeed so bots don't know
    return json({ ok: true }, 200);
  }

  // ── 3. Basic validation ────────────────────────────────────────────────────
  if (!name || !email || !message) {
    return json({ ok: false, error: "Please complete all fields." }, 400);
  }
  if (!token) {
    return json({ ok: false, error: "Please complete the verification." }, 400);
  }

  // ── 4. Verify Turnstile ────────────────────────────────────────────────────
  const TURNSTILE_SECRET = env.TURNSTILE_SECRET || env.TURNSTILE_SECRET_KEY;
  if (!TURNSTILE_SECRET) {
    console.error("[contact] TURNSTILE_SECRET env var not set.");
    return json({ ok: false, error: "Verification not configured." }, 500);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "";
  let verify;
  try {
    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });
    verify = await verifyRes.json();
  } catch (err) {
    console.error("[contact] Turnstile fetch failed:", err);
    return json({ ok: false, error: "Could not complete verification. Please try again." }, 502);
  }

  if (!verify?.success) {
    console.error("[contact] Turnstile failed:", verify?.["error-codes"]);
    return json({ ok: false, error: "Verification failed. Please refresh and try again." }, 403);
  }

  // ── 5. Check email config ──────────────────────────────────────────────────
  const RESEND_API_KEY   = env.RESEND_API_KEY;
  const TO_EMAIL         = env.CONTACT_TO_EMAIL;
  const TO_EMAIL_2       = env.CONTACT_TO_EMAIL_2; // optional
  const FROM_EMAIL       = env.CONTACT_FROM_EMAIL;

  if (!RESEND_API_KEY || !TO_EMAIL || !FROM_EMAIL) {
    console.error("[contact] Missing email env vars.");
    return json({ ok: false, error: "Email service not configured." }, 500);
  }

  const toList = [TO_EMAIL, ...(TO_EMAIL_2 ? [TO_EMAIL_2] : [])];

  // ── 6. Build email bodies ──────────────────────────────────────────────────
  const notifyBody = [
    `New contact form submission`,
    ``,
    `Name:    ${name}`,
    `Email:   ${email}`,
    `IP:      ${ip || "unknown"}`,
    ``,
    `Message:`,
    message,
    ``,
    `---`,
    `Reply directly to this email to respond to ${name}.`,
  ].join("\n");

  const confirmBody = [
    `Hi ${name},`,
    ``,
    `Thanks for reaching out to Accelerated Digital Solutions! We received your message and will get back to you shortly.`,
    ``,
    `Here's a copy of what you sent:`,
    ``,
    message,
    ``,
    `In the meantime, feel free to call or text us at (323) 533-4872.`,
    ``,
    `— The ADS Team`,
    `Accelerated Digital Solutions LLC`,
    `accelerateddigital.net`,
  ].join("\n");

  // ── 7. Send emails ─────────────────────────────────────────────────────────
  try {
    // Notify ADS (all inboxes)
    await resendSend({
      apiKey:   RESEND_API_KEY,
      from:     FROM_EMAIL,
      to:       toList,
      subject:  `New message from ${name} — ADS Contact Form`,
      text:     notifyBody,
      replyTo:  email,
    });

    // Confirm to the sender
    await resendSend({
      apiKey:   RESEND_API_KEY,
      from:     FROM_EMAIL,
      to:       email,
      subject:  `We got your message — Accelerated Digital Solutions`,
      text:     confirmBody,
      replyTo:  TO_EMAIL,
    });

    return json({ ok: true }, 200);

  } catch (err) {
    console.error("[contact] Resend error:", err);
    return json({ ok: false, error: "Could not send message. Please try again or call us at (323) 533-4872." }, 502);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
    throw new Error(`Resend error ${res.status}: ${msg}`);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...CORS_HEADERS,
    },
  });
}
