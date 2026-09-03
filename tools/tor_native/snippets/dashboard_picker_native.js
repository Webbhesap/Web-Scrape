  async function getTargetTabId() {
    // 1. If running inside DevTools panel, inspectedWindow.tabId is the exact inspected tab!
    if (typeof browser !== 'undefined' && browser.devtools && browser.devtools.inspectedWindow && browser.devtools.inspectedWindow.tabId) {
      return browser.devtools.inspectedWindow.tabId;
    }

    // 2. If running in normal browser window / popup / dashboard tab:
    if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.query) {
      const isHttpTab = (t) => t && t.url && /^https?:/i.test(t.url);

      try {
        const tabs = await browser.tabs.query({ lastFocusedWindow: true });
        const localHttp = (tabs || []).filter(isHttpTab);
        const preferred = localHttp.find(t => t.active) || localHttp[0];
        if (preferred && preferred.id) return preferred.id;

        const allTabs = await browser.tabs.query({});
        const httpTabs = (allTabs || []).filter(isHttpTab);
        httpTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
        return httpTabs.length ? httpTabs[0].id : null;
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  /**
   * Ensures the extension actually holds the <all_urls> host permission.
   *
   * Firefox (and therefore Tor Browser) treats MV3 host permissions as
   * opt-in: even when the user toggles them in about:addons, script
   * injection can still fail with "Missing host permission for the tab"
   * (e.g. tabs opened before the grant, or quarantined-domain rules).
   * Requesting the permission from inside a user gesture (button click)
   * makes Firefox bind it reliably.
   */
  async function ensureHostPermission() {
    if (typeof browser === 'undefined' || !browser.permissions || !browser.permissions.request) {
      return true;
    }
    const wanted = { origins: ['<all_urls>'] };
    // Call permissions.request directly instead of checking contains() first:
    // Firefox resolves it silently with true when the permission is already
    // granted, and chaining request() after the contains() promise would
    // destroy the user-input-handler stack Firefox requires for the prompt.
    try {
      return Boolean(await browser.permissions.request(wanted));
    } catch (e) {
      // request() throws when Firefox does not recognise the call as coming
      // from a user input handler; fall back to a plain permission check.
      try {
        return Boolean(await browser.permissions.contains(wanted));
      } catch (e2) {
        console.warn('Permission check failed:', e2 && e2.message);
        return false;
      }
    }
  }

  async function launchElementPicker(mode) {
    const selStr = elements.fieldSelectorCss.value.trim();
    const selType = elements.fieldSelectorType.value;
    const isMult = elements.fieldSelectorMultiple.checked;

    // Native WebExtension environment (Firefox / Tor Browser)
    if (typeof browser !== 'undefined' && browser.tabs && browser.scripting) {
      const permitted = await ensureHostPermission();
      if (!permitted) {
        alert(t('hostPermNeeded'));
        return;
      }

      const tabId = await getTargetTabId();
      if (!tabId) {
        alert(t('noActiveTab'));
        return;
      }

      let tabInfo = null;
      try {
        tabInfo = await browser.tabs.get(tabId);
      } catch (e) {
        console.warn('Target tab does not exist or was closed:', e && e.message);
      }
      if (!tabInfo) {
        alert(t('tabClosed'));
        return;
      }

      if (tabInfo.url && (tabInfo.url.startsWith('about:') || tabInfo.url.startsWith('moz-extension://') || tabInfo.url.startsWith('chrome:'))) {
        alert(t('systemPage'));
        return;
      }

      // Inject picker scripts
      try {
        await browser.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content/selector_picker.js']
        });
      } catch (e) {
        console.warn('Script injection error:', e && e.message);
        alert(t('attachFail', { msg: e && e.message }));
        return;
      }

      try {
        await browser.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['content/selector_picker.css']
        });
      } catch (e) {
        console.warn('CSS injection warning:', e && e.message);
      }

      let msgType = 'START_PICKER';
      if (mode === 'preview') msgType = 'ELEMENT_PREVIEW';
      else if (mode === 'data-preview') msgType = 'DATA_PREVIEW';

      let scopeSelector = '';
      if (state.currentParentSelector && state.currentParentSelector !== '_root' && state.currentSitemap) {
        const parentSel = state.currentSitemap.getSelectorById(state.currentParentSelector);
        if (parentSel && parentSel.selector) scopeSelector = parentSel.selector;
      }
      try {
        await browser.tabs.sendMessage(tabId, {
          type: msgType,
          selector: selStr,
          selectorType: selType,
          multiple: isMult,
          scopeSelector: scopeSelector
        });
      } catch (e) {
        console.warn('Message send warning:', e && e.message);
      }
      return;
    }

