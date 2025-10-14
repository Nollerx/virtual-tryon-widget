(function () {
  console.log('Widget loader starting...');
  
  // TODO: set to your CDN origin that serves widget.html + assets
  const WIDGET_BASE_URL = "https://nollerx.github.io/virtual-tryon-widget"; 
  const ALLOWED_ORIGIN = new URL(WIDGET_BASE_URL).origin;
  
  console.log('WIDGET_BASE_URL:', WIDGET_BASE_URL);
  console.log('ALLOWED_ORIGIN:', ALLOWED_ORIGIN);

  // Read attributes from the embedding script tag
  const scriptTag = document.currentScript;
  const storeId = scriptTag?.dataset?.storeId || "demo-store";
  const storeName = scriptTag?.dataset?.storeName || "Demo Store";
  const theme = {
    primary: scriptTag?.dataset?.primary || "#111827",
    accent: scriptTag?.dataset?.accent || "#6EE7B7"
  };
  // NEW: Shopify creds from the embed tag
const shopDomain = scriptTag?.dataset?.shopDomain || "";
const storefrontToken = scriptTag?.dataset?.storefrontToken || "";
  console.log('Store config:', { storeId, storeName, theme });
  if (!shopDomain) console.warn('[Ello] Missing data-shop-domain on embed tag.');
  if (!storefrontToken) console.warn('[Ello] Missing data-storefront-token on embed tag.');

  // Detect current Shopify product on parent page
  function detectCurrentShopifyProduct() {
    try {
      // /products/<handle>?variant=ID (canonical on Shopify)
      const m = location.pathname.match(/\/products\/([^\/\?]+)/);
      const handle = m ? decodeURIComponent(m[1]) 
                       : (window.ShopifyAnalytics?.meta?.product?.handle || null);

      const variantId = new URLSearchParams(location.search).get('variant')
                     || window.ShopifyAnalytics?.meta?.selectedVariantId
                     || null;

      // Nice-to-have (not required)
      const title   = window.ShopifyAnalytics?.meta?.product?.title
                   || document.querySelector('meta[property="og:title"]')?.content
                   || null;
      const ogImage = document.querySelector('meta[property="og:image"]')?.content || null;
      const url     = document.querySelector('meta[property="og:url"]')?.content || location.href;

      if (handle) return { handle, variantId, title, ogImage, url };
    } catch(_) {}
    return null;
  }
  const currentProduct = detectCurrentShopifyProduct();

  // 1) Container
  const container = document.createElement('div');
  container.id = 'ello-container';
  Object.assign(container.style, {
    position: 'fixed',
    right: '24px',
    bottom: '24px',
    zIndex: '2147483647'
  });
  document.body.appendChild(container);

  // 2) Iframe
  const frame = document.createElement('iframe');
  frame.id = 'ello-frame';
 const params = new URLSearchParams({
  store_id: storeId, store_name: storeName, primary: theme.primary, accent: theme.accent,
  shopDomain
 });
  frame.src = `${WIDGET_BASE_URL}/widget.html?${params.toString()}`;
  frame.allow = 'fullscreen; camera; microphone';
frame.setAttribute('allowfullscreen', '');
frame.title = 'Ello Virtual Try-On'; // a11y
  frame.sandbox = 'allow-scripts allow-forms allow-same-origin allow-popups';
  frame.loading = 'eager';
  frame.style.cssText = `
  width:64px;height:64px;border:0;outline:none;border-radius:12px;z-index:2147483646;
  box-shadow:none;
  background:transparent;display:block;
  opacity:0;visibility:hidden;transform:translateZ(0) scale(.98);
  transition:opacity .18s ease, transform .18s ease, box-shadow .18s ease, border-radius .18s ease;
`;
  // --- 0) Scrim (unchanged if you already added it) ---
  const scrim = document.createElement('div');
  Object.assign(scrim.style, {
    position: 'fixed', inset: '0', background: 'rgba(0,0,0,.12)',
    opacity: '0', pointerEvents: 'none',
    transition: 'opacity .22s ease',
    zIndex: '2147483645'
  });
  document.body.appendChild(scrim);

  // --- 1) Frame baseline: constant overlay size + smooth transitions ---
  frame.style.position = 'absolute';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.transformOrigin = 'bottom right';
  frame.style.opacity = '0';
  frame.style.visibility = 'hidden';
  frame.style.border = '0';
  frame.style.outline = 'none';
  frame.style.background = 'transparent';
  frame.style.boxShadow = 'none';
  frame.style.borderRadius = '16px';
  frame.style.willChange = 'clip-path, transform, opacity, box-shadow';

  frame.style.transition = [
    'opacity .18s ease',
    'transform .28s cubic-bezier(.16,1,.3,1)',
    'box-shadow .28s ease',
    'clip-path .28s cubic-bezier(.16,1,.3,1)'
  ].join(', ');
  frame.setAttribute('tabindex', '-1');
  container.appendChild(frame);
  
  // --- 2) Helper: compute overlay size once per state (and on resize) ---
  function overlaySize() {
    const isMobile = matchMedia('(max-width:768px)').matches;
    const w = isMobile ? Math.floor(innerWidth * 0.92) : 420;
    const h = isMobile ? Math.floor(innerHeight * 0.78) : 650;
    return { w, h };
  }

  function applyOverlaySize() {
    const { w, h } = overlaySize();
    frame.style.width = w + 'px';
    frame.style.height = h + 'px';
    frame.dataset.ow = String(w);
    frame.dataset.oh = String(h);
  }
  applyOverlaySize();
  addEventListener('resize', () => {
    const wasOpen = document.documentElement.classList.contains('ello-open');
    applyOverlaySize();
    // re-apply clip for dock if closed
    if (!wasOpen) dockClip();
  });

  // --- 3) Dock = clip to a 64x64 window at bottom-right (no size animation) ---
  function dockClip() {
    const w = +frame.dataset.ow || 420;
    const h = +frame.dataset.oh || 650;
    // crop everything except a 64x64 square at bottom-right
    frame.style.clipPath = `inset(${Math.max(h - 64, 0)}px 0 0 ${Math.max(w - 64, 0)}px round 12px)`;
    frame.style.boxShadow = 'none';
    frame.style.transform = 'translateZ(0) scale(1)'; // stable
  }

  // --- 4) Open/Close with GPU-friendly changes only ---
  function showFrame() {
    frame.style.opacity = '1';
    frame.style.visibility = 'visible';
  }

  function expandToOverlay() {
    document.documentElement.classList.add('ello-open');
    scrim.style.pointerEvents = 'auto';
    scrim.style.opacity = '1';

    // micro-pop to emphasize origin (doesn't trigger layout)
    frame.style.transform = 'scale(0.985) translateZ(0)';
    requestAnimationFrame(() => {
      frame.style.clipPath = 'inset(0 0 0 0 round 16px)';
      frame.style.boxShadow = '0 20px 60px rgba(0,0,0,.25)';
      frame.style.transform = 'scale(1) translateZ(0)';
    });
  }
  function collapseToDock() {
    document.documentElement.classList.remove('ello-open');
    scrim.style.opacity = '0';
    scrim.style.pointerEvents = 'none';

    requestAnimationFrame(() => {
      dockClip();
      frame.style.boxShadow = 'none';
      frame.style.transform = 'scale(1) translateZ(0)';
    });
  }
  
  // --- 5) On READY, show + dock (no layout animation) ---
  window.addEventListener('message', (e) => {
    console.log('Parent received message:', e.data, 'from origin:', e.origin);
    if (!e.origin || e.origin !== ALLOWED_ORIGIN) {
      console.log('Origin mismatch. Expected:', ALLOWED_ORIGIN, 'Got:', e.origin);
      return;
    }
    const msg = e.data || {};
    switch (msg.type) {
      case 'ELLO_READY':
        console.log('Widget ready, showing frame');
        showFrame();
        dockClip();
        // send config right after ready (keep your payload)
        frame.contentWindow?.postMessage({
          type: 'ELLO_CONFIG',
          payload: { storeId, storeName, theme, shopDomain, storefrontToken, currentProduct }
        }, ALLOWED_ORIGIN);
        break;
      case 'ELLO_OPEN_PANEL':
        expandToOverlay();
        break;
      case 'ELLO_CLOSE_PANEL':
        collapseToDock();
        break;
      case 'ELLO_REQUEST_FULLSCREEN':
        frame.requestFullscreen?.();
        break;
      case 'ELLO_SIZE':
        if (msg.payload?.height) {
          frame.style.height = Math.min(msg.payload.height, window.innerHeight) + 'px';
        }
        break;
      case 'ELLO_GET_CONFIG':
        // iFrame requested config on load
        frame.contentWindow?.postMessage({
          type: 'ELLO_CONFIG',
          payload: { storeId, storeName, theme, shopDomain, storefrontToken, currentProduct }
        }, ALLOWED_ORIGIN);
        break;
      default:
        // ignore
        break;
    }
  });

  // --- 6) Fallback still OK, but use the new paths ---
  setTimeout(() => {
    if (frame.style.opacity === '0') {
      showFrame();
      dockClip();
    }
  }, 3000);

  // Respect reduced motion
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    frame.style.transition = 'none';
    scrim.style.transition = 'none';
  }

  // 5) Proactively send config after load (in case handshake races)
  frame.addEventListener('load', () => {
    console.log('Iframe loaded, sending config...');
    console.log('Frame src:', frame.src);
    console.log('Frame contentWindow:', frame.contentWindow);
    frame.contentWindow?.postMessage({
      type: 'ELLO_CONFIG',
      payload: { storeId, storeName, theme, shopDomain, storefrontToken, currentProduct }
    }, ALLOWED_ORIGIN);
    console.log('Config sent to iframe');
  });
  
  // Add error handling for iframe
  frame.addEventListener('error', (e) => {
    console.error('Iframe error:', e);
  });
})();
