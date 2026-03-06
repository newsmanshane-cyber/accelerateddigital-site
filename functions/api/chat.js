/**
 * Cloudflare Pages Function: /functions/api/chat.js
 *
 * Proxies chat messages to the Anthropic API.
 * Requires env var: ANTHROPIC_API_KEY
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return json({ ok: false, error: "Chat service not configured." }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  const messages = body.messages;
  const system   = body.system || "";

  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ ok: false, error: "No messages provided." }, 400);
  }

  // Sanitize messages — only allow role/content strings
  const sanitized = messages
    .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20) // keep last 20 turns max to control token usage
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) })); // cap per message

  if (sanitized.length === 0) {
    return json({ ok: false, error: "No valid messages." }, 400);
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",  // Fast + affordable for a chat widget
        max_tokens: 512,
        system: system.slice(0, 4000),
        messages: sanitized,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Anthropic error:", data);
      return json({ ok: false, error: "AI service error." }, 502);
    }

    const reply = data?.content?.[0]?.text?.trim() || "";
    if (!reply) {
      return json({ ok: false, error: "Empty response from AI." }, 502);
    }

    return json({ ok: true, reply });

  } catch (e) {
    console.error("Chat function error:", e);
    return json({ ok: false, error: "Server error." }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}
