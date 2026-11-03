# Filter Overlay Remover

**A powerful, persistent DOM cleaner that removes blocking overlays injected by web filtering extensions.**

Specifically built to defeat cosmetic / overlay-based blocks from:

- **Blocksi Enterprise Edition** (including the exact `#__blocksi_iframe_blocked__` signature)
- **Lightspeed Filter / Lightspeed Systems**
- Other school and enterprise content filters that inject full-page fixed overlays

Designed to run **inside iframes** and as a long-lived background cleaner.

---

### Author

**Xclounkit234X**  
Discord: `Xclounkit234X`

This project was created with the assistance of **Grok AI** (built by xAI).

---

### Features

- Exact match for Blocksi’s known iframe block element
- Broad heuristic detection (extreme z-index, full-viewport fixed elements, blocked images from the official extension ID)
- Text-content indicators commonly used by these filters
- MutationObserver + debounced reaction to re-injection attempts
- Periodic force sweeps
- Automatic restoration of `overflow` / `pointer-events` on `<html>` and `<body>`
- Same-origin iframe injection support
- Lightweight public API:
  - `window.__removeFilterOverlays()` – force an immediate clean
  - `window.__filterRemoverStats()` – view runtime stats

---

### Installation / Usage

#### 1. Userscript (Tampermonkey / Violentmonkey / etc.)

```js
// ==UserScript==
// @name         Filter Overlay Remover
// @namespace    https://github.com/Xclounkit234X
// @version      2.0.0
// @description  Removes Blocksi, Lightspeed and similar filter overlays (works inside iframes)
// @author       Xclounkit234X
// @match        *://*/*
// @allFrames    true
// @run-at       document-start
// @grant        none
// ==/UserScript==
```

Then paste the entire contents of `filter-overlay-remover.js`.

#### 2. Browser Extension Content Script

In your `manifest.json`:

```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["filter-overlay-remover.js"],
    "run_at": "document_start",
    "all_frames": true
  }
]
```

#### 3. Manual injection into a specific iframe

```js
const iframe = document.querySelector('iframe');
iframe.addEventListener('load', () => {
  try {
    const script = iframe.contentDocument.createElement('script');
    script.src = chrome.runtime.getURL('filter-overlay-remover.js'); // or use textContent
    iframe.contentDocument.documentElement.appendChild(script);
  } catch (e) {
    console.warn('Cross-origin iframe – cannot inject');
  }
});
```

---

### Important Notes

- This tool only removes **DOM overlays**. If the filter blocks the network request itself, the content will still not load.
- Cross-origin iframes are protected by the browser’s Same-Origin Policy; the script can only clean same-origin frames.
- Use responsibly and in accordance with your organization’s acceptable-use policies.

---

### License

MIT License

Copyright (c) 2026 Xclounkit234X

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

**Made with Grok AI (xAI)** • 2026
