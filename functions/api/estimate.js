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
    const TO_EMAIL = env.CONTACT_TO_EMAIL;        // your primary inbox
    const TO_EMAIL_2 = env.CONTACT_TO_EMAIL_2;    // optional second inbox (e.g. Gmail)
    const FROM_EMAIL = env.CONTACT_FROM_EMAIL;    // verified sender, like: "ADS Website <info@accelerateddigital.net>"
    if (!RESEND_API_KEY || !TO_EMAIL || !FROM_EMAIL) {
      return j({ ok: false, error: "Email service not configured on Pages." }, 500);
    }

    // Build recipient list — include second email if configured
    const toList = [TO_EMAIL, ...(TO_EMAIL_2 ? [TO_EMAIL_2] : [])];

    const subjectToYou = `ADS Estimate — ${money(estimate.totals.grand)} — ${name}`;
    const subjectToClient = `Your ADS Estimate — ${money(estimate.totals.grand)}`;

    const summary = buildTextSummary({ name, email, notes, estimate, ip });

    // Send to YOU (and any additional inboxes)
    await resendSend({
      apiKey: RESEND_API_KEY,
      from: FROM_EMAIL,
      to: toList,
      subject: subjectToYou,
      text: summary,
      replyTo: email,
    });

    // Send to CLIENT (HTML + plain text fallback)
    await resendSend({
      apiKey: RESEND_API_KEY,
      from: FROM_EMAIL,
      to: email,
      subject: subjectToClient,
      text: `Hi ${name},\n\nHere’s a copy of your estimate request:\n\n${summary}\n\n— Accelerated Digital Solutions`,
      replyTo: TO_EMAIL,
      html: buildClientHtml({ name, email, notes, estimate }),
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

async function resendSend({ apiKey, from, to, subject, text, html, replyTo }) {
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
      ...(html ? { html } : {}),
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

function buildClientHtml({ name, notes, estimate }) {
  const t = estimate.totals || {};
  const hw = estimate.lines?.hardware || [];
  const lb = estimate.lines?.labor || [];

  const rowsHtml = (lines) => lines.map(l => `
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid #1e2330;font-size:14px;color:#c8ccd6;">${l.label}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #1e2330;font-size:14px;color:#c8ccd6;text-align:center;">${l.qty}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #1e2330;font-size:14px;color:#c8ccd6;text-align:right;">${money(l.unit)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #1e2330;font-size:14px;color:#e8eaf0;text-align:right;font-weight:600;">${money(l.ext)}</td>
    </tr>`).join('');

  const sectionHeader = (label) => `
    <tr>
      <td colspan="4" style="padding:10px 12px 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2e7dff;border-bottom:1px solid #1e2330;">${label}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Your ADS Estimate</title>
</head>
<body style="margin:0;padding:0;background:#0b0d11;font-family:'Segoe UI',Arial,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0d11;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0f1520,#111827);border-radius:16px 16px 0 0;padding:32px 32px 28px;border:1px solid #1e2330;border-bottom:none;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <img src="https://www.accelerateddigital.net/assets/ADS%20LOGO%20WHITE.svg" alt="Accelerated Digital Solutions" width="200" style="display:block;margin-bottom:20px;max-width:200px;" />
                <div style="font-size:26px;font-weight:800;color:#f1f1f1;letter-spacing:-0.02em;line-height:1.2;">Your Instant Estimate</div>
                <div style="font-size:14px;color:#8a909e;margin-top:6px;">Hi ${name} — here's a copy of your estimate request.</div>
              </td>
              <td align="right" valign="top">
                <img src="https://www.accelerateddigital.net/assets/ADS%20LOGO%20WHITE%20MONOGRAM.svg" alt="ADS" width="52" height="52" style="display:block;border-radius:10px;background:linear-gradient(135deg,#2e7dff,#1a56cc);padding:8px;" />
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Total banner -->
        <tr><td style="background:#111827;padding:24px 32px;border-left:1px solid #1e2330;border-right:1px solid #1e2330;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#0d1520;border:1px solid #1e2a40;border-radius:12px;padding:20px 24px;">
                <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Estimated Total</div>
                <div style="font-size:36px;font-weight:800;color:#2e7dff;letter-spacing:-0.02em;">${money(t.grand)}</div>
                <div style="margin-top:10px;display:flex;gap:16px;">
                  <span style="font-size:13px;color:#8a909e;">Hardware: <strong style="color:#c8ccd6;">${money(t.hardware)}</strong></span>
                  &nbsp;&nbsp;
                  <span style="font-size:13px;color:#8a909e;">Labor / Wiring: <strong style="color:#c8ccd6;">${money(t.labor)}</strong></span>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Breakdown table -->
        <tr><td style="background:#111827;padding:0 32px 8px;border-left:1px solid #1e2330;border-right:1px solid #1e2330;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1e2330;border-radius:12px;overflow:hidden;border-collapse:separate;border-spacing:0;">
            <!-- Table header -->
            <tr style="background:#0d1117;">
              <th style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;text-align:left;border-bottom:1px solid #1e2330;">Item</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;text-align:center;border-bottom:1px solid #1e2330;">Qty</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;text-align:right;border-bottom:1px solid #1e2330;">Unit</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;text-align:right;border-bottom:1px solid #1e2330;">Total</th>
            </tr>
            ${hw.length ? sectionHeader('Hardware') + rowsHtml(hw) : ''}
            ${lb.length ? sectionHeader('Labor / Wiring') + rowsHtml(lb) : ''}
          </table>
        </td></tr>

        <!-- Notes (if any) -->
        ${notes ? `
        <tr><td style="background:#111827;padding:16px 32px 0;border-left:1px solid #1e2330;border-right:1px solid #1e2330;">
          <div style="background:#0d1117;border:1px solid #1e2330;border-radius:10px;padding:14px 16px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Your Notes</div>
            <div style="font-size:14px;color:#c8ccd6;line-height:1.6;">${notes}</div>
          </div>
        </td></tr>` : ''}

        <!-- Disclaimer -->
        <tr><td style="background:#111827;padding:20px 32px 24px;border-left:1px solid #1e2330;border-right:1px solid #1e2330;">
          <div style="background:#0d1117;border-left:3px solid #2e7dff;border-radius:0 8px 8px 0;padding:12px 16px;">
            <div style="font-size:12px;color:#6b7280;line-height:1.6;"><strong style="color:#8a909e;">Estimate only.</strong> Final pricing depends on site conditions, cable distances, taxes/shipping, and product availability. A site walkthrough gives the most accurate quote.</div>
          </div>
        </td></tr>

        <!-- CTA -->
        <tr><td style="background:#111827;padding:0 32px 32px;border-left:1px solid #1e2330;border-right:1px solid #1e2330;border-radius:0 0 16px 16px;border-bottom:1px solid #1e2330;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#0d1520;border:1px solid #1e2a40;border-radius:12px;padding:20px 24px;">
                <div style="font-size:15px;font-weight:700;color:#f1f1f1;margin-bottom:6px;">Ready to move forward?</div>
                <div style="font-size:13px;color:#8a909e;margin-bottom:16px;">We'd love to do a quick site walkthrough and put together a real quote for you — no commitment needed.</div>
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:10px;">
                      <a href="tel:+13235334872" style="display:inline-block;background:#2e7dff;color:white;text-decoration:none;font-size:13px;font-weight:700;padding:10px 20px;border-radius:8px;">Call / Text Us</a>
                    </td>
                    <td>
                      <a href="https://www.accelerateddigital.net/#contact" style="display:inline-block;background:transparent;color:#2e7dff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 20px;border-radius:8px;border:1px solid #2e7dff;">Contact Form</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Spam notice -->
        <tr><td style="padding:16px 0 0;text-align:center;">
          <div style="font-size:12px;color:#3a4050;line-height:1.6;">If this email landed in spam, please mark it as <strong style="color:#4a5060;">Not Spam</strong> so future<br/>messages from us reach your inbox.</div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:12px 0 8px;text-align:center;">
          <div style="font-size:13px;font-weight:700;color:#4a5060;margin-bottom:4px;">Accelerated Digital Solutions LLC</div>
          <div style="font-size:12px;color:#3a4050;">Los Angeles, California &nbsp;·&nbsp; <a href="tel:+13235334872" style="color:#3a4050;text-decoration:none;">(323) 533-4872</a> &nbsp;·&nbsp; <a href="https://www.accelerateddigital.net" style="color:#3a4050;text-decoration:none;">accelerateddigital.net</a></div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
