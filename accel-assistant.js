(() => {
  // ─── Config ───────────────────────────────────────────────────────────────
  const BOT_NAME   = "AccelAssistant";
  const API_PATH   = "/api/chat";          // Cloudflare Pages Function
  const ACCENT     = "#2e7dff";
  const WIDGET_ID  = "accel-assistant";

  const SYSTEM_PROMPT = `You are AccelAssistant, a friendly and knowledgeable helper for Accelerated Digital Solutions LLC (ADS) — a Los Angeles-based IT and network infrastructure company.

Your role is to help website visitors understand what ADS does, answer general questions about networking, Wi-Fi, structured cabling, security cameras, and IT setup, and guide people toward reaching out when they have a specific project in mind.

About ADS:
- Services: Network infrastructure (routing, switching, VLANs, firewalls), Wi-Fi deployment (UniFi enterprise systems), structured cabling (Cat6, patch panels, racks), IP cameras & NVR (UniFi Protect), IT setup & support, production/streaming networks
- Service area: Greater Los Angeles — LA, Pasadena, Glendale, Burbank, Santa Monica, Culver City, San Fernando Valley, and nearby areas by request
- Contact: (323) 533-4872 | info@accelerateddigital.net
- The website has an Instant Estimate tool for rough ballpark pricing on UniFi systems

Tone & behavior guidelines:
- Be helpful, honest, and conversational — not sales-y or pushy
- Never promise specific outcomes, timelines, or prices (the estimate tool gives rough ballpark figures only)
- If someone asks something you genuinely don't know (like current availability or a specific technical detail about their site), say so and suggest they call or email
- Keep responses concise — 2–4 sentences is usually right; longer only when truly needed
- If someone seems ready to move forward, naturally mention they can use the contact form, call, or text (323) 533-4872
- You're not a replacement for a real consultation — always be honest that a site visit or call is the best way to get accurate answers
- Never make up specs, prices, or claims about products you're not sure about`;

  const STARTERS = [
    "What areas do you serve?",
    "How does Wi-Fi deployment work?",
    "Do you handle security cameras?",
    "What's a rough cost for a small office?",
  ];

  // ─── State ─────────────────────────────────────────────────────────────────
  let isOpen    = false;
  let isLoading = false;
  let history   = []; // { role, content }

  // ─── Inject styles ─────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #${WIDGET_ID}-btn {
      position: fixed;
      bottom: 18px;
      left: 18px;
      z-index: 1200;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 13px 18px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.10);
      background: linear-gradient(160deg, rgba(20,24,32,0.97), rgba(12,15,20,0.97));
      color: #f1f1f1;
      font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
      font-size: 0.92rem;
      font-weight: 700;
      letter-spacing: 0.01em;
      cursor: pointer;
      backdrop-filter: blur(14px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(46,125,255,0.08);
      transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
      white-space: nowrap;
    }
    #${WIDGET_ID}-btn:hover {
      transform: translateY(-2px);
      border-color: rgba(46,125,255,0.35);
      box-shadow: 0 14px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(46,125,255,0.18);
    }
    #${WIDGET_ID}-btn .aa-dot {
      width: 9px; height: 9px;
      border-radius: 999px;
      background: ${ACCENT};
      box-shadow: 0 0 10px rgba(46,125,255,0.8);
      flex-shrink: 0;
      animation: aa-pulse 2.4s ease-in-out infinite;
    }
    @keyframes aa-pulse {
      0%,100% { box-shadow: 0 0 8px rgba(46,125,255,0.7); }
      50%      { box-shadow: 0 0 18px rgba(46,125,255,1); }
    }

    #${WIDGET_ID}-window {
      position: fixed;
      bottom: 88px;
      left: 18px;
      z-index: 1200;
      width: min(380px, calc(100vw - 32px));
      max-height: min(560px, calc(100vh - 180px));
      display: flex;
      flex-direction: column;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.09);
      background: rgba(14,17,22,0.97);
      backdrop-filter: blur(20px);
      box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(46,125,255,0.06);
      font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
      color: #f1f1f1;
      overflow: hidden;
      transform: translateY(12px) scale(0.97);
      opacity: 0;
      pointer-events: none;
      transition: transform .25s ease, opacity .22s ease;
    }
    #${WIDGET_ID}-window.aa-open {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: all;
    }

    /* Header */
    .aa-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      background: rgba(255,255,255,0.025);
      flex-shrink: 0;
    }
    .aa-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .aa-avatar {
      width: 34px; height: 34px;
      border-radius: 10px;
      background: linear-gradient(135deg, ${ACCENT}, #1a56cc);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      font-size: 15px;
    }
    .aa-header-info { display: flex; flex-direction: column; gap: 1px; }
    .aa-header-name { font-size: 0.9rem; font-weight: 700; letter-spacing: -0.01em; }
    .aa-header-sub  { font-size: 0.72rem; color: #8a909e; }
    .aa-close {
      width: 30px; height: 30px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.04);
      color: #8a909e;
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: background .15s, color .15s;
      font-size: 16px;
      flex-shrink: 0;
    }
    .aa-close:hover { background: rgba(255,255,255,0.09); color: #f1f1f1; }

    /* Messages */
    .aa-messages {
      flex: 1;
      overflow-y: auto;
      padding: 14px 14px 8px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .aa-messages::-webkit-scrollbar { width: 4px; }
    .aa-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 4px; }

    .aa-msg {
      display: flex;
      flex-direction: column;
      max-width: 88%;
      gap: 3px;
      animation: aa-msgIn .2s ease;
    }
    @keyframes aa-msgIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .aa-msg.aa-bot  { align-self: flex-start; }
    .aa-msg.aa-user { align-self: flex-end; }

    .aa-bubble {
      padding: 9px 13px;
      border-radius: 14px;
      font-size: 0.875rem;
      line-height: 1.55;
      word-break: break-word;
    }
    .aa-bot  .aa-bubble {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      border-bottom-left-radius: 4px;
      color: #e8eaf0;
    }
    .aa-user .aa-bubble {
      background: ${ACCENT};
      color: white;
      border-bottom-right-radius: 4px;
    }

    /* Typing indicator */
    .aa-typing .aa-bubble {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 12px 14px;
    }
    .aa-typing-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: rgba(255,255,255,0.4);
      animation: aa-bounce .9s ease-in-out infinite;
    }
    .aa-typing-dot:nth-child(2) { animation-delay: .15s; }
    .aa-typing-dot:nth-child(3) { animation-delay: .3s; }
    @keyframes aa-bounce {
      0%,80%,100% { transform: translateY(0); }
      40%          { transform: translateY(-5px); }
    }

    /* Starters */
    .aa-starters {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 14px 10px;
      flex-shrink: 0;
    }
    .aa-starter {
      padding: 6px 11px;
      border-radius: 999px;
      border: 1px solid rgba(46,125,255,0.28);
      background: rgba(46,125,255,0.07);
      color: ${ACCENT};
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      transition: background .15s, border-color .15s, transform .1s;
      white-space: nowrap;
    }
    .aa-starter:hover {
      background: rgba(46,125,255,0.15);
      border-color: rgba(46,125,255,0.5);
      transform: translateY(-1px);
    }

    /* Input row */
    .aa-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px 12px;
      border-top: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    .aa-input {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 12px;
      padding: 9px 13px;
      color: #f1f1f1;
      font-family: inherit;
      font-size: 0.875rem;
      outline: none;
      transition: border-color .15s, background .15s;
      resize: none;
      height: 40px;
      max-height: 100px;
      overflow-y: auto;
    }
    .aa-input::placeholder { color: #5a6070; }
    .aa-input:focus {
      border-color: rgba(46,125,255,0.40);
      background: rgba(255,255,255,0.07);
    }
    .aa-send {
      width: 38px; height: 38px;
      border-radius: 11px;
      background: ${ACCENT};
      border: none;
      cursor: pointer;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      transition: background .15s, transform .1s, opacity .15s;
      opacity: 0.5;
    }
    .aa-send.aa-ready { opacity: 1; }
    .aa-send:hover.aa-ready { background: #1a68e8; transform: scale(1.05); }
    .aa-send svg { width: 16px; height: 16px; }

    /* Disclaimer */
    .aa-disclaimer {
      text-align: center;
      font-size: 0.68rem;
      color: #4a5060;
      padding: 0 14px 8px;
      flex-shrink: 0;
    }

    @media (max-width: 480px) {
      #${WIDGET_ID}-window {
        bottom: 82px;
        left: 10px;
        right: 10px;
        width: calc(100vw - 20px);
        max-height: calc(100vh - 168px);
      }
      #${WIDGET_ID}-btn {
        bottom: 18px;
        left: 12px;
      }
    }
  `;
  document.head.appendChild(style);

  // ─── Build DOM ─────────────────────────────────────────────────────────────
  // Toggle button
  const btn = document.createElement("button");
  btn.id = `${WIDGET_ID}-btn`;
  btn.setAttribute("aria-label", "Open AccelAssistant chat");
  btn.innerHTML = `<span class="aa-dot" aria-hidden="true"></span> AccelAssistant`;
  document.body.appendChild(btn);

  // Chat window
  const win = document.createElement("div");
  win.id = `${WIDGET_ID}-window`;
  win.setAttribute("role", "dialog");
  win.setAttribute("aria-label", "AccelAssistant chat");
  win.innerHTML = `
    <div class="aa-header">
      <div class="aa-header-left">
        <div class="aa-avatar" aria-hidden="true">⚡</div>
        <div class="aa-header-info">
          <div class="aa-header-name">${BOT_NAME}</div>
          <div class="aa-header-sub">Accelerated Digital Solutions</div>
        </div>
      </div>
      <button class="aa-close" id="${WIDGET_ID}-close" aria-label="Close chat">✕</button>
    </div>

    <div class="aa-messages" id="${WIDGET_ID}-messages" aria-live="polite"></div>

    <div class="aa-starters" id="${WIDGET_ID}-starters"></div>

    <div class="aa-input-row">
      <textarea
        class="aa-input"
        id="${WIDGET_ID}-input"
        placeholder="Ask me anything…"
        rows="1"
        aria-label="Chat message"
      ></textarea>
      <button class="aa-send" id="${WIDGET_ID}-send" aria-label="Send message">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
    <div class="aa-disclaimer">AI responses may be imperfect — always confirm details with the ADS team.</div>
  `;
  document.body.appendChild(win);

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const messagesEl  = document.getElementById(`${WIDGET_ID}-messages`);
  const inputEl     = document.getElementById(`${WIDGET_ID}-input`);
  const sendBtn     = document.getElementById(`${WIDGET_ID}-send`);
  const closeBtn    = document.getElementById(`${WIDGET_ID}-close`);
  const startersEl  = document.getElementById(`${WIDGET_ID}-starters`);

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function setOpen(open) {
    isOpen = open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    win.classList.toggle("aa-open", open);
    if (open) {
      // Show welcome message on first open
      if (history.length === 0) showWelcome();
      setTimeout(() => inputEl.focus(), 250);
    }
  }

  function showWelcome() {
    appendMessage("bot", "Hey! I'm AccelAssistant 👋 I can answer questions about our services, coverage area, or just help you figure out what you need. What's on your mind?");
    renderStarters();
  }

  function renderStarters() {
    startersEl.innerHTML = "";
    if (history.length > 2) return; // hide after conversation starts
    STARTERS.forEach(s => {
      const chip = document.createElement("button");
      chip.className = "aa-starter";
      chip.textContent = s;
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        startersEl.innerHTML = "";
        sendMessage(s);
      });
      startersEl.appendChild(chip);
    });
  }

  function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = `aa-msg aa-${role}`;
    const bubble = document.createElement("div");
    bubble.className = "aa-bubble";
    bubble.textContent = text;
    div.appendChild(bubble);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "aa-msg aa-bot aa-typing";
    div.id = `${WIDGET_ID}-typing`;
    div.innerHTML = `<div class="aa-bubble">
      <span class="aa-typing-dot"></span>
      <span class="aa-typing-dot"></span>
      <span class="aa-typing-dot"></span>
    </div>`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeTyping() {
    document.getElementById(`${WIDGET_ID}-typing`)?.remove();
  }

  function updateSendBtn() {
    const hasText = inputEl.value.trim().length > 0;
    sendBtn.classList.toggle("aa-ready", hasText && !isLoading);
  }

  // Auto-grow textarea
  inputEl.addEventListener("input", () => {
    inputEl.style.height = "40px";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + "px";
    updateSendBtn();
  });

  // ─── Send ──────────────────────────────────────────────────────────────────
  async function sendMessage(text) {
    const trimmed = (text || inputEl.value).trim();
    if (!trimmed || isLoading) return;

    // Clear starters after first real message
    startersEl.innerHTML = "";

    inputEl.value = "";
    inputEl.style.height = "40px";
    updateSendBtn();

    appendMessage("user", trimmed);
    history.push({ role: "user", content: trimmed });

    isLoading = true;
    updateSendBtn();
    showTyping();

    try {
      const res = await fetch(API_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history, system: SYSTEM_PROMPT }),
      });

      const data = await res.json().catch(() => ({}));
      removeTyping();

      if (!res.ok || !data.reply) {
        const errMsg = "Sorry, I had trouble connecting. You can reach us at (323) 533-4872 or info@accelerateddigital.net!";
        appendMessage("bot", errMsg);
      } else {
        appendMessage("bot", data.reply);
        history.push({ role: "assistant", content: data.reply });
      }
    } catch {
      removeTyping();
      appendMessage("bot", "Network hiccup on my end! Feel free to call or text us at (323) 533-4872.");
    }

    isLoading = false;
    updateSendBtn();
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ─── Events ────────────────────────────────────────────────────────────────
  btn.addEventListener("click", () => setOpen(!isOpen));
  closeBtn.addEventListener("click", () => setOpen(false));

  sendBtn.addEventListener("click", () => sendMessage());

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) setOpen(false);
  });

  // Close if clicking outside
  document.addEventListener("click", (e) => {
    if (isOpen && !win.contains(e.target) && !btn.contains(e.target)) {
      setOpen(false);
    }
  });
})();
