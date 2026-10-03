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
 *   CLEARPATH_TO_EMAIL   — optional; inbox for ClearPath inquiries (defaults to support@clearpathmonitoring.com)
 *
 * ClearPath inquiries (body.product === "clearpath") go to the ClearPath inbox as well as the
 * primary inbox, and the confirmation is signed by ClearPath with replies going to support@.
 */

const CLEARPATH_DEFAULT_TO = "support@clearpathmonitoring.com";

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
  const isClearPath = String(body.product || "").trim().toLowerCase() === "clearpath";
  const organization = String(body.organization || "").trim().slice(0, 200);
  const role         = String(body.role || "").trim().slice(0, 100);

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

  const CLEARPATH_TO = env.CLEARPATH_TO_EMAIL || CLEARPATH_DEFAULT_TO;
  const toList = [
    ...(isClearPath ? [CLEARPATH_TO] : []),
    TO_EMAIL,
    ...(TO_EMAIL_2 ? [TO_EMAIL_2] : []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  // ── 6. Build email bodies ──────────────────────────────────────────────────
  const notifyBody = [
    isClearPath ? `New ClearPath Monitoring inquiry` : `New contact form submission`,
    ``,
    `Name:    ${name}`,
    `Email:   ${email}`,
    ...(organization ? [`Org:     ${organization}`] : []),
    ...(role ? [`Role:    ${role}`] : []),
    `IP:      ${ip || "unknown"}`,
    ``,
    `Message:`,
    message,
    ``,
    `---`,
    `Reply directly to this email to respond to ${name}.`,
  ].join("\n");

  const confirmBody = isClearPath ? [
    `Hi ${name},`,
    ``,
    `Thanks for your interest in ClearPath Monitoring! We received your request and will get back to you shortly.`,
    ``,
    `Here's a copy of what you sent:`,
    ``,
    message,
    ``,
    `If you have anything to add, just reply to this email or write to ${CLEARPATH_DEFAULT_TO}.`,
    ``,
    `— The ClearPath Team`,
    `ClearPath Monitoring, a product of Accelerated Digital Solutions LLC`,
    `accelerateddigital.net/clearpath`,
  ].join("\n") : [
    `Hi ${name},`,
    ``,
    `Thanks for reaching out to Accelerated Digital Solutions! We received your message and will get back to you shortly.`,
    ``,
    `Here's a copy of what you sent:`,
    ``,
    message,
    ``,
    `If you have anything to add, just reply to this email.`,
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
      subject:  isClearPath
        ? `ClearPath inquiry from ${name}${organization ? ` (${organization})` : ""}`
        : `New message from ${name} — ADS Contact Form`,
      text:     notifyBody,
      replyTo:  email,
    });

    // Confirm to the sender
    await resendSend({
      apiKey:   RESEND_API_KEY,
      from:     FROM_EMAIL,
      to:       email,
      subject:  isClearPath
        ? `We got your request — ClearPath Monitoring`
        : `We got your message — Accelerated Digital Solutions`,
      text:     confirmBody,
      replyTo:  isClearPath ? CLEARPATH_TO : TO_EMAIL,
    });

    return json({ ok: true }, 200);

  } catch (err) {
    console.error("[contact] Resend error:", err);
    return json({ ok: false, error: "Could not send message. Please try again or email info@accelerateddigital.net." }, 502);
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
