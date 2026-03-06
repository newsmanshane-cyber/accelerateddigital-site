/**
 * Cloudflare Pages Function
 * File location in your repo: functions/api/chat.js
 *
 * Required Cloudflare Pages environment variable:
 *   ANTHROPIC_API_KEY  — your key from console.anthropic.com
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

  // 1. Check API key is configured
  const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    console.error("[accel-chat] ANTHROPIC_API_KEY env var is not set.");
    return json({ ok: false, error: "Chat service not configured." }, 500);
  }

  // 2. Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const { messages, system } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ ok: false, error: "No messages provided." }, 400);
  }

  // 3. Sanitize + cap messages
  const sanitized = messages
    .filter(m =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0
    )
    .slice(-20)
    .map(m => ({
      role: m.role,
      content: m.content.slice(0, 2000),
    }));

  if (sanitized.length === 0) {
    return json({ ok: false, error: "No valid messages after sanitization." }, 400);
  }

  // 4. Call Anthropic
  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: typeof system === "string" ? system.slice(0, 4000) : "",
        messages: sanitized,
      }),
    });
  } catch (err) {
    console.error("[accel-chat] Fetch to Anthropic failed:", err);
    return json({ ok: false, error: "Could not reach AI service." }, 502);
  }

  // 5. Parse Anthropic response
  let data;
  try {
    data = await anthropicRes.json();
  } catch {
    console.error("[accel-chat] Failed to parse Anthropic response.");
    return json({ ok: false, error: "Bad response from AI service." }, 502);
  }

  if (!anthropicRes.ok) {
    console.error("[accel-chat] Anthropic API error:", anthropicRes.status, JSON.stringify(data));
    return json(
      { ok: false, error: data?.error?.message || "AI service error." },
      502
    );
  }

  const reply = data?.content?.[0]?.text?.trim();
  if (!reply) {
    console.error("[accel-chat] Empty reply from Anthropic:", JSON.stringify(data));
    return json({ ok: false, error: "Empty response from AI." }, 502);
  }

  return json({ ok: true, reply });
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
