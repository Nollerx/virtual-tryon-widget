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
  frame.style.position = 'absolute';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.transformOrigin = 'bottom right';

  // Upgrade iframe's transition (buttery smooth)
  frame.style.transition = [
    'opacity .18s ease',
    'transform .24s cubic-bezier(.16,1,.3,1)',   // springy
    'box-shadow .24s ease',
    'border-radius .24s ease',
    'width .26s cubic-bezier(.2,.8,.2,1)',
    'height .26s cubic-bezier(.2,.8,.2,1)'
  ].join(', ');
  frame.setAttribute('tabindex', '-1');
  container.appendChild(frame);
  
  // Scrim (modal backdrop)
  const scrim = document.createElement('div');
  Object.assign(scrim.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0,0,0,.12)',
    opacity: '0',
    pointerEvents: 'none',
    transition: 'opacity .18s ease',
    zIndex: '2147483645' // just under the iframe
  });
  document.body.appendChild(scrim);

  // Small perf hint helpers
  const enablePerfHints = () => { frame.style.willChange = 'width,height,transform'; };
  const disablePerfHints = () => { frame.style.willChange = ''; };
  
  // Respect reduced motion (optional but pro)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    frame.style.transition = 'none';
    scrim.style.transition = 'none';
  }
  
  console.log('Iframe created with src:', frame.src);
  console.log('Container added to DOM:', container);

  function expandToOverlay() {
    const isMobile = window.matchMedia('(max-width:768px)').matches;
    enablePerfHints();

    // Fade in scrim
    scrim.style.pointerEvents = 'auto';
    scrim.style.opacity = '1';

    // micro-pop to emphasize bottom-right origin
    frame.style.transform = 'scale(0.985) translateZ(0)';

    // Ensure transition kicks in cleanly
    requestAnimationFrame(() => {
      Object.assign(frame.style, {
        width:  isMobile ? '92vw' : '420px',
        height: isMobile ? '78vh' : '650px',
        borderRadius: isMobile ? '12px' : '16px',
        boxShadow: '0 12px 40px rgba(0,0,0,.22)',
        transform: 'scale(1) translateZ(0)'
      });
      setTimeout(disablePerfHints, 350);
    });
  }
// Re-apply panel size if viewport changes while open
 window.addEventListener('resize', () => {
   const open = frame.style.width && frame.style.width !== '64px';
   if (open) expandToOverlay();
});
  function collapseToDock() {
    enablePerfHints();

    // Fade out scrim
    scrim.style.opacity = '0';
    scrim.style.pointerEvents = 'none';

    requestAnimationFrame(() => {
      Object.assign(frame.style, {
        width: '64px',
        height: '64px',
        borderRadius: '12px',
        boxShadow: 'none',
        transform: 'scale(1) translateZ(0)' // keep stable
      });
      setTimeout(disablePerfHints, 250);
    });
  }
  
  function showFrame() {
    Object.assign(frame.style, {
      opacity:'1',
      visibility:'visible',
      transform:'scale(1)'
    });
  }

  // 4) postMessage contract (parent side)
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
        collapseToDock();
         // also push config immediately on READY
frame.contentWindow?.postMessage({
 type: 'ELLO_CONFIG',
  payload: { storeId, storeName, theme, shopDomain, storefrontToken }
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
          payload: { storeId, storeName, theme, shopDomain, storefrontToken }
        }, ALLOWED_ORIGIN);
        break;
      default:
        // ignore
        break;
    }
  });

  // 5) Proactively send config after load (in case handshake races)
  frame.addEventListener('load', () => {
    console.log('Iframe loaded, sending config...');
    console.log('Frame src:', frame.src);
    console.log('Frame contentWindow:', frame.contentWindow);
    frame.contentWindow?.postMessage({
      type: 'ELLO_CONFIG',
      payload: { storeId, storeName, theme, shopDomain, storefrontToken }
    }, ALLOWED_ORIGIN);
    console.log('Config sent to iframe');
  });
  
  // Add error handling for iframe
  frame.addEventListener('error', (e) => {
    console.error('Iframe error:', e);
  });
  
  // Fallback: show widget after 3 seconds even if no message received
  setTimeout(() => {
    if (frame.style.opacity === '0') {
      console.log('Fallback: showing widget after timeout');
      showFrame();
      collapseToDock();
    }
  }, 3000);
})();


