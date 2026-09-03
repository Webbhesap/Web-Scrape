  function createTabOrFetchRunner() {
    // Native WebExtension environment (Firefox / Tor Browser) with tabs API:
    if (typeof browser !== 'undefined' && browser.tabs && browser.scripting) {
      return async (url) => {
        const tab = await browser.tabs.create({ url: url, active: false });
        if (!tab || !tab.id) throw new Error('Failed to create background scraping tab');
        const tabId = tab.id;

        let tabClosed = false;
        let onUpdated = null;
        let onRemoved = null;

        const cleanup = async () => {
          if (onUpdated) { try { browser.tabs.onUpdated.removeListener(onUpdated); } catch (e) {} }
          if (onRemoved) { try { browser.tabs.onRemoved.removeListener(onRemoved); } catch (e) {} }
          if (!tabClosed) {
            try { await browser.tabs.remove(tabId); } catch (e) { /* already gone */ }
          }
        };

        try {
          // Wait for the tab to finish loading (or be closed by the user).
          await new Promise((resolve, reject) => {
            onRemoved = (removedTabId) => {
              if (removedTabId === tabId) {
                tabClosed = true;
                reject(new Error(`Scraping tab ${tabId} was closed.`));
              }
            };
            onUpdated = (updatedTabId, changeInfo) => {
              if (updatedTabId === tabId && changeInfo.status === 'complete') {
                resolve();
              }
            };
            browser.tabs.onRemoved.addListener(onRemoved);
            browser.tabs.onUpdated.addListener(onUpdated);

            // If the tab already finished loading before the listeners attached
            browser.tabs.get(tabId).then((info) => {
              if (info && info.status === 'complete') resolve();
            }).catch(() => { /* handled via onRemoved */ });
          });

          // Give dynamic pages a moment to settle before acting on them.
          await new Promise((r) => setTimeout(r, 200));

          // Run in-page click/scroll actions when the sitemap asks for them.
          const selectors = (state.currentSitemap && state.currentSitemap.selectors) || [];
          const clickSel = selectors.find(s => s.type === 'SelectorElementClick');
          const scrollSel = selectors.find(s => s.type === 'SelectorElementScroll');
          const pagClick = selectors.find(s => s.type === 'SelectorPagination' && s.paginationType === 'click');
          const pagScroll = selectors.find(s => s.type === 'SelectorPagination' && s.paginationType === 'scroll');

          const actions = {};
          if (clickSel) {
            actions.click = {
              clickElementSelector: clickSel.clickElementSelector || clickSel.selector,
              clickType: clickSel.clickType || 'clickMore',
              clickDelay: clickSel.clickDelay || 1000
            };
          } else if (pagClick) {
            actions.click = {
              clickElementSelector: pagClick.selector,
              clickType: 'clickMore',
              clickDelay: pagClick.delay || 1000
            };
          }
          if (scrollSel) {
            actions.scroll = {
              scrollElementSelector: scrollSel.scrollElementSelector || '',
              scrollDelay: scrollSel.scrollDelay || 1000,
              maxScrolls: scrollSel.maxScrolls || 20
            };
          } else if (pagScroll) {
            actions.scroll = {
              scrollElementSelector: '',
              scrollDelay: pagScroll.delay || 1000,
              maxScrolls: pagScroll.maxPages || 20
            };
          }

          if (actions.click || actions.scroll) {
            try {
              await browser.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content/scraper_content.js']
              });
              await browser.tabs.sendMessage(tabId, { type: 'EXECUTE_PAGE_ACTIONS', actions });
            } catch (e) {
              // Page actions are best-effort; still extract whatever loaded.
              console.warn('Page action warning:', e && e.message);
            }
          }

          // Extract the final HTML.
          const results = await browser.scripting.executeScript({
            target: { tabId: tabId },
            func: () => document.documentElement.outerHTML
          });
          if (!results || !results[0]) {
            throw new Error('Failed to extract HTML from tab');
          }

          const html = results[0].result;
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          return { document: doc, url: url };
        } finally {
          await cleanup();
        }
      };
    }

