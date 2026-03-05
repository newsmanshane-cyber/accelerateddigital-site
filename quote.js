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

  const out = {
    priceStatus: $("priceStatus"),
    grandTotal: $("grandTotal"),
    subTotals: $("subTotals"),
    breakdown: $("breakdown"),
    resetBtn: $("resetBtn"),
    copyBtn: $("copyBtn"),
  };

  // Fallback prices (USD)
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

  // Simple labor model (tweak anytime)
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

  // Alias support in case API ever returns camelCase only
  const keyAliases = {
    u7pro: ["u7pro", "u7Pro"],
    u6mesh: ["u6mesh", "u6Mesh"],
  };

  function n(v) {
    const x = parseInt(v || "0", 10);
    return Number.isFinite(x) && x > 0 ? x : 0;
  }

  function money(x) {
    const v = Math.round((x + Number.EPSILON) * 100) / 100;
    return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setPriceLabels() {
    document.querySelectorAll("[data-price-label]").forEach((el) => {
      const k = el.getAttribute("data-price-label");
      const p = prices[k];
      el.textContent = typeof p === "number" ? money(p) : "$—";
    });
  }

  function consoleName(v) {
    if (v === "udmpro") return "Dream Machine Pro (UDM Pro)";
    if (v === "cloudkeyplus") return "Cloud Key Gen2 Plus";
    return v;
  }

  function poeName(v) {
    if (v === "usw16poe") return "USW 16 PoE";
    if (v === "usw24poe") return "USW 24 PoE";
    return v;
  }

  function computeHardwareLines() {
    const lines = [];

    for (const it of items) {
      const q = it.qty();
      if (!q) continue;
      const unit = prices[it.key] || 0;
      lines.push({ label: `${q}× ${it.label}`, qty: q, unit, ext: q * unit, kind: "hardware" });
    }

    const consoleSel = inputs.consoleSelect.value;
    if (consoleSel !== "none") {
      const unit = prices[consoleSel] || 0;
      lines.push({ label: `UniFi Console: ${consoleName(consoleSel)}`, qty: 1, unit, ext: unit, kind: "hardware" });
    }

    const nvr = inputs.nvrSelect.value;
    if (nvr !== "none") {
      const unit = prices[nvr] || 0;
      lines.push({ label: `Recorder: UNVR`, qty: 1, unit, ext: unit, kind: "hardware" });
    }

    const poe = inputs.poeSelect.value;
    if (poe !== "none") {
      const unit = prices[poe] || 0;
      lines.push({ label: `PoE Switch: ${poeName(poe)}`, qty: 1, unit, ext: unit, kind: "hardware" });
    }

    return lines;
  }

  function computeLaborLines() {
    const deviceCount =
      n(inputs.qtyIndoor.value) +
      n(inputs.qtyOutdoor.value) +
      n(inputs.qtyG5Bullet.value) +
      n(inputs.qtyG5Flex.value) +
      n(inputs.qtyG5Turret.value);

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

  function render() {
    const hw = computeHardwareLines();
    const labor = computeLaborLines();

    const hardwareTotal = hw.reduce((s, x) => s + x.ext, 0);
    const laborTotal = labor.reduce((s, x) => s + x.ext, 0);
    const grand = hardwareTotal + laborTotal;

    out.grandTotal.textContent = money(grand);
    out.subTotals.textContent = `Hardware ${money(hardwareTotal)} • Labor/Wiring ${money(laborTotal)}`;

    out.breakdown.innerHTML = "";

    const addHeader = (text) => {
      const div = document.createElement("div");
      div.className = "bd-sub";
      div.textContent = text;
      out.breakdown.appendChild(div);
    };

    const addRow = (line) => {
      const row = document.createElement("div");
      row.className = "bd-row";
      row.innerHTML = `
        <div class="bd-label">${escapeHtml(line.label)}</div>
        <div class="bd-qty">${line.qty}</div>
        <div class="bd-unit">${money(line.unit)}</div>
        <div class="bd-ext">${money(line.ext)}</div>
      `;
      out.breakdown.appendChild(row);
    };

    if (hw.length) {
      addHeader("Hardware");
      hw.forEach(addRow);
    }

    if (labor.length) {
      addHeader("Labor / Wiring");
      labor.forEach(addRow);
    }

    if (!hw.length && !labor.length) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "Select quantities to build an estimate.";
      out.breakdown.appendChild(empty);
    }
  }

  function extractPrice(products, key) {
    const candidates = keyAliases[key] || [key];

    for (const ck of candidates) {
      const v = products?.[ck];
      if (typeof v === "number") return v;
      if (v && typeof v.price === "number") return v.price;
    }
    return null;
  }

  async function loadLivePrices() {
    try {
      out.priceStatus.textContent = "Loading live pricing…";
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
    } catch (e) {
      setPriceLabels();
      render();
      out.priceStatus.textContent = "Using fallback pricing";
      console.warn(e);
    }
  }

  function bind() {
    Object.values(inputs).forEach((el) => {
      if (!el) return;
      el.addEventListener("input", render);
      el.addEventListener("change", render);
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
      render();
    });

    out.copyBtn?.addEventListener("click", async () => {
      const text = `ADS Instant Estimate
Total: ${out.grandTotal.textContent}
${out.subTotals.textContent}

Disclaimer: Estimate only. Final pricing depends on site conditions, taxes/shipping, and availability.`;

      try {
        await navigator.clipboard.writeText(text);
        out.copyBtn.textContent = "Copied!";
        setTimeout(() => (out.copyBtn.textContent = "Copy Estimate"), 1200);
      } catch {
        window.prompt("Copy this estimate:", text);
      }
    });
  }

  bind();
  setPriceLabels();
  render();
  loadLivePrices();
})();
