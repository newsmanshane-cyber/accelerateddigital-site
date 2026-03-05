// quote.js
(function () {
  const $ = (id) => document.getElementById(id);

  // Inputs
  const inputs = {
    qtyIndoor: $("qtyIndoor"),
    qtyOutdoor: $("qtyOutdoor"),
    qtyG5Bullet: $("qtyG5Bullet"),
    qtyG5Flex: $("qtyG5Flex"),
    qtyG5Turret: $("qtyG5Turret"),
    nvrSelect: $("nvrSelect"),
    poeSelect: $("poeSelect"),
    runs: $("runs"),
    laborTier: $("laborTier"),
    travelFee: $("travelFee"),
  };

  // Outputs
  const els = {
    status: $("priceStatus"),
    summaryLines: $("summaryLines"),
    hardwareTotal: $("hardwareTotal"),
    laborTotal: $("laborTotal"),
    grandTotal: $("grandTotal"),
    resetBtn: $("resetBtn"),
    copyBtn: $("copyBtn"),
    estimateBlob: $("estimateBlob"),
    contactStatus: $("contactStatus"),
    contactForm: $("contactForm"),
  };

  // Default fallback pricing (USD) — used if live pricing not available
  // You can tweak these anytime.
  const fallback = {
    u7pro: 189,
    u6mesh: 179,
    g5bullet: 129,
    g5flex: 99,
    g5turretultra: 129,
    cloudkeyplus: 199,
    unvr: 299,
    usw16poe: 299,
    usw24poe: 399,
  };

  // Live price map (filled from /api/prices)
  const prices = { ...fallback };

  // Labor model (tweak as desired)
  const laborModel = {
    baseStandard: 350,
    basePremium: 550,
    perDevice: 55, // per AP/camera
    perDrop: 85,   // per Cat6 run
  };

  const products = [
    { key: "u7pro", label: "U7 Pro (Indoor AP)", qty: () => num(inputs.qtyIndoor.value) },
    { key: "u6mesh", label: "U6 Mesh (Outdoor AP)", qty: () => num(inputs.qtyOutdoor.value) },
    { key: "g5bullet", label: "G5 Bullet", qty: () => num(inputs.qtyG5Bullet.value) },
    { key: "g5flex", label: "G5 Flex", qty: () => num(inputs.qtyG5Flex.value) },
    { key: "g5turretultra", label: "G5 Turret Ultra", qty: () => num(inputs.qtyG5Turret.value) },
  ];

  function num(v) {
    const n = parseInt(v || "0", 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function money(n) {
    const x = Math.round((n + Number.EPSILON) * 100) / 100;
    return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function setPriceLabels() {
    document.querySelectorAll("[data-price-label]").forEach((el) => {
      const key = el.getAttribute("data-price-label");
      const p = prices[key];
      el.textContent = (p == null) ? "$—" : money(p);
    });
  }

  function selectedHardwareLines() {
    const lines = [];

    // APs + Cameras
    for (const p of products) {
      const q = p.qty();
      if (!q) continue;
      const unit = prices[p.key] ?? 0;
      lines.push({
        label: `${q}× ${p.label}`,
        amount: q * unit,
        kind: "hardware",
      });
    }

    // NVR
    const nvr = inputs.nvrSelect.value;
    if (nvr !== "none") {
      lines.push({
        label: `NVR: ${nvrName(nvr)}`,
        amount: (prices[nvr] ?? 0),
        kind: "hardware",
      });
    }

    // Switch
    const poe = inputs.poeSelect.value;
    if (poe !== "none") {
      lines.push({
        label: `PoE Switch: ${poeName(poe)}`,
        amount: (prices[poe] ?? 0),
        kind: "hardware",
      });
    }

    return lines;
  }

  function nvrName(v) {
    if (v === "cloudkeyplus") return "Cloud Key Gen2 Plus";
    if (v === "unvr") return "UNVR";
    return v;
  }

  function poeName(v) {
    if (v === "usw16poe") return "USW 16 PoE";
    if (v === "usw24poe") return "USW 24 PoE";
    return v;
  }

  function computeLabor() {
    const deviceCount =
      num(inputs.qtyIndoor.value) +
      num(inputs.qtyOutdoor.value) +
      num(inputs.qtyG5Bullet.value) +
      num(inputs.qtyG5Flex.value) +
      num(inputs.qtyG5Turret.value);

    const drops = num(inputs.runs.value);
    const base = (inputs.laborTier.value === "premium")
      ? laborModel.basePremium
      : laborModel.baseStandard;

    const trip = parseFloat(inputs.travelFee.value || "0") || 0;
    const labor = base + deviceCount * laborModel.perDevice + drops * laborModel.perDrop + trip;

    const lines = [];
    if (base) lines.push({ label: `Install package (${inputs.laborTier.value})`, amount: base, kind: "labor" });
    if (deviceCount) lines.push({ label: `Device install (${deviceCount} devices)`, amount: deviceCount * laborModel.perDevice, kind: "labor" });
    if (drops) lines.push({ label: `Cat6 drops (${drops})`, amount: drops * laborModel.perDrop, kind: "labor" });
    if (trip) lines.push({ label: `Trip fee`, amount: trip, kind: "labor" });

    return { labor, lines };
  }

  function render() {
    const hardwareLines = selectedHardwareLines();
    const hardwareTotal = hardwareLines.reduce((a, b) => a + b.amount, 0);

    const labor = computeLabor();
    const laborTotal = labor.lines.reduce((a, b) => a + b.amount, 0);

    const grandTotal = hardwareTotal + laborTotal;

    // Summary lines
    els.summaryLines.innerHTML = "";
    const allLines = [...hardwareLines, ...labor.lines];

    if (allLines.length === 0) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "Select items to build your estimate.";
      els.summaryLines.appendChild(empty);
    } else {
      for (const line of allLines) {
        const row = document.createElement("div");
        row.className = "summary-item";
        row.innerHTML = `<span>${escapeHtml(line.label)}</span><strong>${money(line.amount)}</strong>`;
        els.summaryLines.appendChild(row);
      }
    }

    els.hardwareTotal.textContent = money(hardwareTotal);
    els.laborTotal.textContent = money(laborTotal);
    els.grandTotal.textContent = money(grandTotal);

    // Store a compact estimate blob for the contact form hidden field
    const blob = {
      ts: new Date().toISOString(),
      pricing: { ...prices },
      selections: {
        indoor: num(inputs.qtyIndoor.value),
        outdoor: num(inputs.qtyOutdoor.value),
        g5bullet: num(inputs.qtyG5Bullet.value),
        g5flex: num(inputs.qtyG5Flex.value),
        g5turretultra: num(inputs.qtyG5Turret.value),
        nvr: inputs.nvrSelect.value,
        poe: inputs.poeSelect.value,
        drops: num(inputs.runs.value),
        tier: inputs.laborTier.value,
        trip: parseFloat(inputs.travelFee.value || "0") || 0,
      },
      totals: { hardwareTotal, laborTotal, grandTotal },
      disclaimer:
        "Estimate only. Final pricing depends on site conditions, taxes/shipping, and availability.",
    };

    if (els.estimateBlob) els.estimateBlob.value = JSON.stringify(blob);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadLivePrices() {
    try {
      els.status.textContent = "Loading live pricing…";

      const res = await fetch("/api/prices", { cache: "no-store" });
      if (!res.ok) throw new Error(`Prices API error: ${res.status}`);

      const data = await res.json();

      // Expected structure: { products: { key: { price } } } or { products: { key: price } }
      const p = data?.products || {};

      // Support either {key:{price}} or {key:price}
      for (const key of Object.keys(prices)) {
        const v = p[key];
        if (typeof v === "number") prices[key] = v;
        if (v && typeof v.price === "number") prices[key] = v.price;
      }

      setPriceLabels();
      render();

      els.status.textContent = "Live pricing loaded";
    } catch (e) {
      // Keep fallback prices
      setPriceLabels();
      render();
      els.status.textContent = "Using fallback pricing (live unavailable)";
      console.warn(e);
    }
  }

  function bind() {
    Object.values(inputs).forEach((el) => {
      if (!el) return;
      el.addEventListener("input", render);
      el.addEventListener("change", render);
    });

    els.resetBtn?.addEventListener("click", () => {
      inputs.qtyIndoor.value = "2";
      inputs.qtyOutdoor.value = "0";
      inputs.qtyG5Bullet.value = "0";
      inputs.qtyG5Flex.value = "0";
      inputs.qtyG5Turret.value = "0";
      inputs.nvrSelect.value = "none";
      inputs.poeSelect.value = "none";
      inputs.runs.value = "4";
      inputs.laborTier.value = "standard";
      inputs.travelFee.value = "0";
      render();
    });

    els.copyBtn?.addEventListener("click", async () => {
      const text =
`Accelerated Digital Solutions – Instant Estimate

Hardware: ${els.hardwareTotal.textContent}
Labor/Wiring: ${els.laborTotal.textContent}
Total: ${els.grandTotal.textContent}

Selections:
${(els.estimateBlob?.value ? els.estimateBlob.value : "")}

Disclaimer: Estimate only. Final pricing depends on site conditions, taxes/shipping, and availability.`;

      try {
        await navigator.clipboard.writeText(text);
        els.copyBtn.textContent = "Copied!";
        setTimeout(() => (els.copyBtn.textContent = "Copy estimate"), 1200);
      } catch {
        // Fallback: prompt
        window.prompt("Copy this estimate:", text);
      }
    });
  }

  // Init
  bind();
  setPriceLabels();
  render();
  loadLivePrices();
})();
