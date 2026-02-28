// ============================================================
// PaVa-Vak PWA Manager  |  pwa.js
// Place this file at: /home/opc/PaVa-Vak/frontend/js/pwa.js
// Then add: <script src="/js/pwa.js"></script> to every HTML page
// (or paste this into your existing app.js / main JS file)
// ============================================================

(function () {
  'use strict';

  // ─── SERVICE WORKER REGISTRATION ───────────────────────────
  let swRegistration = null;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        swRegistration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        console.log('[PWA] Service Worker registered. Scope:', swRegistration.scope);

        // Check for updates every 60 seconds while app is open
        setInterval(() => swRegistration.update(), 60 * 1000);

        // When a new SW version is waiting, show an update banner
        swRegistration.addEventListener('updatefound', () => {
          const newWorker = swRegistration.installing;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              showUpdateBanner();
            }
          });
        });

        // When SW takes control after update, reload to get fresh assets
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });

        // Listen for notification click messages from SW
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'NOTIFICATION_CLICK') {
            console.log('[PWA] Notification click → navigate to:', event.data.url);
            // If you have a chat router, navigate to the sender's conversation:
            // navigateToChat(event.data.senderId);
          }
        });

      } catch (err) {
        console.error('[PWA] Service Worker registration failed:', err);
      }
    });
  }

  // ─── INSTALL PROMPT ────────────────────────────────────────
  let deferredInstallPrompt = null;

  // Capture the install prompt before the browser shows it
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // Stop automatic mini-infobar
    deferredInstallPrompt = event;
    console.log('[PWA] Install prompt captured and ready');
    showInstallButton();
  });

  // Hide install button after user installs
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully!');
    deferredInstallPrompt = null;
    hideInstallButton();
    hideInstallBanner();
  });

  // ─── INSTALL BUTTON LOGIC ──────────────────────────────────
  // This looks for a button with id="pwa-install-btn" in your HTML.
  // Add this anywhere in your HTML: <button id="pwa-install-btn" style="display:none">Install App</button>

  function showInstallButton() {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = '';

    // Also show the install banner if present
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = '';
  }

  function hideInstallButton() {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'none';
  }

  function hideInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = 'none';
  }

  // Wire up the install button click
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) {
      btn.addEventListener('click', triggerInstall);
    }
    const bannerBtn = document.getElementById('pwa-banner-install-btn');
    if (bannerBtn) {
      bannerBtn.addEventListener('click', triggerInstall);
    }
    const bannerClose = document.getElementById('pwa-banner-close-btn');
    if (bannerClose) {
      bannerClose.addEventListener('click', () => {
        hideInstallBanner();
        sessionStorage.setItem('pwa-banner-dismissed', '1');
      });
    }

    // Don't show banner again this session if user already dismissed
    if (sessionStorage.getItem('pwa-banner-dismissed')) {
      hideInstallBanner();
    }

    // Detect if already running as installed PWA
    if (isRunningAsPWA()) {
      hideInstallButton();
      hideInstallBanner();
      console.log('[PWA] Running in standalone/PWA mode');
      document.body.classList.add('pwa-mode'); // Optional: style differently in PWA
    }
  });

  async function triggerInstall() {
    if (!deferredInstallPrompt) {
      console.log('[PWA] No install prompt available');
      return;
    }
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log('[PWA] User install choice:', outcome);
    deferredInstallPrompt = null;
    hideInstallButton();
    hideInstallBanner();
  }

  function isRunningAsPWA() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.navigator.standalone === true // iOS Safari
    );
  }

  // ─── UPDATE BANNER ─────────────────────────────────────────
  // Shows a "New version available" bar at the top of the screen
  function showUpdateBanner() {
    let banner = document.getElementById('pwa-update-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'pwa-update-banner';
      banner.innerHTML = `
        <span>✨ A new version of PaVa-Vak is ready.</span>
        <button id="pwa-update-reload-btn">Reload</button>
        <button id="pwa-update-dismiss-btn">Later</button>
      `;
      banner.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
        background: #1a73e8; color: white; padding: 10px 16px;
        display: flex; align-items: center; justify-content: center;
        gap: 12px; font-size: 14px; font-family: sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;
      document.body.prepend(banner);

      document.getElementById('pwa-update-reload-btn').addEventListener('click', () => {
        if (swRegistration?.waiting) {
          swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          window.location.reload();
        }
      });
      document.getElementById('pwa-update-dismiss-btn').addEventListener('click', () => {
        banner.remove();
      });
    }
  }

  // ─── ONLINE / OFFLINE INDICATOR ────────────────────────────
  // Shows a small banner when connection is lost/restored
  function updateOnlineStatus() {
    let bar = document.getElementById('pwa-offline-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'pwa-offline-bar';
      bar.style.cssText = `
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 9998;
        padding: 8px 16px; text-align: center; font-size: 13px;
        font-family: sans-serif; transition: opacity 0.3s;
      `;
      document.body.appendChild(bar);
    }
    if (navigator.onLine) {
      bar.textContent = '✅ Back online';
      bar.style.background = '#34a853';
      bar.style.color = 'white';
      bar.style.display = 'block';
      setTimeout(() => { bar.style.display = 'none'; }, 3000);
    } else {
      bar.textContent = '⚠️ No internet connection — messages will send when reconnected';
      bar.style.background = '#ea4335';
      bar.style.color = 'white';
      bar.style.display = 'block';
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // Expose triggerInstall globally in case you call it from HTML onclick
  window.pwaInstall = triggerInstall;

})();
