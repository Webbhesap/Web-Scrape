/**
 * Web Scraper Scraping Execution Content Script.
 * Handles DOM extractions, dynamic clicking (load more/tabs), and infinite scrolling.
 */
(function () {
  'use strict';

  if (window.__webScraperContentLoaded) {
    return;
  }
  window.__webScraperContentLoaded = true;

  function cleanText(text) {
    if (!text) return '';
    return String(text).replace(/\r\n|\r/g, '\n').replace(/[ \t]+/g, ' ').trim();
  }

  function resolveUrl(href) {
    if (!href) return '';
    try {
      return new URL(href, window.location.href).href;
    } catch (e) {
      return href;
    }
  }

  async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
  }

  async function handleClickSelector(selectorConfig) {
    const clickSelector = selectorConfig.clickElementSelector;
    const clickType = selectorConfig.clickType || 'clickMore';
    const clickDelay = selectorConfig.clickDelay || 1000;
    // Hard safety cap: the dashboard can lower it per selector, but never
    // above this ceiling (a runaway "load more" loop would hang the crawl).
    const maxClicks = Math.min(parseInt(selectorConfig.maxClicks, 10) || 50, 200);

    let clickCount = 0;
    const clickedElements = new Set();

    while (clickCount < maxClicks) {
      const buttons = Array.from(document.querySelectorAll(clickSelector)).filter(b => {
        return b.offsetParent !== null && !clickedElements.has(b);
      });

      if (buttons.length === 0) break;

      const targetBtn = buttons[0];
      clickedElements.add(targetBtn);

      targetBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(100);

      // Dispatch real click events
      targetBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      targetBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      targetBtn.click();

      clickCount++;
      await sleep(clickDelay);

      if (clickType === 'clickOnce') {
        break;
      }
    }

    return { clicksDone: clickCount };
  }

  async function handleScrollSelector(selectorConfig) {
    const scrollDelay = selectorConfig.scrollDelay || 1000;
    const maxScrolls = selectorConfig.maxScrolls || 20;
    const scrollSelector = selectorConfig.scrollElementSelector;

    const scrollTarget = scrollSelector ? document.querySelector(scrollSelector) : null;
    let scrollsDone = 0;
    let lastHeight = 0;

    while (scrollsDone < maxScrolls) {
      if (scrollTarget) {
        lastHeight = scrollTarget.scrollHeight;
        scrollTarget.scrollTop = scrollTarget.scrollHeight;
      } else {
        lastHeight = document.documentElement.scrollHeight;
        window.scrollTo(0, document.documentElement.scrollHeight);
      }

      scrollsDone++;
      await sleep(scrollDelay);

      const newHeight = scrollTarget ? scrollTarget.scrollHeight : document.documentElement.scrollHeight;
      if (newHeight <= lastHeight) {
        // No more new content loaded
        break;
      }
    }

    return { scrollsDone: scrollsDone };
  }

  // Listen for execution commands from background script
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'EXECUTE_PAGE_ACTIONS') {
        (async () => {
          try {
            if (request.actions && request.actions.click) {
              await handleClickSelector(request.actions.click);
            }
            if (request.actions && request.actions.scroll) {
              await handleScrollSelector(request.actions.scroll);
            }
            sendResponse({ success: true });
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
        })();
        return true; // Keep message channel open for async response
      }
    });
  }
})();
