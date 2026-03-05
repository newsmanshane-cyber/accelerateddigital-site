// Replace your quote.js with this FULL file (same as before, only token line changed)
(() => {
  const $ = (id) => document.getElementById(id);

  const inputs = {
    qtyIndoor: $("qtyIndoor"),
    qtyOutdoor: $("qtyOutdoor"),
    qtyG5Bullet: $("qtyG5Bullet"),
    qtyG5Flex: $("qtyG5Flex"),
    qtyG5Turret: $("qtyG5Turret"),
    runs: $("runs"),
    consoleSelect: $("consoleSelect"),
    nvrSelect: $("nvrSelect"),
    poeSelect: $("poeSelect"),
    internetReady: $("internetReady"),
    laborTier: $("laborTier"),
    travelFee: $("travelFee"),
  };

  const quick = {
    presetSelect: $("presetSelect"),
    applyPresetBtn: $("applyPresetBtn"),
    presetHint: $("presetHint"),
    sqft: $("sqft"),
    floors: $("floors"),
    needOutdoor: $("needOutdoor"),
    applyCoverageBtn: $("applyCoverageBtn"),
    coverageResult: $("coverageResult"),
  };

  const out = {
    priceStatus: $("priceStatus"),
    grandTotal: $("grandTotal"),
    subTotals: $("subTotals"),
    breakdown: $("breakdown"),
    resetBtn: $("resetBtn"),
    copyBtn: $("copyBtn"),
  };

  const emailUI = {
    form: $("estimateEmailForm"),
    name: $("estName"),
    email: $("estEmail"),
    notes: $("estNotes"),
    status: $("estimateEmailStatus"),
    btn: $("emailEstimateBtn"),
  };

  const prices = {
    u7pro: 189,
    u6mesh: 179,
    g5bullet: 129,
    g5flex: 99,
    g5turretultra: 129,
    udmpro: 379,
    cloudkeyplus: 199,
    unvr: 299,
    usw16poe: 299,
    usw24poe: 399,
  };

  const laborModel = {
    baseStandard: 350,
    basePremium: 550,
    perDevice: 55,
    perDrop: 85,
  };

  const items = [
    { key: "u7pro", label: "U7 Pro (Indoor AP)", qty: () => n(inputs.qtyIndoor.value) },
    { key: "u6mesh", label: "U6 Mesh (Outdoor AP)", qty: () => n(inputs.qtyOutdoor.value) },
    { key: "g5bullet", label: "G5 Bullet", qty: () => n(inputs.qtyG5Bullet.value) },
    { key: "g5flex", label: "G5 Flex", qty: () => n(inputs.qtyG5Flex.value) },
    { key: "g5turretultra", label: "G5 Turret Ultra", qty: () => n(inputs.qtyG5Turret.value) },
  ];

  const keyAliases = {
    u7pro: ["u7pro", "u7Pro"],
    u6mesh: ["u6mesh", "u6Mesh"],
  };

  const presets = {
    homeSmall: { hint: "Good starting point for ~1,000–2,000 sq ft.", values: { qtyIndoor: 2, qtyOutdoor: 0, qtyG5Bullet: 0, qtyG5Flex: 0, qtyG5Turret: 0, runs: 4, consoleSelect: "udmpro", nvrSelect: "none", poeSelect: "usw16poe", laborTier: "standard", travelFee: "0", internetReady: "yes" } },
    homeLarge: { hint: "Good starting point for ~2,500–4,000 sq ft or multi-level.", values: { qtyIndoor: 4, qtyOutdoor: 1, qtyG5Bullet: 0, qtyG5Flex: 0, qtyG5Turret: 0, runs: 6, consoleSelect: "udmpro", nvrSelect: "none", poeSelect: "usw24poe", laborTier: "standard", travelFee: "0", internetReady: "yes" } },
    retail: { hint: "Great baseline for storefronts and small offices.", values: { qtyIndoor: 3, qtyOutdoor: 0, qtyG5Bullet: 0, qtyG5Flex: 0, qtyG5Turret: 0, runs: 6, consoleSelect: "udmpro", nvrSelect: "none", poeSelect: "usw16poe", laborTier: "standard", travelFee: "0", internetReady: "yes" } },
    office: { hint: "If you have conference rooms + multiple work areas.", values: { qtyIndoor: 5, qtyOutdoor: 0, qtyG5Bullet: 0, qtyG5Flex: 0, qtyG5Turret: 0, runs: 10, consoleSelect: "udmpro", nvrSelect: "none", poeSelect: "usw24poe", laborTier: "premium", travelFee: "0", internetReady: "yes" } },
    camerasOnly: { hint: "If you already have Wi-Fi handled and want cameras.", values: { qtyIndoor: 0, qtyOutdoor: 0, qtyG5Bullet: 4, qtyG5Flex: 0, qtyG5Turret: 0, runs: 6, consoleSelect: "udmpro", nvrSelect: "unvr", poeSelect: "usw16poe", laborTier: "standard", travelFee: "0", internetReady: "yes" } },
  };

  function n(v){ const x = parseInt(v || "0", 10); return Number.isFinite(x) && x > 0 ? x : 0; }
  function money(x){ const v = Math.round((x + Number.EPSILON) * 100) / 100; return v.toLocaleString(undefined, { style: "currency", currency: "USD" }); }

  function setPriceLabels(){
    document.querySelectorAll("[data-price-label]").forEach((el) => {
      const k = el.getAttribute("data-price-label");
      const p = prices[k];
      el.textContent = typeof p === "number" ? money(p) : "$—";
    });
  }

  function computeHardwareLines(){
    const lines = [];
    for (const it of items){
      const q = it.qty();
      if (!q) continue;
      const unit = prices[it.key] || 0;
      lines.push({ label: `${q}× ${it.label}`, qty: q, unit, ext: q * unit, kind: "hardware", key: it.key });
    }
    const consoleSel = inputs.consoleSelect.value;
    if (consoleSel !== "none"){ const unit = prices[consoleSel] || 0; lines.push({ label: `UniFi Console: ${consoleSel}`, qty: 1, unit, ext: unit, kind: "hardware", key: consoleSel }); }
    const nvr = inputs.nvrSelect.value;
    if (nvr !== "none"){ const unit = prices[nvr] || 0; lines.push({ label: `Recorder: UNVR`, qty: 1, unit, ext: unit, kind: "hardware", key: nvr }); }
    const poe = inputs.poeSelect.value;
    if (poe !== "none"){ const unit = prices[poe] || 0; lines.push({ label: `PoE Switch: ${poe}`, qty: 1, unit, ext: unit, kind: "hardware", key: poe }); }
    return lines;
  }

  function computeLaborLines(){
    const deviceCount = n(inputs.qtyIndoor.value)+n(inputs.qtyOutdoor.value)+n(inputs.qtyG5Bullet.value)+n(inputs.qtyG5Flex.value)+n(inputs.qtyG5Turret.value);
    const drops = n(inputs.runs.value);
    const base = inputs.laborTier.value === "premium" ? laborModel.basePremium : laborModel.baseStandard;
    const trip = parseFloat(inputs.travelFee.value || "0") || 0;

    const lines = [];
    lines.push({ label: `Install package (${inputs.laborTier.value})`, qty: 1, unit: base, ext: base, kind: "labor" });
    if (deviceCount) lines.push({ label: `Device install (${deviceCount})`, qty: deviceCount, unit: laborModel.perDevice, ext: deviceCount * laborModel.perDevice, kind: "labor" });
    if (drops) lines.push({ label: `Cat6 drops (${drops})`, qty: drops, unit: laborModel.perDrop, ext: drops * laborModel.perDrop, kind: "labor" });
    if (trip) lines.push({ label: `Trip fee`, qty: 1, unit: trip, ext: trip, kind: "labor" });
    return lines;
  }

  function getTotals(){
    const hw = computeHardwareLines();
    const labor = computeLaborLines();
    const hardwareTotal = hw.reduce((s, x) => s + x.ext, 0);
    const laborTotal = labor.reduce((s, x) => s + x.ext, 0);
    const grand = hardwareTotal + laborTotal;
    return { hw, labor, hardwareTotal, laborTotal, grand };
  }

  function render(){
    const { hw, labor, hardwareTotal, laborTotal, grand } = getTotals();
    out.grandTotal.textContent = money(grand);
    out.subTotals.textContent = `Hardware ${money(hardwareTotal)} • Labor/Wiring ${money(laborTotal)}`;

    out.breakdown.innerHTML = "";
    const addHeader = (t) => { const d = document.createElement("div"); d.className = "bd-sub"; d.textContent = t; out.breakdown.appendChild(d); };
    const addRow = (line) => {
      const row = document.createElement("div");
      row.className = "bd-row";
      row.innerHTML = `
        <div class="bd-label">${line.label}</div>
        <div class="bd-qty">${line.qty}</div>
        <div class="bd-unit">${money(line.unit)}</div>
        <div class="bd-ext">${money(line.ext)}</div>
      `;
      out.breakdown.appendChild(row);
    };

    if (hw.length){ addHeader("Hardware"); hw.forEach(addRow); }
    if (labor.length){ addHeader("Labor / Wiring"); labor.forEach(addRow); }
  }

  function extractPrice(products, key){
    const candidates = keyAliases[key] || [key];
    for (const ck of candidates){
      const v = products?.[ck];
      if (typeof v === "number") return v;
      if (v && typeof v.price === "number") return v.price;
    }
    return null;
  }

  async function loadLivePrices(){
    try{
      out.priceStatus.textContent = "Loading pricing…";
      const res = await fetch("/api/prices", { cache: "no-store" });
      if (!res.ok) throw new Error(`Prices API ${res.status}`);
      const data = await res.json();
      const p = data?.products || {};
      Object.keys(prices).forEach((k) => {
        const got = extractPrice(p, k);
        if (typeof got === "number") prices[k] = got;
      });
      setPriceLabels();
      render();
      out.priceStatus.textContent = "Pricing loaded";
    } catch(e){
      setPriceLabels();
      render();
      out.priceStatus.textContent = "Using fallback pricing";
      console.warn(e);
    }
  }

  function recommendCoverage(sqft, floors, needOutdoor){
    const area = Math.max(200, sqft || 0);
    const fl = parseInt(floors || "1", 10);

    let indoor = Math.ceil(area / 1200);
    if (fl >= 2 && area >= 1500) indoor += 1;
    if (fl >= 3) indoor += 1;

    indoor = Math.min(10, Math.max(1, indoor));
    const outdoor = needOutdoor === "yes" ? 1 : 0;
    return { indoor, outdoor };
  }

  function updateCoverageResult(){
    const sqft = parseInt(quick.sqft.value || "0", 10);
    const rec = recommendCoverage(sqft, quick.floors.value, quick.needOutdoor.value);
    quick.coverageResult.textContent = `Recommended starting point: ${rec.indoor} indoor AP(s)` + (rec.outdoor ? ` + ${rec.outdoor} outdoor AP` : "");
    return rec;
  }

  function applyPreset(id){
    const preset = presets[id];
    if (!preset) return;
    const v = preset.values;

    inputs.qtyIndoor.value = String(v.qtyIndoor);
    inputs.qtyOutdoor.value = String(v.qtyOutdoor);
    inputs.qtyG5Bullet.value = String(v.qtyG5Bullet);
    inputs.qtyG5Flex.value = String(v.qtyG5Flex);
    inputs.qtyG5Turret.value = String(v.qtyG5Turret);
    inputs.runs.value = String(v.runs);
    inputs.consoleSelect.value = v.consoleSelect;
    inputs.nvrSelect.value = v.nvrSelect;
    inputs.poeSelect.value = v.poeSelect;
    inputs.laborTier.value = v.laborTier;
    inputs.travelFee.value = v.travelFee;
    inputs.internetReady.value = v.internetReady;

    render();
  }

  function buildEstimatePayload(){
    const totals = getTotals();
    return {
      ts: new Date().toISOString(),
      selections: {
        indoor: n(inputs.qtyIndoor.value),
        outdoor: n(inputs.qtyOutdoor.value),
        g5bullet: n(inputs.qtyG5Bullet.value),
        g5flex: n(inputs.qtyG5Flex.value),
        g5turretultra: n(inputs.qtyG5Turret.value),
        drops: n(inputs.runs.value),
        console: inputs.consoleSelect.value,
        nvr: inputs.nvrSelect.value,
        poe: inputs.poeSelect.value,
        internetReady: inputs.internetReady.value,
        tier: inputs.laborTier.value,
        trip: parseFloat(inputs.travelFee.value || "0") || 0,
      },
      totals: {
        hardware: totals.hardwareTotal,
        labor: totals.laborTotal,
        grand: totals.grand,
      },
      lines: {
        hardware: totals.hw,
        labor: totals.labor,
      }
    };
  }

  async function sendEstimateEmail(e){
    e.preventDefault();

    emailUI.status.textContent = "";
    const name = (emailUI.name?.value || "").trim();
    const email = (emailUI.email?.value || "").trim();
    const notes = (emailUI.notes?.value || "").trim();

    if (!name || !email){
      emailUI.status.textContent = "Please enter name + email.";
      return;
    }

    // ✅ Read the estimate-specific token
    const token = emailUI.form["est-turnstile-response"]?.value || "";
    if (!token){
      emailUI.status.textContent = "Please complete the verification.";
      return;
    }

    emailUI.btn.disabled = true;
    emailUI.status.textContent = "Sending…";

    try{
      const estimate = buildEstimatePayload();

      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, notes, turnstileToken: token, estimate })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok){
        emailUI.status.textContent = data?.error || "Could not send. Please try again.";
        emailUI.btn.disabled = false;
        return;
      }

      emailUI.status.textContent = "Estimate sent! Check your inbox.";
      emailUI.form.reset();
      if (window.turnstile) window.turnstile.reset(); // resets all widgets
    } catch {
      emailUI.status.textContent = "Network error. Please try again.";
    } finally {
      emailUI.btn.disabled = false;
    }
  }

  function bind(){
    Object.values(inputs).forEach((el) => {
      if (!el) return;
      el.addEventListener("input", render);
      el.addEventListener("change", render);
    });

    // Presets
    quick.presetSelect?.addEventListener("change", () => {
      const id = quick.presetSelect.value;
      quick.presetHint.textContent = presets[id]?.hint || "Pick a preset to auto-fill, then tweak as needed.";
    });

    quick.applyPresetBtn?.addEventListener("click", () => {
      const id = quick.presetSelect.value;
      if (id !== "none") applyPreset(id);
    });

    // Coverage
    ["input", "change"].forEach((evt) => {
      quick.sqft?.addEventListener(evt, updateCoverageResult);
      quick.floors?.addEventListener(evt, updateCoverageResult);
      quick.needOutdoor?.addEventListener(evt, updateCoverageResult);
    });

    quick.applyCoverageBtn?.addEventListener("click", () => {
      const rec = updateCoverageResult();
      inputs.qtyIndoor.value = String(rec.indoor);
      inputs.qtyOutdoor.value = String(rec.outdoor);
      render();
    });

    out.resetBtn?.addEventListener("click", () => {
      inputs.qtyIndoor.value = "2";
      inputs.qtyOutdoor.value = "0";
      inputs.qtyG5Bullet.value = "0";
      inputs.qtyG5Flex.value = "0";
      inputs.qtyG5Turret.value = "0";
      inputs.runs.value = "4";
      inputs.consoleSelect.value = "none";
      inputs.nvrSelect.value = "none";
      inputs.poeSelect.value = "none";
      inputs.internetReady.value = "yes";
      inputs.laborTier.value = "standard";
      inputs.travelFee.value = "0";
      quick.presetSelect.value = "none";
      quick.presetHint.textContent = "Tip: “Retail” is a great starting point for most storefronts.";
      quick.sqft.value = "1800";
      quick.floors.value = "2";
      quick.needOutdoor.value = "no";
      updateCoverageResult();
      render();
    });

    out.copyBtn?.addEventListener("click", async () => {
      const totals = getTotals();
      const text = `ADS Instant Estimate\nTotal: ${money(totals.grand)}\nHardware: ${money(totals.hardwareTotal)}\nLabor/Wiring: ${money(totals.laborTotal)}\n\nDisclaimer: Estimate only.`;
      try{ await navigator.clipboard.writeText(text); out.copyBtn.textContent = "Copied!"; setTimeout(() => (out.copyBtn.textContent="Copy Estimate"), 1200); }
      catch{ window.prompt("Copy this estimate:", text); }
    });

    emailUI.form?.addEventListener("submit", sendEstimateEmail);
  }

  bind();
  setPriceLabels();
  render();
  updateCoverageResult();
  loadLivePrices();
})();
