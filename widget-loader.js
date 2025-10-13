(function () {
  console.log('Widget loader starting...');
  
  // TODO: set to your CDN origin that serves widget.html + assets
  const WIDGET_BASE_URL = "https://nollerx.github.io/MY-HOSTED-WIDGET9"; 
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
  
  console.log('Store config:', { storeId, storeName, theme });

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
  frame.src = `${WIDGET_BASE_URL}/widget.html?store_id=${encodeURIComponent(storeId)}&store_name=${encodeURIComponent(storeName)}`;
  frame.allow = 'fullscreen';
  frame.sandbox = 'allow-scripts allow-forms allow-same-origin allow-popups';
  frame.loading = 'eager';
  frame.style.cssText = `
    width:72px;height:72px;border:0;border-radius:16px;
    box-shadow:0 8px 24px rgba(0,0,0,.18);
    transition:all .25s ease;
    background:transparent;
  `;
  container.appendChild(frame);
  
  console.log('Iframe created with src:', frame.src);
  console.log('Container added to DOM:', container);

  // 3) Helpers for sizing
  function expandToOverlay() {
    Object.assign(frame.style, {
      position:'fixed', inset:'0', width:'100vw', height:'100vh',
      borderRadius:'0', boxShadow:'none'
    });
  }
  function collapseToDock() {
    Object.assign(frame.style, {
      position:'static', width:'72px', height:'72px',
      borderRadius:'16px', boxShadow:'0 8px 24px rgba(0,0,0,.18)'
    });
  }

  // 4) postMessage contract (parent side)
  window.addEventListener('message', (e) => {
    if (!e.origin || e.origin !== ALLOWED_ORIGIN) return;
    const msg = e.data || {};
    switch (msg.type) {
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
          payload: { storeId, storeName, theme }
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
    frame.contentWindow?.postMessage({
      type: 'ELLO_CONFIG',
      payload: { storeId, storeName, theme }
    }, ALLOWED_ORIGIN);
    console.log('Config sent to iframe');
  });
})();


