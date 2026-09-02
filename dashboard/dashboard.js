/**
 * Web Scraper Main Application Controller.
 * Manages UI views, sitemap lifecycle, selector hierarchy, live scraping execution,
 * data viewing, and export operations.
 */
(function () {
  'use strict';

  // Application State
  const state = {
    currentView: 'sitemaps',
    sitemaps: [],
    currentSitemap: null,
    currentParentSelector: '_root',
    parentHierarchyPath: ['_root'],
    editingSelectorId: null,
    scrapedData: [],
    filteredData: [],
    scraperEngine: null,
    dataPagination: {
      page: 1,
      pageSize: 25,
      sortCol: null,
      sortAsc: true
    }
  };

  // DOM Elements Cache
  const elements = {};

  function init() {
    cacheElements();
    renderIcons();
    bindGlobalEvents();
    bindFormEvents();
    bindScraperEvents();
    bindDataViewerEvents();
    loadSitemaps();

    // Check if query params specify sitemap
    const urlParams = new URLSearchParams(window.location.search);
    const sitemapId = urlParams.get('sitemap');
    const viewParam = urlParams.get('view');
    const newUrl = urlParams.get('newUrl');
    if (sitemapId) {
      openSitemap(sitemapId, viewParam || 'selectors');
    } else if (newUrl) {
      openCreateSitemapMeta();
      if (elements.fieldSitemapUrls) {
        elements.fieldSitemapUrls.value = newUrl;
      }
    } else {
      switchView('sitemaps');
    }

    // Listen for picker messages from background / content scripts
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'PICKER_RESULT') {
          if (elements.fieldSelectorCss) {
            elements.fieldSelectorCss.value = message.selector;
          }
          if (message.multiple && elements.fieldSelectorMultiple) {
            elements.fieldSelectorMultiple.checked = true;
          }
        }
      });
    }
  }

  function cacheElements() {
    // Nav
    elements.dropdownSitemaps = document.getElementById('dropdown-sitemaps');
    elements.btnDropdownSitemaps = document.getElementById('btn-dropdown-sitemaps');
    elements.dropdownCurrentSitemap = document.getElementById('dropdown-current-sitemap');
    elements.btnDropdownCurrentSitemap = document.getElementById('btn-dropdown-current-sitemap');
    elements.navCurrentSitemapTitle = document.getElementById('nav-current-sitemap-title');
    elements.breadcrumbBar = document.getElementById('breadcrumb-bar');

    // Views
    elements.views = {
      sitemaps: document.getElementById('view-sitemaps'),
      selectors: document.getElementById('view-selectors'),
      'selector-edit': document.getElementById('view-selector-edit'),
      'sitemap-meta': document.getElementById('view-sitemap-meta'),
      'sitemap-import': document.getElementById('view-sitemap-import'),
      'sitemap-export': document.getElementById('view-sitemap-export'),
      scrape: document.getElementById('view-scrape'),
      'browse-data': document.getElementById('view-browse-data'),
      'export-data': document.getElementById('view-export-data'),
      'selector-graph': document.getElementById('view-selector-graph')
    };

    // Sitemaps list view
    elements.tbodySitemaps = document.getElementById('tbody-sitemaps');
    elements.searchSitemapsInput = document.getElementById('search-sitemaps-input');

    // Selectors list view
    elements.tbodySelectors = document.getElementById('tbody-selectors');
    elements.selectorsViewTitle = document.getElementById('selectors-view-title');

    // Selector Edit Form
    elements.formSelectorEdit = document.getElementById('form-selector-edit');
    elements.selectorEditTitle = document.getElementById('selector-edit-title');
    elements.selectorEditError = document.getElementById('selector-edit-error');
    elements.fieldSelectorId = document.getElementById('field-selector-id');
    elements.fieldSelectorType = document.getElementById('field-selector-type');
    elements.fieldSelectorTypeDesc = document.getElementById('field-selector-type-desc');
    elements.fieldSelectorCss = document.getElementById('field-selector-css');
    elements.fieldSelectorMultiple = document.getElementById('field-selector-multiple');
    elements.fieldSelectorRegex = document.getElementById('field-selector-regex');
    elements.fieldSelectorDelay = document.getElementById('field-selector-delay');
    elements.parentSelectorsList = document.getElementById('parent-selectors-list');

    // Type options containers
    elements.optLink = document.getElementById('opt-link');
    elements.fieldLinkType = document.getElementById('field-link-type');
    elements.optImage = document.getElementById('opt-image');
    elements.fieldImageDownload = document.getElementById('field-image-download');
    elements.optTable = document.getElementById('opt-table');
    elements.fieldTableHeaderSel = document.getElementById('field-table-header-sel');
    elements.fieldTableDataSel = document.getElementById('field-table-data-sel');
    elements.optAttribute = document.getElementById('opt-attribute');
    elements.fieldExtractAttribute = document.getElementById('field-extract-attribute');
    elements.optHtml = document.getElementById('opt-html');
    elements.fieldHtmlOuter = document.getElementById('field-html-outer');
    elements.optGrouped = document.getElementById('opt-grouped');
    elements.fieldGroupedDelimiter = document.getElementById('field-grouped-delimiter');
    elements.optPagination = document.getElementById('opt-pagination');
    elements.fieldPaginationType = document.getElementById('field-pagination-type');
    elements.fieldPaginationMax = document.getElementById('field-pagination-max');
    elements.optClick = document.getElementById('opt-click');
    elements.fieldClickElementSel = document.getElementById('field-click-element-sel');
    elements.fieldClickType = document.getElementById('field-click-type');
    elements.fieldClickDelay = document.getElementById('field-click-delay');
    elements.fieldClickDiscardInitial = document.getElementById('field-click-discard-initial');
    elements.optScroll = document.getElementById('opt-scroll');
    elements.fieldScrollElementSel = document.getElementById('field-scroll-element-sel');
    elements.fieldScrollDelay = document.getElementById('field-scroll-delay');
    elements.fieldScrollMax = document.getElementById('field-scroll-max');

    // Sitemap Meta Form
    elements.formSitemapMeta = document.getElementById('form-sitemap-meta');
    elements.sitemapMetaTitle = document.getElementById('sitemap-meta-title');
    elements.sitemapMetaError = document.getElementById('sitemap-meta-error');
    elements.fieldSitemapId = document.getElementById('field-sitemap-id');
    elements.fieldSitemapUrls = document.getElementById('field-sitemap-urls');
    elements.btnSaveSitemapMeta = document.getElementById('btn-save-sitemap-meta');

    // Sitemap Import Form
    elements.formSitemapImport = document.getElementById('form-sitemap-import');
    elements.sitemapImportError = document.getElementById('sitemap-import-error');
    elements.fieldImportJson = document.getElementById('field-import-json');
    elements.fieldImportId = document.getElementById('field-import-id');
    elements.fileImportJson = document.getElementById('file-import-json');

    // Sitemap Export View
    elements.fieldExportJson = document.getElementById('field-export-json');

    // Scrape Monitor
    elements.scrapeStatusBadge = document.getElementById('scrape-status-badge');
    elements.metricPages = document.getElementById('metric-pages');
    elements.metricRecords = document.getElementById('metric-records');
    elements.metricQueue = document.getElementById('metric-queue');
    elements.metricTime = document.getElementById('metric-time');
    elements.scrapeCurrentUrl = document.getElementById('scrape-current-url');
    elements.scrapeLogBox = document.getElementById('scrape-log-box');
    elements.btnScrapePause = document.getElementById('btn-scrape-pause');
    elements.btnScrapeResume = document.getElementById('btn-scrape-resume');
    elements.btnScrapeStop = document.getElementById('btn-scrape-stop');

    // Browse Data View
    elements.tableScrapedData = document.getElementById('table-scraped-data');
    elements.theadScrapedData = document.getElementById('thead-scraped-data');
    elements.tbodyScrapedData = document.getElementById('tbody-scraped-data');
    elements.searchDataInput = document.getElementById('search-data-input');
    elements.browseRecordCountBadge = document.getElementById('browse-record-count-badge');
    elements.dataPageStart = document.getElementById('data-page-start');
    elements.dataPageEnd = document.getElementById('data-page-end');
    elements.dataPageTotal = document.getElementById('data-page-total');
    elements.dataPageCurrentNum = document.getElementById('data-page-current-num');
    elements.btnDataPrevPage = document.getElementById('btn-data-prev-page');
    elements.btnDataNextPage = document.getElementById('btn-data-next-page');

    // Graph Container
    elements.graphContainer = document.getElementById('graph-container');
  }

  function renderIcons() {
    if (typeof AppIcons === 'undefined') return;

    const logoIcon = document.getElementById('logo-icon');
    if (logoIcon) logoIcon.innerHTML = AppIcons.get('spider');

    document.querySelectorAll('.icon-chevron-down').forEach(el => el.innerHTML = AppIcons.get('chevronDown'));
    document.querySelectorAll('.icon-folder').forEach(el => el.innerHTML = AppIcons.get('folder'));
    document.querySelectorAll('.icon-plus').forEach(el => el.innerHTML = AppIcons.get('plus'));
    document.querySelectorAll('.icon-upload').forEach(el => el.innerHTML = AppIcons.get('upload'));
    document.querySelectorAll('.icon-layers').forEach(el => el.innerHTML = AppIcons.get('layers'));
    document.querySelectorAll('.icon-network').forEach(el => el.innerHTML = AppIcons.get('network'));
    document.querySelectorAll('.icon-edit').forEach(el => el.innerHTML = AppIcons.get('edit'));
    document.querySelectorAll('.icon-play').forEach(el => el.innerHTML = AppIcons.get('play'));
    document.querySelectorAll('.icon-table').forEach(el => el.innerHTML = AppIcons.get('table'));
    document.querySelectorAll('.icon-download').forEach(el => el.innerHTML = AppIcons.get('download'));
    document.querySelectorAll('.icon-code').forEach(el => el.innerHTML = AppIcons.get('code'));
    document.querySelectorAll('.icon-trash').forEach(el => el.innerHTML = AppIcons.get('trash'));
    document.querySelectorAll('.icon-crosshair').forEach(el => el.innerHTML = AppIcons.get('crosshair'));
    document.querySelectorAll('.icon-eye').forEach(el => el.innerHTML = AppIcons.get('eye'));
    document.querySelectorAll('.icon-copy').forEach(el => el.innerHTML = AppIcons.get('copy'));
    document.querySelectorAll('.icon-refresh').forEach(el => el.innerHTML = AppIcons.get('refresh'));
    document.querySelectorAll('.icon-pause').forEach(el => el.innerHTML = AppIcons.get('pause'));
    document.querySelectorAll('.icon-square').forEach(el => el.innerHTML = AppIcons.get('square'));
  }

  function bindGlobalEvents() {
    // Dropdown toggle logic
    elements.btnDropdownSitemaps.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.dropdownSitemaps.classList.toggle('show');
      elements.dropdownCurrentSitemap.classList.remove('show');
    });

    elements.btnDropdownCurrentSitemap.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.dropdownCurrentSitemap.classList.toggle('show');
      elements.dropdownSitemaps.classList.remove('show');
    });

    document.addEventListener('click', () => {
      elements.dropdownSitemaps.classList.remove('show');
      elements.dropdownCurrentSitemap.classList.remove('show');
    });

    // Nav Sitemaps items
    document.getElementById('nav-sitemaps-list').addEventListener('click', () => switchView('sitemaps'));
    document.getElementById('nav-create-sitemap').addEventListener('click', () => openCreateSitemapMeta());
    document.getElementById('nav-import-sitemap').addEventListener('click', () => openImportSitemap());
    document.getElementById('btn-quick-new-sitemap').addEventListener('click', () => openCreateSitemapMeta());
    document.getElementById('btn-sitemaps-create').addEventListener('click', () => openCreateSitemapMeta());
    document.getElementById('btn-sitemaps-import').addEventListener('click', () => openImportSitemap());

    // Nav Current Sitemap items
    document.getElementById('nav-sitemap-selectors').addEventListener('click', () => {
      state.currentParentSelector = '_root';
      state.parentHierarchyPath = ['_root'];
      switchView('selectors');
    });
    document.getElementById('nav-sitemap-graph').addEventListener('click', () => switchView('selector-graph'));
    document.getElementById('nav-sitemap-meta').addEventListener('click', () => openEditSitemapMeta());
    document.getElementById('nav-sitemap-scrape').addEventListener('click', () => switchView('scrape'));
    document.getElementById('nav-sitemap-browse').addEventListener('click', () => openBrowseData());
    document.getElementById('nav-sitemap-export-data').addEventListener('click', () => switchView('export-data'));
    document.getElementById('nav-sitemap-export-json').addEventListener('click', () => openExportSitemap());
    document.getElementById('nav-sitemap-delete').addEventListener('click', () => deleteCurrentSitemap());

    // Search sitemaps
    elements.searchSitemapsInput.addEventListener('input', () => renderSitemapsList());

    // Selectors view buttons
    document.getElementById('btn-add-selector').addEventListener('click', () => openAddSelector());
    document.getElementById('btn-view-graph').addEventListener('click', () => switchView('selector-graph'));
    document.getElementById('btn-back-to-selectors').addEventListener('click', () => switchView('selectors'));
  }

  function switchView(viewName) {
    state.currentView = viewName;
    for (const [name, el] of Object.entries(elements.views)) {
      if (el) el.classList.toggle('active', name === viewName);
    }

    // Toggle breadcrumb visibility
    const showBreadcrumbs = state.currentSitemap && (viewName === 'selectors' || viewName === 'selector-edit');
    elements.breadcrumbBar.style.display = showBreadcrumbs ? 'flex' : 'none';
    if (showBreadcrumbs) {
      renderBreadcrumbs();
    }

    if (viewName === 'sitemaps') {
      renderSitemapsList();
    } else if (viewName === 'selectors') {
      renderSelectorsList();
    } else if (viewName === 'selector-graph') {
      renderSelectorGraph();
    }
  }

  function renderBreadcrumbs() {
    elements.breadcrumbBar.innerHTML = '';
    state.parentHierarchyPath.forEach((pId, idx) => {
      const isLast = idx === state.parentHierarchyPath.length - 1;
      const item = document.createElement('span');
      item.className = `breadcrumb-item ${isLast ? 'active' : ''}`;
      item.textContent = pId;
      if (!isLast) {
        item.addEventListener('click', () => {
          state.currentParentSelector = pId;
          state.parentHierarchyPath = state.parentHierarchyPath.slice(0, idx + 1);
          renderBreadcrumbs();
          renderSelectorsList();
        });
      }
      elements.breadcrumbBar.appendChild(item);

      if (!isLast) {
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-sep';
        sep.textContent = '/';
        elements.breadcrumbBar.appendChild(sep);
      }
    });
  }

  async function loadSitemaps() {
    try {
      state.sitemaps = await AppStorage.getAllSitemaps();
    } catch (e) {
      console.error('Failed to load sitemaps:', e);
      state.sitemaps = [];
    }
    renderSitemapsList();
  }

  function renderSitemapsList() {
    const query = (elements.searchSitemapsInput.value || '').toLowerCase().trim();
    const filtered = state.sitemaps.filter(s => {
      const id = (s._id || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      const urls = (Array.isArray(s.startUrl) ? s.startUrl.join(' ') : String(s.startUrl || '')).toLowerCase();
      return id.includes(query) || name.includes(query) || urls.includes(query);
    });

    elements.tbodySitemaps.innerHTML = '';

    if (filtered.length === 0) {
      elements.tbodySitemaps.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
              <div class="empty-state-title">No Sitemaps Found</div>
              <div>Click "Create Sitemap" to start scraping any website!</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(s => {
      const tr = document.createElement('tr');
      const startUrlsList = Array.isArray(s.startUrl) ? s.startUrl : [s.startUrl];
      const selectorsCount = Array.isArray(s.selectors) ? s.selectors.length : 0;
      const modifiedDate = s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : '-';

      tr.innerHTML = `
        <td>
          <a href="#" class="sitemap-open-link" style="font-weight:600; color:#38bdf8; text-decoration:none;">
            ${escapeHtml(s.name || s._id)}
          </a>
          <div style="font-size:11px; color:#64748b;">${escapeHtml(s._id)}</div>
        </td>
        <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(startUrlsList.join('\n'))}">
          ${escapeHtml(startUrlsList[0] || '')} ${startUrlsList.length > 1 ? `<span class="badge" style="background:#1e293b; color:#94a3b8;">+${startUrlsList.length - 1}</span>` : ''}
        </td>
        <td>
          <span class="badge" style="background:rgba(13,148,136,0.2); color:#2dd4bf;">${selectorsCount} selectors</span>
        </td>
        <td style="color:#94a3b8; font-size:11px;">${modifiedDate}</td>
        <td style="text-align:right;">
          <div style="display:inline-flex; gap:4px;">
            <button class="btn btn-secondary btn-sm action-open" title="Open Selectors">Open</button>
            <button class="btn btn-primary btn-sm action-scrape" title="Scrape Sitemap">Scrape</button>
            <button class="btn btn-secondary btn-sm action-browse" title="Browse Data">Data</button>
            <button class="btn btn-secondary btn-sm action-clone" title="Clone Sitemap">Clone</button>
            <button class="btn btn-danger btn-sm action-delete" title="Delete Sitemap">Delete</button>
          </div>
        </td>
      `;

      // Event handlers
      tr.querySelector('.sitemap-open-link').addEventListener('click', (e) => {
        e.preventDefault();
        openSitemap(s._id, 'selectors');
      });
      tr.querySelector('.action-open').addEventListener('click', () => openSitemap(s._id, 'selectors'));
      tr.querySelector('.action-scrape').addEventListener('click', () => openSitemap(s._id, 'scrape'));
      tr.querySelector('.action-browse').addEventListener('click', () => openSitemap(s._id, 'browse-data'));
      tr.querySelector('.action-clone').addEventListener('click', () => cloneSitemap(s._id));
      tr.querySelector('.action-delete').addEventListener('click', () => deleteSitemapDirect(s._id));

      elements.tbodySitemaps.appendChild(tr);
    });
  }

  async function openSitemap(sitemapId, targetView = 'selectors') {
    const rawData = await AppStorage.getSitemap(sitemapId);
    if (!rawData) {
      alert('Sitemap not found: ' + sitemapId);
      switchView('sitemaps');
      return;
    }

    state.currentSitemap = new Sitemap(rawData);
    state.currentParentSelector = '_root';
    state.parentHierarchyPath = ['_root'];

    elements.dropdownCurrentSitemap.style.display = 'inline-block';
    elements.navCurrentSitemapTitle.textContent = state.currentSitemap.name || state.currentSitemap._id;

    if (targetView === 'browse-data') {
      openBrowseData();
    } else {
      switchView(targetView);
    }
  }

  function renderSelectorsList() {
    if (!state.currentSitemap) return;

    elements.selectorsViewTitle.textContent = `Selectors in "${state.currentParentSelector}"`;

    const selectorsInLevel = state.currentSitemap.getDirectChildSelectors(state.currentParentSelector);
    elements.tbodySelectors.innerHTML = '';

    if (selectorsInLevel.length === 0) {
      elements.tbodySelectors.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              <div class="empty-state-title">No Selectors in "${state.currentParentSelector}"</div>
              <div>Click "Add new selector" to extract fields or navigate sub-pages.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    selectorsInLevel.forEach(sel => {
      const tr = document.createElement('tr');
      const typeMeta = Selector.SELECTOR_TYPES[sel.type] || Selector.SELECTOR_TYPES.SelectorText;
      const typeBadgeClass = getTypeBadgeClass(sel.type);

      const hasChildren = state.currentSitemap.getDirectChildSelectors(sel.id).length > 0;
      const canHaveChildren = sel.acceptsChildren || typeMeta.acceptsChildren;

      tr.innerHTML = `
        <td>
          <a href="#" class="selector-id-link" style="font-weight:600; color:#38bdf8; text-decoration:none;">
            ${escapeHtml(sel.id)}
          </a>
        </td>
        <td style="font-family:var(--font-mono); font-size:11px; color:#94a3b8; max-width:240px; overflow:hidden; text-overflow:ellipsis;">
          ${escapeHtml(sel.selector || '-')}
        </td>
        <td>
          <span class="badge ${typeBadgeClass}">${typeMeta.title}</span>
        </td>
        <td>
          <span style="color:${sel.multiple ? '#34d399' : '#64748b'}; font-weight:600;">
            ${sel.multiple ? 'true' : 'false'}
          </span>
        </td>
        <td style="font-size:11px; color:#94a3b8;">
          ${escapeHtml(sel.parentSelectors.join(', '))}
        </td>
        <td style="text-align:right;">
          <div style="display:inline-flex; gap:4px;">
            ${canHaveChildren ? `
              <button class="btn btn-secondary btn-sm action-children" title="Open Child Selectors">
                <span class="icon-chevron-right"></span>
                <span>Select (${state.currentSitemap.getDirectChildSelectors(sel.id).length})</span>
              </button>
            ` : ''}
            <button class="btn btn-secondary btn-sm action-edit" title="Edit Selector">Edit</button>
            <button class="btn btn-danger btn-sm action-delete" title="Delete Selector">Delete</button>
          </div>
        </td>
      `;

      // Event handlers
      tr.querySelector('.selector-id-link').addEventListener('click', (e) => {
        e.preventDefault();
        openEditSelector(sel.id);
      });
      tr.querySelector('.action-edit').addEventListener('click', () => openEditSelector(sel.id));
      tr.querySelector('.action-delete').addEventListener('click', () => deleteSelector(sel.id));

      const childrenBtn = tr.querySelector('.action-children');
      if (childrenBtn) {
        childrenBtn.addEventListener('click', () => {
          state.currentParentSelector = sel.id;
          state.parentHierarchyPath.push(sel.id);
          renderBreadcrumbs();
          renderSelectorsList();
        });
      }

      elements.tbodySelectors.appendChild(tr);
    });
  }

  function getTypeBadgeClass(type) {
    switch (type) {
      case 'SelectorText': return 'badge-text';
      case 'SelectorLink': return 'badge-link';
      case 'SelectorPopupLink': return 'badge-link';
      case 'SelectorImage': return 'badge-image';
      case 'SelectorTable': return 'badge-table';
      case 'SelectorElement': return 'badge-element';
      case 'SelectorElementAttribute': return 'badge-attr';
      case 'SelectorHTML': return 'badge-html';
      case 'SelectorGrouped': return 'badge-attr';
      case 'SelectorPagination': return 'badge-page';
      case 'SelectorElementClick': return 'badge-click';
      case 'SelectorElementScroll': return 'badge-scroll';
      default: return 'badge-text';
    }
  }

  function bindFormEvents() {
    // Selector Type Change
    elements.fieldSelectorType.addEventListener('change', (e) => {
      onSelectorTypeChanged(e.target.value);
    });

    // Selector Edit Form Submit
    elements.formSelectorEdit.addEventListener('submit', (e) => {
      e.preventDefault();
      saveSelectorForm();
    });

    const btnSaveSelector = document.getElementById('btn-save-selector');
    if (btnSaveSelector) {
      btnSaveSelector.addEventListener('click', (e) => {
        e.preventDefault();
        saveSelectorForm();
      });
    }

    document.getElementById('btn-cancel-selector-edit').addEventListener('click', () => {
      switchView('selectors');
    });

    // Sitemap Meta Form Submit
    elements.formSitemapMeta.addEventListener('submit', (e) => {
      e.preventDefault();
      saveSitemapMetaForm();
    });

    if (elements.btnSaveSitemapMeta) {
      elements.btnSaveSitemapMeta.addEventListener('click', (e) => {
        e.preventDefault();
        saveSitemapMetaForm();
      });
    }

    document.getElementById('btn-cancel-sitemap-meta').addEventListener('click', () => {
      if (state.currentSitemap) {
        switchView('selectors');
      } else {
        switchView('sitemaps');
      }
    });

    // Sitemap Import Form
    elements.formSitemapImport.addEventListener('submit', (e) => {
      e.preventDefault();
      importSitemapForm();
    });

    const btnSubmitImport = document.getElementById('btn-submit-sitemap-import');
    if (btnSubmitImport) {
      btnSubmitImport.addEventListener('click', (e) => {
        e.preventDefault();
        importSitemapForm();
      });
    }

    document.getElementById('btn-cancel-sitemap-import').addEventListener('click', () => {
      switchView('sitemaps');
    });

    document.getElementById('btn-load-json-file').addEventListener('click', () => {
      elements.fileImportJson.click();
    });

    elements.fileImportJson.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          elements.fieldImportJson.value = evt.target.result;
        };
        reader.readAsText(file);
      }
    });

    // Sitemap Export View buttons
    document.getElementById('btn-copy-sitemap-json').addEventListener('click', () => {
      elements.fieldExportJson.select();
      navigator.clipboard.writeText(elements.fieldExportJson.value);
      alert('Sitemap JSON copied to clipboard!');
    });

    document.getElementById('btn-download-sitemap-json').addEventListener('click', () => {
      if (state.currentSitemap) {
        Exporter.downloadSitemapJSON(state.currentSitemap.toJSON(), state.currentSitemap.name);
      }
    });

    // Selector Picker Buttons
    document.getElementById('btn-picker-select').addEventListener('click', () => {
      launchElementPicker('select');
    });
    document.getElementById('btn-picker-preview').addEventListener('click', () => {
      launchElementPicker('preview');
    });
    document.getElementById('btn-picker-data-preview').addEventListener('click', () => {
      launchElementPicker('data-preview');
    });
  }

  function onSelectorTypeChanged(type) {
    const meta = Selector.SELECTOR_TYPES[type] || Selector.SELECTOR_TYPES.SelectorText;
    elements.fieldSelectorTypeDesc.textContent = meta.description;

    // Hide all type option divs
    document.querySelectorAll('.type-options').forEach(el => el.style.display = 'none');

    // Toggle specific option panels
    if (type === 'SelectorLink') elements.optLink.style.display = 'block';
    else if (type === 'SelectorImage') elements.optImage.style.display = 'block';
    else if (type === 'SelectorTable') elements.optTable.style.display = 'block';
    else if (type === 'SelectorElementAttribute') elements.optAttribute.style.display = 'block';
    else if (type === 'SelectorHTML') elements.optHtml.style.display = 'block';
    else if (type === 'SelectorGrouped') elements.optGrouped.style.display = 'block';
    else if (type === 'SelectorPagination') elements.optPagination.style.display = 'block';
    else if (type === 'SelectorElementClick') elements.optClick.style.display = 'block';
    else if (type === 'SelectorElementScroll') elements.optScroll.style.display = 'block';

    // Default multiple checkboxes
    if (type === 'SelectorElement' || type === 'SelectorTable' || type === 'SelectorPagination' || type === 'SelectorElementClick' || type === 'SelectorElementScroll') {
      elements.fieldSelectorMultiple.checked = true;
    }
  }

  function openAddSelector() {
    state.editingSelectorId = null;
    if (elements.selectorEditError) {
      elements.selectorEditError.style.display = 'none';
      elements.selectorEditError.textContent = '';
    }
    elements.selectorEditTitle.textContent = `Add Selector in "${state.currentParentSelector}"`;
    elements.formSelectorEdit.reset();

    elements.fieldSelectorType.value = 'SelectorText';
    onSelectorTypeChanged('SelectorText');
    elements.fieldSelectorMultiple.checked = false;

    renderParentSelectorsCheckboxes([state.currentParentSelector]);
    switchView('selector-edit');
  }

  function openEditSelector(selectorId) {
    const sel = state.currentSitemap.getSelectorById(selectorId);
    if (!sel) return;

    state.editingSelectorId = selectorId;
    if (elements.selectorEditError) {
      elements.selectorEditError.style.display = 'none';
      elements.selectorEditError.textContent = '';
    }
    elements.selectorEditTitle.textContent = `Edit Selector "${sel.id}"`;

    elements.fieldSelectorId.value = sel.id;
    elements.fieldSelectorType.value = sel.type;
    onSelectorTypeChanged(sel.type);

    elements.fieldSelectorCss.value = sel.selector || '';
    elements.fieldSelectorMultiple.checked = sel.multiple === true;
    elements.fieldSelectorRegex.value = sel.regex || '';
    elements.fieldSelectorDelay.value = sel.delay || 0;

    // Type specific fields
    if (sel.type === 'SelectorLink') elements.fieldLinkType.value = sel.linkType || 'linkFromHref';
    else if (sel.type === 'SelectorImage') elements.fieldImageDownload.checked = sel.downloadImage === true;
    else if (sel.type === 'SelectorTable') {
      elements.fieldTableHeaderSel.value = sel.tableHeaderRowSelector || 'thead tr, tr:first-child';
      elements.fieldTableDataSel.value = sel.tableDataRowSelector || 'tbody tr, tr:not(:first-child)';
    } else if (sel.type === 'SelectorElementAttribute') elements.fieldExtractAttribute.value = sel.extractAttribute || 'href';
    else if (sel.type === 'SelectorHTML') elements.fieldHtmlOuter.checked = sel.outerHTML === true;
    else if (sel.type === 'SelectorGrouped') elements.fieldGroupedDelimiter.value = sel.delimiter !== undefined ? sel.delimiter : ', ';
    else if (sel.type === 'SelectorPagination') {
      elements.fieldPaginationType.value = sel.paginationType || 'link';
      elements.fieldPaginationMax.value = sel.maxPages || 0;
    } else if (sel.type === 'SelectorElementClick') {
      elements.fieldClickElementSel.value = sel.clickElementSelector || '';
      elements.fieldClickType.value = sel.clickType || 'clickMore';
      elements.fieldClickDelay.value = sel.clickDelay || 1000;
      elements.fieldClickDiscardInitial.checked = sel.discardInitialElements === true;
    } else if (sel.type === 'SelectorElementScroll') {
      elements.fieldScrollElementSel.value = sel.scrollElementSelector || '';
      elements.fieldScrollDelay.value = sel.scrollDelay || 1000;
      elements.fieldScrollMax.value = sel.maxScrolls || 20;
    }

    renderParentSelectorsCheckboxes(sel.parentSelectors);
    switchView('selector-edit');
  }

  function renderParentSelectorsCheckboxes(selectedParents = ['_root']) {
    elements.parentSelectorsList.innerHTML = '';

    const allIds = state.currentSitemap.getAllSelectorIds();
    allIds.forEach(id => {
      if (state.editingSelectorId && id === state.editingSelectorId && elements.fieldSelectorType.value !== 'SelectorPagination' && elements.fieldSelectorType.value !== 'SelectorLink') {
        return;
      }

      const label = document.createElement('label');
      label.className = 'form-checkbox-label';
      label.style.display = 'flex';
      label.style.marginBottom = '4px';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.value = id;
      chk.checked = selectedParents.includes(id);

      const span = document.createElement('span');
      span.textContent = id;
      span.style.fontFamily = id === '_root' ? 'sans-serif' : 'var(--font-mono)';
      span.style.fontWeight = id === '_root' ? '600' : 'normal';

      label.appendChild(chk);
      label.appendChild(span);
      elements.parentSelectorsList.appendChild(label);
    });
  }

  async function saveSelectorForm() {
    if (elements.selectorEditError) {
      elements.selectorEditError.style.display = 'none';
      elements.selectorEditError.textContent = '';
    }

    const parentCheckboxes = Array.from(elements.parentSelectorsList.querySelectorAll('input[type="checkbox"]:checked'));
    const parentSelectors = parentCheckboxes.map(c => c.value);

    if (parentSelectors.length === 0) {
      showSelectorError('Please select at least one parent selector (e.g. _root).');
      return;
    }

    const rawId = elements.fieldSelectorId.value.trim();
    if (!rawId) {
      showSelectorError('Selector ID is required.');
      return;
    }

    const selData = {
      id: rawId,
      type: elements.fieldSelectorType.value,
      selector: elements.fieldSelectorCss.value.trim(),
      multiple: elements.fieldSelectorMultiple.checked,
      parentSelectors: parentSelectors,
      regex: elements.fieldSelectorRegex.value.trim(),
      delay: parseInt(elements.fieldSelectorDelay.value, 10) || 0
    };

    // Type options
    if (selData.type === 'SelectorLink') selData.linkType = elements.fieldLinkType.value;
    else if (selData.type === 'SelectorImage') selData.downloadImage = elements.fieldImageDownload.checked;
    else if (selData.type === 'SelectorTable') {
      selData.tableHeaderRowSelector = elements.fieldTableHeaderSel.value.trim();
      selData.tableDataRowSelector = elements.fieldTableDataSel.value.trim();
    } else if (selData.type === 'SelectorElementAttribute') selData.extractAttribute = elements.fieldExtractAttribute.value.trim();
    else if (selData.type === 'SelectorHTML') selData.outerHTML = elements.fieldHtmlOuter.checked;
    else if (selData.type === 'SelectorGrouped') selData.delimiter = elements.fieldGroupedDelimiter.value;
    else if (selData.type === 'SelectorPagination') {
      selData.paginationType = elements.fieldPaginationType.value;
      selData.maxPages = parseInt(elements.fieldPaginationMax.value, 10) || 0;
    } else if (selData.type === 'SelectorElementClick') {
      selData.clickElementSelector = elements.fieldClickElementSel.value.trim();
      selData.clickType = elements.fieldClickType.value;
      selData.clickDelay = parseInt(elements.fieldClickDelay.value, 10) || 1000;
      selData.discardInitialElements = elements.fieldClickDiscardInitial.checked;
    } else if (selData.type === 'SelectorElementScroll') {
      selData.scrollElementSelector = elements.fieldScrollElementSel.value.trim();
      selData.scrollDelay = parseInt(elements.fieldScrollDelay.value, 10) || 1000;
      selData.maxScrolls = parseInt(elements.fieldScrollMax.value, 10) || 20;
    }

    const selectorInstance = new Selector(selData);
    const validation = selectorInstance.validate();
    if (!validation.isValid) {
      showSelectorError(validation.errors.join(' '));
      return;
    }

    // If ID was changed during edit, clean old selector
    if (state.editingSelectorId && state.editingSelectorId !== selData.id) {
      state.currentSitemap.removeSelector(state.editingSelectorId);
    }

    state.currentSitemap.addSelector(selectorInstance);
    await AppStorage.saveSitemap(state.currentSitemap);
    await loadSitemaps();

    switchView('selectors');
  }

  function showSelectorError(msg) {
    if (elements.selectorEditError) {
      elements.selectorEditError.textContent = msg;
      elements.selectorEditError.style.display = 'block';
    } else {
      alert(msg);
    }
  }

  async function deleteSelector(selectorId) {
    if (!confirm(`Are you sure you want to delete selector "${selectorId}" and its child links?`)) {
      return;
    }

    state.currentSitemap.removeSelector(selectorId);
    await AppStorage.saveSitemap(state.currentSitemap);
    renderSelectorsList();
  }

  function getTargetTabId(callback) {
    // 1. If running inside DevTools panel, inspectedWindow.tabId is the exact inspected tab!
    if (typeof chrome !== 'undefined' && chrome.devtools && chrome.devtools.inspectedWindow && chrome.devtools.inspectedWindow.tabId) {
      callback(chrome.devtools.inspectedWindow.tabId);
      return;
    }

    // 2. If running in normal browser window / popup / dashboard tab:
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!chrome.runtime.lastError && tabs && tabs.length > 0 && tabs[0].id) {
          callback(tabs[0].id);
          return;
        }

        // Fallback to active tab in last focused window
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (fallbackTabs) => {
          if (!chrome.runtime.lastError && fallbackTabs && fallbackTabs.length > 0 && fallbackTabs[0].id) {
            callback(fallbackTabs[0].id);
          } else {
            callback(null);
          }
        });
      });
      return;
    }

    callback(null);
  }

  function launchElementPicker(mode) {
    const selStr = elements.fieldSelectorCss.value.trim();
    const selType = elements.fieldSelectorType.value;
    const isMult = elements.fieldSelectorMultiple.checked;

    // Check if running in Chrome extension environment
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
      getTargetTabId((tabId) => {
        if (!tabId) {
          alert('No active webpage tab found to select elements from. Please open a webpage in Chrome.');
          return;
        }

        chrome.tabs.get(tabId, (tabInfo) => {
          if (chrome.runtime.lastError || !tabInfo) {
            console.warn('Target tab does not exist or was closed:', chrome.runtime.lastError?.message);
            alert('Target webpage tab was closed or is not accessible.');
            return;
          }

          if (tabInfo.url && (tabInfo.url.startsWith('chrome://') || tabInfo.url.startsWith('edge://') || tabInfo.url.startsWith('chrome-extension://') || tabInfo.url.startsWith('about:'))) {
            alert('Cannot select elements on browser system pages (chrome://). Please navigate to a standard website (http:// or https://).');
            return;
          }

          // Inject picker scripts
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content/selector_picker.js']
          }, () => {
            if (chrome.runtime.lastError) {
              console.warn('Script injection error:', chrome.runtime.lastError.message);
              alert('Could not attach selector tool to this page: ' + chrome.runtime.lastError.message);
              return;
            }

            chrome.scripting.insertCSS({
              target: { tabId: tabId },
              files: ['content/selector_picker.css']
            }, () => {
              if (chrome.runtime.lastError) {
                console.warn('CSS injection warning:', chrome.runtime.lastError.message);
              }

              let msgType = 'START_PICKER';
              if (mode === 'preview') msgType = 'ELEMENT_PREVIEW';
              else if (mode === 'data-preview') msgType = 'DATA_PREVIEW';

              chrome.tabs.sendMessage(tabId, {
                type: msgType,
                selector: selStr,
                selectorType: selType,
                multiple: isMult
              }, () => {
                if (chrome.runtime.lastError) {
                  console.warn('Message send warning:', chrome.runtime.lastError.message);
                }
              });
            });
          });
        });
      });
      return;
    }

    // Standalone fallback: simulate picker dialog prompt
    if (mode === 'select') {
      const picked = prompt('Enter CSS selector for elements (e.g. .product-title, div.card, a.link):', selStr || 'h1');
      if (picked !== null) {
        elements.fieldSelectorCss.value = picked.trim();
      }
    } else {
      alert(`Previewing selector "${selStr}". In Chrome Extension mode, elements will highlight directly on the active webpage.`);
    }
  }

  function openCreateSitemapMeta() {
    state.currentSitemap = null;
    if (elements.sitemapMetaError) {
      elements.sitemapMetaError.style.display = 'none';
      elements.sitemapMetaError.textContent = '';
    }
    elements.sitemapMetaTitle.textContent = 'Create New Sitemap';
    elements.btnSaveSitemapMeta.textContent = 'Create Sitemap';
    elements.formSitemapMeta.reset();
    elements.fieldSitemapId.readOnly = false;
    switchView('sitemap-meta');
  }

  function openEditSitemapMeta() {
    if (!state.currentSitemap) return;
    if (elements.sitemapMetaError) {
      elements.sitemapMetaError.style.display = 'none';
      elements.sitemapMetaError.textContent = '';
    }
    elements.sitemapMetaTitle.textContent = `Edit Metadata: ${state.currentSitemap.name || state.currentSitemap._id}`;
    elements.btnSaveSitemapMeta.textContent = 'Save Metadata';
    elements.fieldSitemapId.value = state.currentSitemap.name || state.currentSitemap._id;
    elements.fieldSitemapId.readOnly = false;
    elements.fieldSitemapUrls.value = state.currentSitemap.startUrl.join('\n');
    switchView('sitemap-meta');
  }

  async function saveSitemapMetaForm() {
    if (elements.sitemapMetaError) {
      elements.sitemapMetaError.style.display = 'none';
      elements.sitemapMetaError.textContent = '';
    }

    const rawName = elements.fieldSitemapId.value.trim();
    if (!rawName) {
      showSitemapError('Sitemap name is required.');
      return;
    }

    const urlsRaw = elements.fieldSitemapUrls.value.trim();
    const urls = urlsRaw.split('\n').map(u => u.trim()).filter(Boolean);

    if (urls.length === 0) {
      showSitemapError('At least one Start URL is required.');
      return;
    }

    try {
      if (state.currentSitemap) {
        // Editing existing sitemap metadata
        state.currentSitemap.name = rawName;
        state.currentSitemap.startUrl = urls;
        
        const validation = state.currentSitemap.validate();
        if (!validation.isValid) {
          showSitemapError(validation.errors.join(' '));
          return;
        }

        await AppStorage.saveSitemap(state.currentSitemap);
      } else {
        // Creating new sitemap
        const newSitemap = new Sitemap({
          _id: rawName,
          name: rawName,
          startUrl: urls,
          selectors: []
        });

        const validation = newSitemap.validate();
        if (!validation.isValid) {
          showSitemapError(validation.errors.join(' '));
          return;
        }

        await AppStorage.saveSitemap(newSitemap);
        state.currentSitemap = newSitemap;
      }

      await loadSitemaps();
      openSitemap(state.currentSitemap._id, 'selectors');
    } catch (err) {
      showSitemapError('Error saving sitemap: ' + (err.message || err));
    }
  }

  function showSitemapError(msg) {
    if (elements.sitemapMetaError) {
      elements.sitemapMetaError.textContent = msg;
      elements.sitemapMetaError.style.display = 'block';
    } else {
      alert(msg);
    }
  }

  function openImportSitemap() {
    if (elements.sitemapImportError) {
      elements.sitemapImportError.style.display = 'none';
      elements.sitemapImportError.textContent = '';
    }
    elements.formSitemapImport.reset();
    switchView('sitemap-import');
  }

  async function importSitemapForm() {
    if (elements.sitemapImportError) {
      elements.sitemapImportError.style.display = 'none';
      elements.sitemapImportError.textContent = '';
    }

    const jsonStr = elements.fieldImportJson.value.trim();
    if (!jsonStr) {
      showImportError('Please provide Sitemap JSON.');
      return;
    }

    const nameOverride = elements.fieldImportId.value.trim();

    try {
      const parsed = JSON.parse(jsonStr);
      if (nameOverride) {
        parsed._id = nameOverride;
        parsed.name = nameOverride;
      }

      const sitemap = new Sitemap(parsed);
      const validation = sitemap.validate();
      if (!validation.isValid) {
        showImportError('Invalid Sitemap JSON: ' + validation.errors.join(' '));
        return;
      }

      await AppStorage.saveSitemap(sitemap);
      await loadSitemaps();
      openSitemap(sitemap._id, 'selectors');
    } catch (e) {
      showImportError('JSON Parse Error: ' + e.message);
    }
  }

  function showImportError(msg) {
    if (elements.sitemapImportError) {
      elements.sitemapImportError.textContent = msg;
      elements.sitemapImportError.style.display = 'block';
    } else {
      alert(msg);
    }
  }

  function openExportSitemap() {
    if (!state.currentSitemap) return;
    elements.fieldExportJson.value = JSON.stringify(state.currentSitemap.toJSON(), null, 2);
    switchView('sitemap-export');
  }

  async function cloneSitemap(sitemapId) {
    const original = await AppStorage.getSitemap(sitemapId);
    if (!original) return;

    const newId = `${original._id}_copy`;
    original._id = newId;
    original.name = `${original.name || original._id} (Copy)`;
    await AppStorage.saveSitemap(original);
    await loadSitemaps();
  }

  async function deleteCurrentSitemap() {
    if (!state.currentSitemap) return;
    if (confirm(`Are you sure you want to permanently delete sitemap "${state.currentSitemap.name || state.currentSitemap._id}" and its data?`)) {
      await AppStorage.deleteSitemap(state.currentSitemap._id);
      state.currentSitemap = null;
      elements.dropdownCurrentSitemap.style.display = 'none';
      await loadSitemaps();
      switchView('sitemaps');
    }
  }

  async function deleteSitemapDirect(sitemapId) {
    if (confirm(`Are you sure you want to permanently delete sitemap "${sitemapId}"?`)) {
      await AppStorage.deleteSitemap(sitemapId);
      if (state.currentSitemap && state.currentSitemap._id === sitemapId) {
        state.currentSitemap = null;
        elements.dropdownCurrentSitemap.style.display = 'none';
      }
      await loadSitemaps();
    }
  }

  // SCRAPING RUNTIME CONTROLLER
  function bindScraperEvents() {
    document.getElementById('btn-start-scraping').addEventListener('click', () => startScraping());
    elements.btnScrapePause.addEventListener('click', () => {
      if (state.scraperEngine) state.scraperEngine.pause();
    });
    elements.btnScrapeResume.addEventListener('click', () => {
      if (state.scraperEngine) state.scraperEngine.resume();
    });
    elements.btnScrapeStop.addEventListener('click', () => {
      if (state.scraperEngine) state.scraperEngine.stop();
    });
    document.getElementById('btn-scrape-view-data').addEventListener('click', () => openBrowseData());
  }

  async function startScraping() {
    if (!state.currentSitemap) return;

    const requestInterval = parseInt(document.getElementById('scrape-request-interval').value, 10) || 2000;
    const pageLoadDelay = parseInt(document.getElementById('scrape-page-delay').value, 10) || 2000;
    const maxPages = parseInt(document.getElementById('scrape-max-pages').value, 10) || 0;

    elements.scrapeLogBox.innerHTML = '';
    logScrape('Starting scraper for sitemap: ' + (state.currentSitemap.name || state.currentSitemap._id), 'info');

    // Initialize Scraper Engine
    state.scraperEngine = new ScraperEngine(state.currentSitemap, {
      requestInterval: requestInterval,
      pageLoadDelay: pageLoadDelay,
      maxPages: maxPages,
      fetcher: createTabOrFetchRunner()
    });

    // Event listeners
    state.scraperEngine.on('statusChange', (status) => {
      updateScrapeMonitorStatus(status);
    });

    state.scraperEngine.on('pageStart', (data) => {
      elements.scrapeCurrentUrl.textContent = data.url;
      logScrape(`Visiting [Queue: ${data.queueLength}]: ${data.url}`, 'info');
    });

    state.scraperEngine.on('recordScraped', () => {
      elements.metricRecords.textContent = state.scraperEngine.results.length;
    });

    state.scraperEngine.on('error', (err) => {
      logScrape(`Error: ${err.error || err.message || err}`, 'error');
    });

    state.scraperEngine.on('finish', async (summary) => {
      logScrape(`Scrape finished! Total records: ${summary.totalRecords}, Pages: ${summary.pagesVisited}, Time: ${(summary.elapsedMs/1000).toFixed(1)}s`, 'success');
      await AppStorage.saveScrapedData(state.currentSitemap._id, summary.results);
      openBrowseData();
    });

    // Start timer loop
    startElapsedTimer();

    // Run scraper
    state.scraperEngine.start();
  }

  function createTabOrFetchRunner() {
    // If in Chrome extension environment with chrome.tabs API:
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
      return async (url) => {
        return new Promise((resolve, reject) => {
          chrome.tabs.create({ url: url, active: false }, (tab) => {
            if (chrome.runtime.lastError || !tab) {
              reject(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Failed to create background scraping tab'));
              return;
            }

            const tabId = tab.id;
            let isDone = false;
            let tabClosed = false;

            const cleanup = () => {
              try { chrome.tabs.onUpdated.removeListener(onUpdated); } catch (e) {}
              try { chrome.tabs.onRemoved.removeListener(onRemoved); } catch (e) {}
              if (!tabClosed) {
                chrome.tabs.remove(tabId, () => {
                  if (chrome.runtime.lastError) { /* consume */ }
                });
              }
            };

            const onRemoved = (removedTabId) => {
              if (removedTabId === tabId) {
                tabClosed = true;
                if (!isDone) {
                  isDone = true;
                  cleanup();
                  reject(new Error(`Scraping tab ${tabId} was closed.`));
                }
              }
            };
            chrome.tabs.onRemoved.addListener(onRemoved);

            const extractHtml = () => {
              if (isDone) return;
              isDone = true;
              try { chrome.tabs.onUpdated.removeListener(onUpdated); } catch (e) {}

              setTimeout(() => {
                chrome.scripting.executeScript({
                  target: { tabId: tabId },
                  func: () => document.documentElement.outerHTML
                }, (results) => {
                  const lastErr = chrome.runtime.lastError;
                  cleanup();
                  if (lastErr || !results || !results[0]) {
                    reject(new Error(lastErr ? lastErr.message : 'Failed to extract HTML from tab'));
                    return;
                  }
                  try {
                    const html = results[0].result;
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    resolve({ document: doc, url: url });
                  } catch (err) {
                    reject(err);
                  }
                });
              }, 200);
            };

            const onUpdated = (updatedTabId, changeInfo) => {
              if (updatedTabId === tabId && changeInfo.status === 'complete') {
                extractHtml();
              }
            };

            chrome.tabs.onUpdated.addListener(onUpdated);

            // If the tab already finished loading before the listener attached
            chrome.tabs.get(tabId, (info) => {
              if (!chrome.runtime.lastError && info && info.status === 'complete') {
                extractHtml();
              }
            });
          });
        });
      };
    }

    // Default fetch & DOMParser fallback
    return async (url) => {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      const html = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return { document: doc, url: resp.url || url };
    };
  }

  let timerInterval = null;
  function startElapsedTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const start = Date.now();
    timerInterval = setInterval(() => {
      if (!state.scraperEngine || !state.scraperEngine.isRunning) {
        clearInterval(timerInterval);
        return;
      }
      const secs = Math.floor((Date.now() - start) / 1000);
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      elements.metricTime.textContent = `${m}:${s}`;
    }, 1000);
  }

  function updateScrapeMonitorStatus(status) {
    elements.metricPages.textContent = status.pagesVisited;
    elements.metricRecords.textContent = status.recordsCount;
    elements.metricQueue.textContent = status.queueSize;

    elements.scrapeStatusBadge.textContent = status.state.toUpperCase();
    if (status.state === 'running') {
      elements.scrapeStatusBadge.style.background = 'rgba(16,185,129,0.2)';
      elements.scrapeStatusBadge.style.color = '#34d399';
      elements.btnScrapePause.style.display = 'inline-flex';
      elements.btnScrapeResume.style.display = 'none';
      elements.btnScrapeStop.style.display = 'inline-flex';
    } else if (status.state === 'paused') {
      elements.scrapeStatusBadge.style.background = 'rgba(234,179,8,0.2)';
      elements.scrapeStatusBadge.style.color = '#facc15';
      elements.btnScrapePause.style.display = 'none';
      elements.btnScrapeResume.style.display = 'inline-flex';
      elements.btnScrapeStop.style.display = 'inline-flex';
    } else {
      elements.scrapeStatusBadge.style.background = 'rgba(100,116,139,0.2)';
      elements.scrapeStatusBadge.style.color = '#94a3b8';
      elements.btnScrapePause.style.display = 'none';
      elements.btnScrapeResume.style.display = 'none';
      elements.btnScrapeStop.style.display = 'none';
    }
  }

  function logScrape(msg, level = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${level}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${msg}`;
    elements.scrapeLogBox.appendChild(entry);
    elements.scrapeLogBox.scrollTop = elements.scrapeLogBox.scrollHeight;
  }

  // DATA VIEWER & EXPORT CONTROLLER
  function bindDataViewerEvents() {
    elements.searchDataInput.addEventListener('input', () => {
      state.dataPagination.page = 1;
      filterAndRenderDataTable();
    });

    document.getElementById('btn-refresh-data').addEventListener('click', () => openBrowseData());

    document.getElementById('btn-export-csv-direct').addEventListener('click', () => {
      if (state.currentSitemap && state.scrapedData.length > 0) {
        Exporter.downloadCSV(state.scrapedData, state.currentSitemap.name);
      }
    });

    document.getElementById('btn-export-excel-direct').addEventListener('click', () => {
      if (state.currentSitemap && state.scrapedData.length > 0) {
        Exporter.downloadExcel(state.scrapedData, state.currentSitemap.name);
      }
    });

    document.getElementById('btn-clear-data').addEventListener('click', async () => {
      if (state.currentSitemap && confirm(`Clear all scraped data for "${state.currentSitemap.name || state.currentSitemap._id}"?`)) {
        await AppStorage.clearScrapedData(state.currentSitemap._id);
        openBrowseData();
      }
    });

    elements.btnDataPrevPage.addEventListener('click', () => {
      if (state.dataPagination.page > 1) {
        state.dataPagination.page--;
        renderDataTablePage();
      }
    });

    elements.btnDataNextPage.addEventListener('click', () => {
      const maxPage = Math.ceil(state.filteredData.length / state.dataPagination.pageSize);
      if (state.dataPagination.page < maxPage) {
        state.dataPagination.page++;
        renderDataTablePage();
      }
    });

    // Export View Buttons
    document.getElementById('btn-download-csv').addEventListener('click', () => {
      const delimiter = document.getElementById('export-csv-delimiter').value;
      if (state.currentSitemap && state.scrapedData.length > 0) {
        Exporter.downloadCSV(state.scrapedData, state.currentSitemap.name, delimiter);
      }
    });

    document.getElementById('btn-download-excel').addEventListener('click', () => {
      if (state.currentSitemap && state.scrapedData.length > 0) {
        Exporter.downloadExcel(state.scrapedData, state.currentSitemap.name);
      }
    });

    document.getElementById('btn-download-json').addEventListener('click', () => {
      if (state.currentSitemap && state.scrapedData.length > 0) {
        Exporter.downloadJSON(state.scrapedData, state.currentSitemap.name);
      }
    });
  }

  async function openBrowseData() {
    if (!state.currentSitemap) return;
    try {
      state.scrapedData = await AppStorage.getScrapedData(state.currentSitemap._id);
    } catch (e) {
      console.error('Failed to get scraped data:', e);
      state.scrapedData = [];
    }
    state.dataPagination.page = 1;
    filterAndRenderDataTable();
    switchView('browse-data');
  }

  function filterAndRenderDataTable() {
    const query = (elements.searchDataInput.value || '').toLowerCase().trim();

    if (!query) {
      state.filteredData = [...state.scrapedData];
    } else {
      state.filteredData = state.scrapedData.filter(row => {
        return Object.values(row).some(val => String(val).toLowerCase().includes(query));
      });
    }

    // Sort if column set
    if (state.dataPagination.sortCol) {
      const col = state.dataPagination.sortCol;
      const asc = state.dataPagination.sortAsc;
      state.filteredData.sort((a, b) => {
        const vA = a[col] !== undefined ? a[col] : '';
        const vB = b[col] !== undefined ? b[col] : '';
        if (typeof vA === 'number' && typeof vB === 'number') {
          return asc ? vA - vB : vB - vA;
        }
        return asc ? String(vA).localeCompare(String(vB)) : String(vB).localeCompare(String(vA));
      });
    }

    elements.browseRecordCountBadge.textContent = `${state.scrapedData.length} records`;
    renderDataTablePage();
  }

  function renderDataTablePage() {
    elements.theadScrapedData.innerHTML = '';
    elements.tbodyScrapedData.innerHTML = '';

    if (state.filteredData.length === 0) {
      elements.tbodyScrapedData.innerHTML = `
        <tr>
          <td colspan="10">
            <div class="empty-state">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M12 3v18"/></svg>
              <div class="empty-state-title">No Scraped Data Yet</div>
              <div>Click "Scrape" to start extracting data with this sitemap!</div>
            </div>
          </td>
        </tr>
      `;
      elements.dataPageStart.textContent = '0';
      elements.dataPageEnd.textContent = '0';
      elements.dataPageTotal.textContent = '0';
      elements.dataPageCurrentNum.textContent = 'Page 1';
      return;
    }

    const headers = Object.keys(state.filteredData[0]);

    // Render Table Header
    const trHead = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.className = 'sortable';
      th.textContent = h;
      if (state.dataPagination.sortCol === h) {
        th.textContent += state.dataPagination.sortAsc ? ' ▲' : ' ▼';
      }
      th.addEventListener('click', () => {
        if (state.dataPagination.sortCol === h) {
          state.dataPagination.sortAsc = !state.dataPagination.sortAsc;
        } else {
          state.dataPagination.sortCol = h;
          state.dataPagination.sortAsc = true;
        }
        filterAndRenderDataTable();
      });
      trHead.appendChild(th);
    });
    elements.theadScrapedData.appendChild(trHead);

    // Paginate rows
    const pageSize = state.dataPagination.pageSize;
    const page = state.dataPagination.page;
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, state.filteredData.length);
    const pageRows = state.filteredData.slice(startIndex, endIndex);

    pageRows.forEach(row => {
      const tr = document.createElement('tr');
      headers.forEach(h => {
        const td = document.createElement('td');
        const val = row[h] !== undefined ? row[h] : '';
        td.textContent = String(val);
        td.title = String(val);
        tr.appendChild(td);
      });
      elements.tbodyScrapedData.appendChild(tr);
    });

    // Update pagination labels
    elements.dataPageStart.textContent = startIndex + 1;
    elements.dataPageEnd.textContent = endIndex;
    elements.dataPageTotal.textContent = state.filteredData.length;
    elements.dataPageCurrentNum.textContent = `Page ${page} of ${Math.ceil(state.filteredData.length / pageSize)}`;
  }

  // SELECTOR HIERARCHY GRAPH
  function renderSelectorGraph() {
    if (!state.currentSitemap || !elements.graphContainer) return;
    const graph = new SelectorGraph(elements.graphContainer, state.currentSitemap, {
      onNodeClick: (selId) => {
        openEditSelector(selId);
      }
    });
    graph.render();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Initialize App on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
