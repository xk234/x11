
/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                     Filter Overlay Remover                                   ║
 * ║                                                                              ║
 * ║  A powerful, persistent DOM cleaner that removes blocking overlays           ║
 * ║  injected by web filtering extensions such as:                               ║
 * ║                                                                              ║
 * ║    • Blocksi Enterprise Edition                                              ║
 * ║    • Lightspeed Filter / Lightspeed Systems                                  ║
 * ║    • Similar school / enterprise content filters                             ║
 * ║                                                                              ║
 * ║  Specifically designed to run inside iframes and as a background cleaner.    ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Copyright (c) 2026 Xclounkit234X
 * Discord: Xclounkit234X
 *
 * This project was created with the assistance of Grok AI (built by xAI).
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * ---------------------------------------------------------------------------
 * GitHub-ready • MIT License • Made with Grok AI
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────
  const CONFIG = {
    // How aggressively to clean (ms between forced sweeps)
    forceSweepInterval: 1200,

    // Debounce delay after MutationObserver fires
    mutationDebounce: 40,

    // Maximum number of removals to log (prevents console spam)
    maxLogEntries: 25,

    // Enable verbose console output
    debug: true,

    // Also attempt to restore pointer-events / overflow on body & html
    restorePageInteraction: true,

    // Watch for newly created iframes and inject into same-origin ones
    watchNewIframes: true
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Selectors & Detection Patterns
  // ─────────────────────────────────────────────────────────────────────────
  const SELECTORS = [
    // Exact Blocksi iframe block (from known signature)
    '#__blocksi_iframe_blocked__',

    // Broad Blocksi patterns
    '[id*="blocksi" i]',
    '[id*="__blocksi"]',
    '[class*="blocksi" i]',
    '[data-blocksi]',

    // Extreme z-index full-screen overlays (common technique)
    'div[style*="z-index: 2147483647"]',
    'div[style*="z-index:2147483647"]',
    'div[style*="z-index: 999999"]',
    'div[style*="z-index:999999"]',

    // Images served from the official Blocksi extension ID
    'img[src*="chrome-extension://ghlpmldmjjhmdgmneoaibbegkjjbonbk"]',
    'img[src*="iframe-denied"]',
    'img[src*="blocked_content"]',
    'img[src*="yt-denied"]',
    'img[src*="yt-shorts-block"]',

    // Generic high-coverage fixed overlays
    'div[style*="position: fixed"][style*="width: 100%"][style*="height: 100%"]',
    'div[style*="position:fixed"][style*="width:100%"][style*="height:100%"]'
  ];

  const TEXT_INDICATORS = [
    'this content is unavailable',
    'is currently blocked by your administrator',
    'blocked by your administrator',
    'this site is blocked',
    'access to this site is blocked',
    'filtered by lightspeed',
    'lightspeed systems',
    'blocked by blocksi',
    'content filtered',
    'web filter',
    'administrator has blocked'
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // Internal State
  // ─────────────────────────────────────────────────────────────────────────
  let removalCount = 0;
  let lastSweep = 0;
  const seen = new WeakSet();

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────
  function log(...args) {
    if (CONFIG.debug && removalCount < CONFIG.maxLogEntries) {
      console.debug('%c[FilterRemover]', 'color:#7c3aed;font-weight:bold', ...args);
    }
  }

  function isHighZIndexOverlay(el) {
    try {
      const style = window.getComputedStyle(el);
      const z = parseInt(style.zIndex, 10) || 0;
      const isFixed = style.position === 'fixed' || style.position === 'absolute';
      const coversWidth = el.offsetWidth >= window.innerWidth * 0.92;
      const coversHeight = el.offsetHeight >= window.innerHeight * 0.92;

      return isFixed && coversWidth && coversHeight && z >= 10000;
    } catch {
      return false;
    }
  }

  function containsBlockedImage(el) {
    if (!el.querySelector) return false;
    return !!el.querySelector(
      'img[src*="ghlpmldmjjhmdgmneoaibbegkjjbonbk"],' +
      'img[src*="iframe-denied"],' +
      'img[src*="blocked_content"],' +
      'img[src*="yt-denied"],' +
      'img[src*="yt-shorts-block"]'
    );
  }

  function matchesTextIndicators(el) {
    const text = (el.textContent || '').toLowerCase().replace(/\s+/g, ' ');
    return TEXT_INDICATORS.some(t => text.includes(t));
  }

  function isFilterOverlay(el) {
    if (!el || el.nodeType !== 1 || seen.has(el)) return false;

    // Fast exact match
    if (el.id === '__blocksi_iframe_blocked__') return true;

    // Known attribute patterns
    if (
      (el.id && /blocksi/i.test(el.id)) ||
      (el.className && typeof el.className === 'string' && /blocksi/i.test(el.className))
    ) {
      return true;
    }

    // Visual / structural heuristics
    if (isHighZIndexOverlay(el)) return true;
    if (containsBlockedImage(el)) return true;

    // Text-based (only if it also looks like an overlay)
    if (matchesTextIndicators(el) && isHighZIndexOverlay(el)) return true;

    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Core Removal Logic
  // ─────────────────────────────────────────────────────────────────────────
  function safeRemove(el, reason = '') {
    if (!el || !el.parentNode || seen.has(el)) return false;

    try {
      seen.add(el);
      el.remove();
      removalCount++;
      log(`Removed (${reason || 'matched'}) →`, el.id || el.className || el.tagName);
      return true;
    } catch (err) {
      log('Failed to remove element:', err);
      return false;
    }
  }

  function restoreInteraction() {
    if (!CONFIG.restorePageInteraction) return;

    try {
      const html = document.documentElement;
      const body = document.body;

      if (html) {
        html.style.overflow = '';
        html.style.pointerEvents = '';
      }
      if (body) {
        body.style.overflow = '';
        body.style.pointerEvents = '';
        body.style.position = '';
      }
    } catch { /* ignore */ }
  }

  function removeOverlays(root = document) {
    const now = Date.now();
    if (now - lastSweep < 30) return; // hard rate-limit
    lastSweep = now;

    let removedThisPass = 0;

    // 1. Fast selector path
    for (const sel of SELECTORS) {
      try {
        const nodes = root.querySelectorAll(sel);
        nodes.forEach(el => {
          if (safeRemove(el, `selector: ${sel}`)) removedThisPass++;
        });
      } catch {
        // Invalid selector in this context – skip
      }
    }

    // 2. Heuristic scan of likely candidates
    const candidates = root.querySelectorAll(
      'body > div, body > section, body > aside, #root > div, #app > div, div[style*="position"]'
    );

    candidates.forEach(el => {
      if (isFilterOverlay(el)) {
        if (safeRemove(el, 'heuristic')) removedThisPass++;
      }
    });

    if (removedThisPass > 0) {
      restoreInteraction();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mutation Observer (reacts to re-injection)
  // ─────────────────────────────────────────────────────────────────────────
  let debounceTimer = null;

  const observer = new MutationObserver((mutations) => {
    let interesting = false;

    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        interesting = true;
        break;
      }
    }

    if (interesting) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        removeOverlays();
      }, CONFIG.mutationDebounce);
    }
  });

  function startObserving() {
    const target = document.documentElement || document.body;
    if (target) {
      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'id']
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Iframe Watcher (inject into same-origin iframes)
  // ─────────────────────────────────────────────────────────────────────────
  function injectIntoFrame(iframe) {
    try {
      const doc = iframe.contentDocument;
      if (!doc || doc.__filterRemoverActive) return;

      doc.__filterRemoverActive = true;

      const script = doc.createElement('script');
      script.textContent = `(${arguments.callee.caller || function(){}} )();`; // fallback
      // Better: just re-run the cleaner logic inside the frame
      const cleanFn = removeOverlays.toString();
      const bootstrap = `
        (${function() {
          // Minimal re-implementation for injected frames
          const SELECTORS = ${JSON.stringify(SELECTORS)};
          function wipe() {
            SELECTORS.forEach(sel => {
              try {
                document.querySelectorAll(sel).forEach(el => el.remove());
              } catch {}
            });
          }
          wipe();
          new MutationObserver(wipe).observe(document.documentElement, { childList: true, subtree: true });
          setInterval(wipe, 1500);
        }.toString()})();
      `;
      script.textContent = bootstrap;
      (doc.head || doc.documentElement).appendChild(script);
      log('Injected cleaner into iframe:', iframe.src || '[srcdoc/about:blank]');
    } catch {
      // Cross-origin – silently ignore
    }
  }

  function watchIframes() {
    if (!CONFIG.watchNewIframes) return;

    // Existing iframes
    document.querySelectorAll('iframe').forEach(iframe => {
      iframe.addEventListener('load', () => injectIntoFrame(iframe));
      // Try immediately in case already loaded
      injectIntoFrame(iframe);
    });

    // Future iframes
    new MutationObserver((mutations) => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.tagName === 'IFRAME') {
            node.addEventListener('load', () => injectIntoFrame(node));
          }
          if (node.querySelectorAll) {
            node.querySelectorAll('iframe').forEach(iframe => {
              iframe.addEventListener('load', () => injectIntoFrame(iframe));
            });
          }
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bootstrap
  // ─────────────────────────────────────────────────────────────────────────
  function init() {
    log('Starting Filter Overlay Remover');
    log('Frame:', location.href);
    log('Made by Xclounkit234X • Assisted by Grok AI (xAI)');

    // Initial clean
    removeOverlays();

    // Start watching
    startObserving();

    // Periodic force sweep (catches stubborn re-injections)
    setInterval(() => {
      removeOverlays();
      restoreInteraction();
    }, CONFIG.forceSweepInterval);

    // Extra triggers
    window.addEventListener('load', () => removeOverlays());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) removeOverlays();
    });
    window.addEventListener('focus', () => removeOverlays());

    // Iframe support
    watchIframes();

    // Public API
    window.__removeFilterOverlays = removeOverlays;
    window.__filterRemoverStats = () => ({
      removals: removalCount,
      version: '2.0.0',
      author: 'Xclounkit234X',
      assistant: 'Grok AI (xAI)'
    });

    log('Ready. Call window.__removeFilterOverlays() to force a clean.');
  }

  // Run as soon as possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
