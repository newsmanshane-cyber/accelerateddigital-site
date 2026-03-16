/**
 * Accelerated Digital Solutions LLC
 * Cookie Consent Banner
 * Drop this script tag into index.html just before </body>
 * <script src="cookie-consent.js" defer></script>
 *
 * Stores preference in localStorage under "ads_cookie_consent"
 * Values: "accepted" | "declined"
 * On accept  → GA4 stays active (already loaded)
 * On decline → Disables GA4 collection going forward + deletes GA cookies
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'ads_cookie_consent';
  const BANNER_ID   = 'adsCookieBanner';

  // ── Already decided? Do nothing (or apply decline if stored) ──
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'accepted') return;
  if (stored === 'declined') { applyDecline(false); return; }

  // ── Inject styles ──
  const style = document.createElement('style');
  style.textContent = `
    /* ===== Cookie Consent Banner ===== */
    #adsCookieBanner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 10000;
      padding: 0 0 env(safe-area-inset-bottom, 0);
      animation: cookieSlideUp 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    @keyframes cookieSlideUp {
      from { transform: translateY(110%); opacity: 0; }
      to   { transform: translateY(0);   opacity: 1; }
    }
    #adsCookieBanner.ads-cookie-hide {
      animation: cookieSlideDown 0.28s cubic-bezier(0.4, 0, 1, 1) forwards;
    }
    @keyframes cookieSlideDown {
      from { transform: translateY(0);   opacity: 1; }
      to   { transform: translateY(110%); opacity: 0; }
    }

    .ads-cookie-inner {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
      padding: 18px 24px;
      background: rgba(13, 15, 20, 0.97);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.45);
    }

    .ads-cookie-icon {
      flex: 0 0 auto;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: rgba(46, 125, 255, 0.12);
      border: 1px solid rgba(46, 125, 255, 0.22);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #2e7dff;
    }

    .ads-cookie-text {
      flex: 1 1 280px;
    }
    .ads-cookie-text strong {
      display: block;
      color: #f1f1f1;
      font-size: 0.93rem;
      font-weight: 700;
      margin-bottom: 3px;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    .ads-cookie-text p {
      margin: 0;
      color: #b8bcc6;
      font-size: 0.84rem;
      line-height: 1.55;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    .ads-cookie-text a {
      color: #2e7dff;
      text-decoration: none;
      border-bottom: 1px solid rgba(46, 125, 255, 0.35);
      transition: border-color 0.2s;
    }
    .ads-cookie-text a:hover {
      border-bottom-color: rgba(46, 125, 255, 0.8);
    }

    .ads-cookie-actions {
      display: flex;
      gap: 10px;
      flex-shrink: 0;
      flex-wrap: wrap;
    }

    .ads-cookie-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 20px;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 700;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      cursor: pointer;
      border: 1px solid transparent;
      transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
      white-space: nowrap;
      line-height: 1;
    }
    .ads-cookie-btn:hover  { transform: translateY(-1px); }
    .ads-cookie-btn:active { transform: translateY(0); }
    .ads-cookie-btn:focus-visible {
      outline: 2px solid #2e7dff;
      outline-offset: 3px;
    }

    .ads-cookie-accept {
      background: #2e7dff;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(46, 125, 255, 0.35);
    }
    .ads-cookie-accept:hover {
      background: #4a8fff;
      box-shadow: 0 6px 20px rgba(46, 125, 255, 0.45);
    }

    .ads-cookie-decline {
      background: rgba(255, 255, 255, 0.05);
      color: #b8bcc6;
      border-color: rgba(255, 255, 255, 0.10);
    }
    .ads-cookie-decline:hover {
      background: rgba(255, 255, 255, 0.09);
      border-color: rgba(255, 255, 255, 0.18);
      color: #f1f1f1;
    }

    /* ── Details panel (expandable) ── */
    .ads-cookie-details-toggle {
      background: none;
      border: none;
      color: #6b7280;
      font-size: 0.80rem;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
      text-underline-offset: 2px;
      transition: color 0.18s;
      flex-shrink: 0;
      align-self: center;
    }
    .ads-cookie-details-toggle:hover { color: #b8bcc6; }

    .ads-cookie-details {
      overflow: hidden;
      max-height: 0;
      transition: max-height 0.3s ease, opacity 0.25s ease;
      opacity: 0;
    }
    .ads-cookie-details.open {
      max-height: 500px;
      opacity: 1;
    }
    .ads-cookie-details-inner {
      padding: 16px 24px 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }

    .ads-cookie-category {
      background: rgba(21, 24, 31, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 12px;
      padding: 14px 16px;
    }
    .ads-cookie-category-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .ads-cookie-category-name {
      color: #f1f1f1;
      font-size: 0.88rem;
      font-weight: 700;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    .ads-cookie-badge {
      font-size: 0.72rem;
      font-weight: 700;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      padding: 3px 8px;
      border-radius: 999px;
      letter-spacing: 0.04em;
    }
    .ads-cookie-badge-required {
      background: rgba(255, 255, 255, 0.08);
      color: #6b7280;
    }
    .ads-cookie-badge-optional {
      background: rgba(46, 125, 255, 0.12);
      color: #2e7dff;
      border: 1px solid rgba(46, 125, 255, 0.2);
    }
    .ads-cookie-category p {
      margin: 0;
      color: #6b7280;
      font-size: 0.80rem;
      line-height: 1.55;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    }

    @media (max-width: 640px) {
      .ads-cookie-inner {
        padding: 16px 16px 14px;
        gap: 14px;
      }
      .ads-cookie-icon { display: none; }
      .ads-cookie-actions { width: 100%; }
      .ads-cookie-btn { flex: 1; }
      .ads-cookie-details-inner { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);

  // ── Build banner HTML ──
  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-modal', 'false');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.setAttribute('aria-live', 'polite');

  banner.innerHTML = `
    <div class="ads-cookie-inner">
      <div class="ads-cookie-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/>
          <path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/>
        </svg>
      </div>

      <div class="ads-cookie-text">
        <strong>We use cookies</strong>
        <p>
          We use essential cookies for site functionality and analytics cookies (Google Analytics) to understand how visitors use our site.
          No mobile data or SMS opt-in information is shared with third parties.
          <a href="/privacy-policy#cookies-analytics">Learn more</a>
        </p>
      </div>

      <div class="ads-cookie-actions">
        <button class="ads-cookie-btn ads-cookie-decline" id="adsCookieDecline" type="button">Decline</button>
        <button class="ads-cookie-btn ads-cookie-accept" id="adsCookieAccept" type="button">Accept All</button>
      </div>

      <button class="ads-cookie-details-toggle" id="adsCookieDetailsToggle" type="button" aria-expanded="false" aria-controls="adsCookieDetails">
        Cookie details
      </button>
    </div>

    <div class="ads-cookie-details" id="adsCookieDetails" hidden>
      <div class="ads-cookie-details-inner">
        <div class="ads-cookie-category">
          <div class="ads-cookie-category-header">
            <span class="ads-cookie-category-name">Essential</span>
            <span class="ads-cookie-badge ads-cookie-badge-required">Always on</span>
          </div>
          <p>Required for the website to function. Includes Cloudflare security cookies and session data. Cannot be disabled.</p>
        </div>
        <div class="ads-cookie-category">
          <div class="ads-cookie-category-header">
            <span class="ads-cookie-category-name">Analytics</span>
            <span class="ads-cookie-badge ads-cookie-badge-optional">Optional</span>
          </div>
          <p>Google Analytics (GA4) with IP anonymization. Helps us understand which pages are visited so we can improve the site. No personal data is sold.</p>
        </div>
        <div class="ads-cookie-category">
          <div class="ads-cookie-category-header">
            <span class="ads-cookie-category-name">SMS & Mobile</span>
            <span class="ads-cookie-badge ads-cookie-badge-required">Not collected</span>
          </div>
          <p>No mobile information or SMS opt-in data is collected via cookies or shared with any third parties for marketing purposes.</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  // ── Wire up interactions ──
  const acceptBtn  = document.getElementById('adsCookieAccept');
  const declineBtn = document.getElementById('adsCookieDecline');
  const detailsBtn = document.getElementById('adsCookieDetailsToggle');
  const detailsEl  = document.getElementById('adsCookieDetails');

  // Details toggle
  detailsBtn.addEventListener('click', function () {
    const isOpen = detailsBtn.getAttribute('aria-expanded') === 'true';
    detailsBtn.setAttribute('aria-expanded', !isOpen);
    if (isOpen) {
      detailsEl.classList.remove('open');
      setTimeout(() => { detailsEl.hidden = true; }, 300);
    } else {
      detailsEl.hidden = false;
      requestAnimationFrame(() => detailsEl.classList.add('open'));
    }
  });

  // Accept
  acceptBtn.addEventListener('click', function () {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    dismissBanner();
  });

  // Decline
  declineBtn.addEventListener('click', function () {
    localStorage.setItem(STORAGE_KEY, 'declined');
    applyDecline(true);
    dismissBanner();
  });

  // Keyboard: Escape closes banner (treats as neither accept nor decline — shows again next visit)
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape' && document.getElementById(BANNER_ID)) {
      document.removeEventListener('keydown', onKey);
      dismissBanner(false); // don't save preference — ask again next visit
    }
  });

  function dismissBanner(save) {
    const el = document.getElementById(BANNER_ID);
    if (!el) return;
    el.classList.add('ads-cookie-hide');
    setTimeout(() => { el.remove(); }, 300);
  }

  // ── GA4 opt-out ──
  function applyDecline(deleteExisting) {
    // Disable GA4 collection via the official opt-out mechanism
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied'
      });
    }
    // Set the GA opt-out property
    window['ga-disable-G-X59WX00S4E'] = true;

    // Delete existing GA cookies if the user is actively declining
    if (deleteExisting) {
      const gaCookies = document.cookie.split(';').map(c => c.trim().split('=')[0]);
      gaCookies.forEach(name => {
        if (name.startsWith('_ga') || name.startsWith('_gid') || name.startsWith('_gat')) {
          // Delete for current domain and root domain variants
          [location.hostname, '.' + location.hostname, '.accelerateddigital.net'].forEach(domain => {
            document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`;
          });
        }
      });
    }
  }

})();
