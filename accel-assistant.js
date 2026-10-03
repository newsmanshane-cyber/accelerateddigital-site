(() => {
  // ─── Config ────────────────────────────────────────────────────────────────
  const BOT_NAME  = "AccelAssistant";
  const API_PATH  = "/api/chat";
  const ACCENT    = "#2e7dff";
  const WIDGET_ID = "accel-assistant";

  const SYSTEM_PROMPT = `You are AccelAssistant, a friendly and knowledgeable helper for Accelerated Digital Solutions LLC (ADS) — a Los Angeles-based IT infrastructure and software development company.

Your role is to help website visitors understand what ADS does, answer general questions, and guide people toward reaching out when ready.

About ADS:
- IT infrastructure: network design (routing, switching, VLANs, firewalls), enterprise Wi-Fi, structured cabling, IP cameras and secure remote access, workstation/server/office IT setup and support, production and streaming networks
- Software development: web applications, dashboards and client portals; native iPhone and iPad apps; device software for Windows, macOS and Android; APIs, integrations and real-time systems; cloud hosting, Linux servers, deployment and backups; privacy-first design for regulated work such as healthcare
- Based in Los Angeles; infrastructure work is on-site across Greater Los Angeles, software work can be remote
- Contact: the contact form on the homepage, or email info@accelerateddigital.net. ADS does not currently list a phone number — never give one out.

About ClearPath Monitoring (ADS's own product — details at /clearpath):
- A patient-monitoring platform for substance use disorder treatment programs and sober living homes: residential/detox, PHP and outpatient programs, sober living homes, and the clinicians and case managers who serve them
- Staff dashboard (web, plus the ClearPath Dashboard app for iPhone and iPad in beta) and a ClearPath app on the patient's own device
- Features: location and geofencing alerts, web filtering and app restrictions, tamper and protection-status alerts, secure messaging and unrecorded voice/video calls with the care team, a patient journal, schedules, sober living house tools (house chat, chores, outing sign-outs, curfew requests)
- Patient app status: iPhone and iPad in beta; Windows and Mac in development; Android coming soon
- Honest framing: ClearPath offers accountability, not prevention — no software can stop a determined person on their own device, but with ClearPath they cannot get around it quietly
- Privacy: designed with HIPAA and 42 CFR Part 2 in mind; the treatment facility holds the records; every view of a patient's information is audited. Full policy: clearpathmonitoring.com/privacy
- ClearPath inquiries: the form on the /clearpath page, or support@clearpathmonitoring.com
- If someone says they are a patient, tell them to contact their treatment facility first — the facility holds their records. Never ask for or discuss anyone's health information.

Tone & behavior guidelines:
- Be helpful, honest, and conversational — never pushy or salesy
- Ask a clarifying question when it helps (what are they building? office or home? what kind of program?)
- Never promise specific outcomes, timelines, prices, or compliance certifications
- If someone seems ready to move forward, mention the contact form or the right email address
- Keep responses concise — 2–4 sentences
- Never make up specs, prices, features, or claims you're not sure about`;

  const STARTERS = [
    "What does ADS do?",
    "Can you build a custom app for us?",
    "What is ClearPath Monitoring?",
    "Do you set up office networks?",
  ];

  // ─── State ─────────────────────────────────────────────────────────────────
  let isOpen     = false;
  let isLoading  = false;
  let history    = [];
  let nudgeShown = false;
  let nudgeTimer = null;
  let nudgeEl    = null;

  // ─── Styles ────────────────────────────────────────────────────────────────
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

    #${WIDGET_ID}-nudge {
      position: fixed;
      bottom: 74px;
      left: 18px;
      z-index: 1200;
      max-width: 240px;
      background: rgba(14,17,22,0.97);
      border: 1px solid rgba(46,125,255,0.35);
      border-radius: 14px 14px 14px 4px;
      padding: 11px 14px;
      font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
      font-size: 0.82rem;
      color: #e8eaf0;
      line-height: 1.5;
      backdrop-filter: blur(14px);
      box-shadow: 0 8px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(46,125,255,0.08);
      cursor: pointer;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity .28s ease, transform .28s ease;
      pointer-events: none;
    }
    #${WIDGET_ID}-nudge.aa-nudge-visible {
      opacity: 1;
      transform: translateY(0);
      pointer-events: all;
    }
    #${WIDGET_ID}-nudge-dismiss {
      display: inline-block;
      margin-left: 8px;
      opacity: 0.45;
      font-size: 0.72rem;
      line-height: 1;
      vertical-align: middle;
    }
    #${WIDGET_ID}-nudge-dismiss:hover { opacity: 1; }

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

    .aa-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      background: rgba(255,255,255,0.025);
      flex-shrink: 0;
    }
    .aa-header-left { display: flex; align-items: center; gap: 10px; }
    .aa-avatar {
      width: 34px; height: 34px; border-radius: 10px;
      background: linear-gradient(135deg, ${ACCENT}, #1a56cc);
      display: grid; place-items: center; flex-shrink: 0; font-size: 15px;
    }
    .aa-header-info { display: flex; flex-direction: column; gap: 1px; }
    .aa-header-name { font-size: 0.9rem; font-weight: 700; letter-spacing: -0.01em; }
    .aa-header-sub  { font-size: 0.72rem; color: #8a909e; }
    .aa-close {
      width: 30px; height: 30px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.04);
      color: #8a909e; cursor: pointer;
      display: grid; place-items: center;
      transition: background .15s, color .15s;
      font-size: 16px; flex-shrink: 0;
    }
    .aa-close:hover { background: rgba(255,255,255,0.09); color: #f1f1f1; }

    .aa-messages {
      flex: 1; overflow-y: auto;
      padding: 14px 14px 8px;
      display: flex; flex-direction: column; gap: 10px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .aa-messages::-webkit-scrollbar { width: 4px; }
    .aa-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 4px; }

    .aa-msg {
      display: flex; flex-direction: column;
      max-width: 88%; gap: 3px;
      animation: aa-msgIn .2s ease;
    }
    @keyframes aa-msgIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .aa-msg.aa-bot  { align-self: flex-start; }
    .aa-msg.aa-user { align-self: flex-end; }

    .aa-bubble {
      padding: 9px 13px; border-radius: 14px;
      font-size: 0.875rem; line-height: 1.55; word-break: break-word;
    }
    .aa-bot .aa-bubble {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      border-bottom-left-radius: 4px; color: #e8eaf0;
    }
    .aa-user .aa-bubble {
      background: ${ACCENT}; color: white;
      border-bottom-right-radius: 4px;
    }

    .aa-typing .aa-bubble { display: flex; align-items: center; gap: 5px; padding: 12px 14px; }
    .aa-typing-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: rgba(255,255,255,0.4);
      animation: aa-bounce .9s ease-in-out infinite;
    }
    .aa-typing-dot:nth-child(2) { animation-delay: .15s; }
    .aa-typing-dot:nth-child(3) { animation-delay: .3s; }
    @keyframes aa-bounce {
      0%,80%,100% { transform: translateY(0); }
      40%          { transform: translateY(-5px); }
    }

    .aa-starters { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 10px; flex-shrink: 0; }
    .aa-starter {
      padding: 6px 11px; border-radius: 999px;
      border: 1px solid rgba(46,125,255,0.28);
      background: rgba(46,125,255,0.07);
      color: ${ACCENT}; font-size: 0.78rem; font-weight: 600;
      cursor: pointer;
      transition: background .15s, border-color .15s, transform .1s;
      white-space: nowrap;
    }
    .aa-starter:hover {
      background: rgba(46,125,255,0.15); border-color: rgba(46,125,255,0.5);
      transform: translateY(-1px);
    }

    .aa-input-row {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px 12px;
      border-top: 1px solid rgba(255,255,255,0.07); flex-shrink: 0;
    }
    .aa-input {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 12px; padding: 9px 13px;
      color: #f1f1f1; font-family: inherit; font-size: 0.875rem;
      outline: none; transition: border-color .15s, background .15s;
      resize: none; height: 40px; max-height: 100px; overflow-y: auto;
    }
    .aa-input::placeholder { color: #5a6070; }
    .aa-input:focus { border-color: rgba(46,125,255,0.40); background: rgba(255,255,255,0.07); }
    .aa-send {
      width: 38px; height: 38px; border-radius: 11px;
      background: ${ACCENT}; border: none; cursor: pointer;
      display: grid; place-items: center; flex-shrink: 0;
      transition: background .15s, transform .1s, opacity .15s;
      opacity: 0.5;
    }
    .aa-send.aa-ready { opacity: 1; }
    .aa-send:hover.aa-ready { background: #1a68e8; transform: scale(1.05); }
    .aa-send svg { width: 16px; height: 16px; }

    .aa-disclaimer { text-align: center; font-size: 0.68rem; color: #4a5060; padding: 0 14px 8px; flex-shrink: 0; }

    @media (max-width: 480px) {
      #${WIDGET_ID}-window { bottom: 82px; left: 10px; right: 10px; width: calc(100vw - 20px); max-height: calc(100vh - 168px); }
      #${WIDGET_ID}-btn { bottom: 18px; left: 12px; }
      #${WIDGET_ID}-nudge { left: 12px; max-width: calc(100vw - 80px); }
    }
  `;
  document.head.appendChild(style);

  // ─── Build DOM ─────────────────────────────────────────────────────────────
  const btn = document.createElement("button");
  btn.id = `${WIDGET_ID}-btn`;
  btn.setAttribute("aria-label", "Open AccelAssistant chat");
  btn.innerHTML = `<span class="aa-dot" aria-hidden="true"></span> AccelAssistant`;
  document.body.appendChild(btn);

  nudgeEl = document.createElement("div");
  nudgeEl.id = `${WIDGET_ID}-nudge`;
  nudgeEl.innerHTML = `👋 Questions about our services or ClearPath? Ask me! <span id="${WIDGET_ID}-nudge-dismiss">✕</span>`;
  document.body.appendChild(nudgeEl);

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
      <textarea class="aa-input" id="${WIDGET_ID}-input" placeholder="Ask me anything…" rows="1" aria-label="Chat message"></textarea>
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
  const messagesEl   = document.getElementById(`${WIDGET_ID}-messages`);
  const inputEl      = document.getElementById(`${WIDGET_ID}-input`);
  const sendBtn      = document.getElementById(`${WIDGET_ID}-send`);
  const closeBtn     = document.getElementById(`${WIDGET_ID}-close`);
  const startersEl   = document.getElementById(`${WIDGET_ID}-starters`);
  const nudgeDismiss = document.getElementById(`${WIDGET_ID}-nudge-dismiss`);

  // ─── Nudge ─────────────────────────────────────────────────────────────────
  function showNudge() {
    if (nudgeShown || isOpen) return;
    nudgeShown = true;
    nudgeEl.classList.add("aa-nudge-visible");
    nudgeTimer = setTimeout(hideNudge, 8000);
  }

  function hideNudge() {
    clearTimeout(nudgeTimer);
    nudgeEl.classList.remove("aa-nudge-visible");
  }

  nudgeEl.addEventListener("click", (e) => {
    e.stopPropagation();
    if (e.target.id === `${WIDGET_ID}-nudge-dismiss`) {
      hideNudge();
      return;
    }
    hideNudge();
    setOpen(true, true);
  });

  nudgeDismiss.addEventListener("click", (e) => {
    e.stopPropagation();
    hideNudge();
  });

  // ─── Watch estimate toggle ─────────────────────────────────────────────────
  function watchEstimateToggle() {
    const estimateBtn = document.getElementById("estimateToggle");
    if (!estimateBtn) return;
    estimateBtn.addEventListener("click", () => {
      setTimeout(() => {
        const expanded = estimateBtn.getAttribute("aria-expanded") === "true";
        if (expanded && !isOpen) {
          setTimeout(showNudge, 1200);
        } else {
          hideNudge();
        }
      }, 50);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchEstimateToggle);
  } else {
    watchEstimateToggle();
  }

  // ─── Open / close ──────────────────────────────────────────────────────────
  function setOpen(open, estimateContext = false) {
    isOpen = open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    win.classList.toggle("aa-open", open);
    if (open) {
      hideNudge();
      if (history.length === 0) {
        estimateContext ? showEstimateWelcome() : showWelcome();
      }
      setTimeout(() => inputEl.focus(), 250);
    }
  }

  function showWelcome() {
    appendMessage("bot", "Hey! I'm AccelAssistant 👋 I can answer questions about our IT and software services or ClearPath Monitoring, and help you figure out what you need. What's on your mind?");
    renderStarters();
  }

  function showEstimateWelcome() {
    appendMessage("bot", "Hey! 👋 I saw you opened the Instant Estimate tool — great, I can walk you through it! First question: is this for a home, a business, or something else like a production space?");
  }

  function renderStarters() {
    startersEl.innerHTML = "";
    if (history.length > 2) return;
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
    div.innerHTML = `<div class="aa-bubble"><span class="aa-typing-dot"></span><span class="aa-typing-dot"></span><span class="aa-typing-dot"></span></div>`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeTyping() {
    document.getElementById(`${WIDGET_ID}-typing`)?.remove();
  }

  function updateSendBtn() {
    sendBtn.classList.toggle("aa-ready", inputEl.value.trim().length > 0 && !isLoading);
  }

  inputEl.addEventListener("input", () => {
    inputEl.style.height = "40px";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + "px";
    updateSendBtn();
  });

  // ─── Send ──────────────────────────────────────────────────────────────────
  async function sendMessage(text) {
    const trimmed = (text || inputEl.value).trim();
    if (!trimmed || isLoading) return;

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
        appendMessage("bot", "Sorry, I had trouble connecting. You can reach us through the contact form or at info@accelerateddigital.net!");
      } else {
        appendMessage("bot", data.reply);
        history.push({ role: "assistant", content: data.reply });
      }
    } catch {
      removeTyping();
      appendMessage("bot", "Network hiccup on my end! Feel free to use the contact form or email info@accelerateddigital.net.");
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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) setOpen(false);
  });

  document.addEventListener("click", (e) => {
    if (isOpen && !win.contains(e.target) && !btn.contains(e.target) && !nudgeEl.contains(e.target)) {
      setOpen(false);
    }
  });
})();
