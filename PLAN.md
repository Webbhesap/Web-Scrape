# 🕷️ Ultimate Web Scraper Chrome Extension - AI Coding Agent Prompt

```text
# =============================================================================
# ULTIMATE WEB SCRAPER PRO - CHROME/EDGE EXTENSION
# AI Coding Agent Master Prompt
# =============================================================================
# Bu prompt, bir AI Coding Agent'ın tam otonom şekilde çalışarak kapsamlı bir
# web scraping Chrome/Edge eklentisi geliştirmesini sağlar.
# Agent her fazı kendi başına tamamlar, testlerini yapar ve devam eder.
# =============================================================================
```

## 🎯 PROJE TANIMI

Sen bir Senior Full-Stack Developer ve Chrome Extension uzmanısın. Görevin,
HTML + CSS + Vanilla JavaScript ile (npm/vite/derleme OLMADAN) çalışan,
kapsamlı bir Web Scraper Chrome/Edge eklentisi geliştirmek.

**KRİTİK KURALLAR:**
1. Hiçbir fazda durup onay BEKLEME. Bir faz bitince teste al, test geçerse sonraki faza geç.
2. "Şu yok, yapamadım, bu kütüphane eksik" DEME. Çözüm bul, alternatif kullan, inline yaz.
3. Her fazda Chromium/Chrome'a extension'ı yükle, Playwright + manuel smoke test yap.
4. Aklına gelen ama prompt'ta yazılmamış her özelliği de EKLE.
5. Tüm kütüphaneler CDN üzerinden yüklenecek (npm/vite/webpack YASAK).
6. Manifest V3 kullan.
7. Her dosyanın başına açıklayıcı Türkçe yorum ekle.
8. Her Faz sonunda testlerden sonra hata yoksa github dosyalarını güncelle.

---

## 📁 PROJE YAPISI

Aşağıdaki dosya/klasör yapısını AYNEN oluştur:

```
web-scraper-pro/
├── manifest.json
├── package.json                    # Sadece test bağımlılıkları için
│
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon-grayscale-128.png     # Deaktif durum ikonu
│
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
│
├── sidepanel/
│   ├── sidepanel.html
│   ├── sidepanel.css
│   └── sidepanel.js
│
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
│
├── content/
│   ├── content.js                 # Ana content script
│   ├── content.css                # Overlay ve highlight stilleri
│   ├── element-picker.js          # Görsel element seçici
│   ├── table-extractor.js         # Tablo kazıma modülü
│   ├── media-extractor.js         # Resim/video/ses kazıma
│   ├── link-extractor.js          # Link kazıma modülü
│   ├── text-extractor.js          # Metin kazıma modülü
│   ├── form-extractor.js          # Form verisi kazıma
│   ├── meta-extractor.js          # Meta tag ve SEO verisi kazıma
│   ├── style-extractor.js         # CSS/Font/Renk kazıma
│   ├── schema-extractor.js        # JSON-LD / Microdata kazıma
│   ├── dom-monitor.js             # DOM değişiklik izleme
│   ├── infinite-scroll-handler.js # Sonsuz kaydırma yönetimi
│   ├── pagination-handler.js      # Sayfalama yönetimi
│   ├── lazy-load-handler.js       # Lazy load tetikleme
│   └── shadow-dom-handler.js      # Shadow DOM erişimi
│
├── background/
│   ├── service-worker.js          # Ana service worker
│   ├── download-manager.js        # İndirme yöneticisi
│   ├── scheduler.js               # Zamanlanmış görevler
│   ├── storage-manager.js         # Depolama yöneticisi
│   ├── network-interceptor.js     # Ağ isteklerini izleme
│   ├── tab-manager.js             # Sekme yönetimi
│   └── notification-manager.js    # Bildirim yönetimi
│
├── utils/
│   ├── export-csv.js
│   ├── export-json.js
│   ├── export-xlsx.js
│   ├── export-xml.js
│   ├── export-html.js
│   ├── export-markdown.js
│   ├── export-pdf.js
│   ├── export-yaml.js
│   ├── export-sql.js
│   ├── export-clipboard.js
│   ├── data-cleaner.js            # Veri temizleme
│   ├── data-transformer.js        # Veri dönüştürme
│   ├── data-deduplicator.js       # Tekrar eden veri silme
│   ├── data-validator.js          # Veri doğrulama
│   ├── selector-engine.js         # CSS/XPath selector engine
│   ├── regex-helper.js            # Regex yardımcıları
│   ├── url-helper.js              # URL işleme yardımcıları
│   ├── date-helper.js             # Tarih işleme
│   ├── crypto-helper.js           # Hash ve şifreleme
│   ├── compression-helper.js      # Veri sıkıştırma
│   ├── i18n-helper.js             # Çoklu dil desteği
│   ├── accessibility-helper.js    # Erişilebilirlik
│   ├── performance-helper.js      # Performans ölçüm
│   └── error-handler.js           # Global hata yönetimi
│
├── templates/
│   ├── recipe-templates.json      # Hazır kazıma şablonları
│   ├── site-configs.json          # Site bazlı konfigürasyonlar
│   └── selector-presets.json      # Önceden tanımlı seçiciler
│
├── libs/                          # CDN yedekleri (offline kullanım)
│   ├── xlsx.min.js
│   ├── jspdf.min.js
│   ├── turndown.min.js
│   ├── jszip.min.js
│   ├── dayjs.min.js
│   ├── dompurify.min.js
│   ├── js-yaml.min.js
│   ├── sql-formatter.min.js
│   ├── chart.min.js
│   ├── lz-string.min.js
│   └── readability.min.js
│
├── _locales/
│   ├── tr/messages.json
│   ├── en/messages.json
│
├── tests/
│   ├── setup.js                   # Test ortamı kurulumu
│   ├── install-browsers.js        # Chromium kurulum scripti
│   ├── smoke.spec.js              # Smoke testleri
│   ├── unit/
│   │   ├── export-csv.test.js
│   │   ├── export-json.test.js
│   │   ├── export-xlsx.test.js
│   │   ├── data-cleaner.test.js
│   │   ├── data-transformer.test.js
│   │   ├── selector-engine.test.js
│   │   ├── url-helper.test.js
│   │   ├── regex-helper.test.js
│   │   └── storage-manager.test.js
│   ├── integration/
│   │   ├── popup.test.js
│   │   ├── sidepanel.test.js
│   │   ├── content-script.test.js
│   │   ├── element-picker.test.js
│   │   ├── table-extractor.test.js
│   │   ├── media-extractor.test.js
│   │   ├── download-manager.test.js
│   │   ├── scheduler.test.js
│   │   └── pagination.test.js
│   ├── e2e/
│   │   ├── full-workflow.test.js
│   │   ├── export-all-formats.test.js
│   │   ├── multi-page-scrape.test.js
│   │   ├── slideshow.test.js
│   │   ├── dark-mode.test.js
│   │   ├── keyboard-shortcuts.test.js
│   │   └── performance.test.js
│   └── fixtures/
│       ├── test-page-tables.html
│       ├── test-page-images.html
│       ├── test-page-links.html
│       ├── test-page-forms.html
│       ├── test-page-infinite-scroll.html
│       ├── test-page-lazy-load.html
│       ├── test-page-shadow-dom.html
│       ├── test-page-spa.html
│       ├── test-page-pagination.html
│       └── test-data.json
│
├── docs/
│   ├── README.md
│   ├── CHANGELOG.md
│   ├── CONTRIBUTING.md
│   ├── PRIVACY.md
│   ├── USER-GUIDE.md
│   └── API.md
│
├── .eslintrc.json
├── .prettierrc
├── playwright.config.js
├── jest.config.js
└── LICENSE
```

---

## 🔧 FAZ 1: TEMEL ALTYAPI VE MANIFEST

### Görevler:

#### 1.1 - manifest.json (Manifest V3)
```json
{
  "manifest_version": 3,
  "name": "__MSG_extensionName__",
  "version": "1.0.0",
  "description": "__MSG_extensionDescription__",
  "default_locale": "en",
  "minimum_chrome_version": "110",

  "permissions": [
    "activeTab",
    "storage",
    "unlimitedStorage",
    "downloads",
    "tabs",
    "scripting",
    "contextMenus",
    "notifications",
    "alarms",
    "clipboardWrite",
    "clipboardRead",
    "sidePanel",
    "offscreen",
    "webNavigation",
    "declarativeNetRequest"
  ],

  "optional_permissions": [
    "bookmarks",
    "history",
    "topSites"
  ],

  "host_permissions": [
    "<all_urls>"
  ],

  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },

  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    "default_title": "Web Scraper Pro"
  },

  "side_panel": {
    "default_path": "sidepanel/sidepanel.html"
  },

  "options_page": "options/options.html",
  "options_ui": {
    "page": "options/options.html",
    "open_in_tab": true
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": [
        "content/content.js"
      ],
      "css": [
        "content/content.css"
      ],
      "run_at": "document_idle",
      "all_frames": true
    }
  ],

  "web_accessible_resources": [
    {
      "resources": [
        "libs/*",
        "templates/*",
        "icons/*",
        "content/*.js",
        "content/*.css"
      ],
      "matches": ["<all_urls>"]
    }
  ],

  "commands": {
    "_execute_action": {
      "suggested_key": {
        "default": "Ctrl+Shift+S",
        "mac": "Command+Shift+S"
      },
      "description": "__MSG_commandOpenPopup__"
    },
    "toggle-element-picker": {
      "suggested_key": {
        "default": "Ctrl+Shift+E",
        "mac": "Command+Shift+E"
      },
      "description": "__MSG_commandElementPicker__"
    },
    "quick-scrape": {
      "suggested_key": {
        "default": "Ctrl+Shift+Q",
        "mac": "Command+Shift+Q"
      },
      "description": "__MSG_commandQuickScrape__"
    },
    "screenshot-page": {
      "suggested_key": {
        "default": "Ctrl+Shift+P",
        "mac": "Command+Shift+P"
      },
      "description": "__MSG_commandScreenshot__"
    }
  },

  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

#### 1.2 - İkon Oluşturma
- Canvas API kullanarak programatik olarak tüm boyutlarda ikonlar OLUŞTUR
- SVG'den PNG'ye çevir
- Grayscale versiyon da oluştur (deaktif durum için)
- İkonlarda örümcek ağı veya veri kazıma temalı tasarım kullan

#### 1.3 - Temel Service Worker (background/service-worker.js)
```javascript
// Service worker'da şunları implemente et:

// 1. Extension kurulum ve güncelleme yönetimi
chrome.runtime.onInstalled.addListener((details) => {
  // İlk kurulumda:
  // - Varsayılan ayarları storage'a yaz
  // - Hoş geldin sayfası aç (options sayfası)
  // - Context menü öğelerini oluştur
  // - Örnek şablonları yükle

  // Güncellemede:
  // - Changelog göster
  // - Migration işlemlerini çalıştır
  // - Eski verileri yeni formata dönüştür
});

// 2. Context Menu oluşturma
// - "Sayfayı Kazı" (tüm sayfa)
// - "Seçili Alanı Kazı" (seçili metin/element)
// - "Bu Tablodaki Verileri Çıkar"
// - "Tüm Resimleri İndir"
// - "Tüm Linkleri Çıkar"
// - "Sayfa Kaynağını Görüntüle"
// - "Element Seçiciyi Aç"
// - "Sayfanın Ekran Görüntüsünü Al"
// - "Bu Siteyi İzlemeye Al"
// - "Hızlı Kazıma Şablonları" (alt menü)
//   - "Amazon Ürün Bilgileri"
//   - "Haber Makalesi"
//   - "Sosyal Medya Profili"
//   - "E-ticaret Ürün Listesi"
//   - "İş İlanı"
//   - "Restoran/Yemek Bilgileri"
//   - "Emlak İlanı"
//   - "Özel Şablon..."

// 3. Message routing (popup, content, sidepanel arası)
// 4. Tab event yönetimi
// 5. Alarm (zamanlanmış görev) yönetimi
// 6. Download yönetimi
// 7. Badge güncelleme (bulunan veri sayısını göster)
// 8. Keyboard shortcut yönetimi
// 9. Side panel yönetimi
// 10. Offscreen document yönetimi (ağır işler için)
```

#### 1.4 - Storage Manager (background/storage-manager.js)
```javascript
// Implement storage manager with:
// - chrome.storage.local (büyük veriler)
// - chrome.storage.sync (ayarlar, senkronize)
// - chrome.storage.session (geçici veriler)
// - IndexedDB fallback (5MB+ veriler için)
// - LRU cache mekanizması
// - Veri sıkıştırma (lz-string kullanarak)
// - Otomatik temizleme (eski verileri sil)
// - Import/Export (tüm verileri JSON olarak)
// - Storage kullanım istatistikleri
// - Veri şifreleme (hassas veriler için)
// - Batch okuma/yazma
// - Change listener (veri değişikliklerini dinle)
```

#### 1.5 - i18n Dosyaları
Her dil için `_locales/{lang}/messages.json` oluştur. Şu diller:
- Türkçe (tr) - varsayılan
- English (en)

Her dil dosyasında EN AZ 150 mesaj anahtarı olacak (tüm UI metinleri).

### FAZ 1 TESTLERİ:
```bash
# 1. Chromium kur
npx playwright install chromium

# 2. Extension'ı yükle ve manifest'i doğrula
# 3. Service worker'ın aktif olduğunu kontrol et
# 4. Context menülerin oluşturulduğunu kontrol et
# 5. Storage'ın çalıştığını kontrol et
# 6. İkonların doğru yüklendiğini kontrol et
# 7. i18n mesajlarının doğru çözümlendiğini kontrol et
# 8. Keyboard shortcut'ların kayıtlı olduğunu kontrol et
```

**FAZ 1 BİTTİĞİNDE ONAY BEKLEME, TESTLERİ ÇALIŞTİR VE FAZ 2'YE GEÇ.**

---

## 🎨 FAZ 2: POPUP UI

### Görevler:

#### 2.1 - popup.html
Popup boyutu: 420px genişlik, 600px max yükseklik.

**Ana Yapı:**
```
┌─────────────────────────────────────┐
│  🕷️ Web Scraper Pro     ⚙️ 🌙 📌  │  <- Header (logo, ayarlar, dark mode, pin)
├─────────────────────────────────────┤
│  🔍 [Arama / URL filtre]           │  <- Arama çubuğu
├─────────────────────────────────────┤
│  📊 Hızlı İstatistikler            │  <- Sayfa özeti kartları
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐   │
│  │Tbl│ │Img│ │Lnk│ │Txt│ │Med│   │
│  │ 5 │ │42 │ │89 │ │12K│ │ 3 │   │
│  └───┘ └───┘ └───┘ └───┘ └───┘   │
├─────────────────────────────────────┤
│  [Tablolar][Medya][Linkler][Metin] │  <- Tab navigasyon
│  [Formlar][Meta][Schema][Özel]     │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │   Seçili Tab İçeriği        │   │
│  │   (Scrollable area)         │   │
│  │                             │   │
│  │   - Preview kartları        │   │
│  │   - Filtreleme seçenekleri  │   │
│  │   - Seçim checkboxları      │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│  ⬇️ İndir: [CSV][JSON][XLSX]      │  <- Export butonları
│            [XML][MD][PDF][+]       │
├─────────────────────────────────────┤
│  [🎯 Element Seçici] [📸 SS] [⏰] │  <- Aksiyon butonları
├─────────────────────────────────────┤
│  v1.0.0 | 📊 42 öğe | ⏱️ 0.3s   │  <- Footer
└─────────────────────────────────────┘
```

#### 2.2 - popup.css
```css
/* DETAYLI CSS GEREKSİNİMLERİ: */

/* 1. CSS Custom Properties (Tema Sistemi) */
:root {
  /* Light tema */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-tertiary: #e9ecef;
  --bg-hover: #f1f3f5;
  --bg-active: #e2e6ea;
  --bg-card: #ffffff;
  --bg-modal: #ffffff;
  --bg-tooltip: #212529;
  --bg-badge: #e3f2fd;

  --text-primary: #212529;
  --text-secondary: #495057;
  --text-tertiary: #868e96;
  --text-disabled: #adb5bd;
  --text-inverse: #ffffff;
  --text-link: #1971c2;

  --border-primary: #dee2e6;
  --border-secondary: #e9ecef;
  --border-focus: #4dabf7;
  --border-error: #ff6b6b;
  --border-success: #51cf66;

  --accent-primary: #228be6;
  --accent-secondary: #15aabf;
  --accent-success: #40c057;
  --accent-warning: #fab005;
  --accent-danger: #fa5252;
  --accent-info: #15aabf;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.15);

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;

  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);

  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal: 300;
  --z-tooltip: 400;
  --z-toast: 500;
}

/* Dark tema */
[data-theme="dark"] {
  --bg-primary: #1a1b1e;
  --bg-secondary: #25262b;
  --bg-tertiary: #2c2e33;
  /* ... tüm dark tema renkleri */
}

/* Auto tema (sistem tercihine göre) */
@media (prefers-color-scheme: dark) {
  [data-theme="auto"] {
    /* dark tema değerleri */
  }
}

/* 2. Animasyonlar */
@keyframes slideIn { /* popup açılış */ }
@keyframes fadeIn { /* genel fade */ }
@keyframes pulse { /* badge pulse */ }
@keyframes shimmer { /* loading skeleton */ }
@keyframes bounce { /* dikkat çekme */ }
@keyframes spin { /* loading spinner */ }
@keyframes shake { /* hata */ }
@keyframes confetti { /* başarı */ }

/* 3. Loading Skeleton */
.skeleton { /* shimmer efektli loading placeholder */ }

/* 4. Scrollbar özelleştirme */
::-webkit-scrollbar { /* ince, güzel scrollbar */ }

/* 5. Tooltip sistemi */
[data-tooltip] { /* CSS-only tooltip */ }

/* 6. Toast notification */
.toast-container { /* sağ üst köşe */ }

/* 7. Responsive tab sistemi */
.tab-nav { /* kaydırılabilir tab bar */ }

/* 8. Kart grid sistemi */
.card-grid { /* responsive grid */ }

/* 9. Mini chart container */
.mini-chart { /* sparkline/bar chart alanı */ }

/* 10. Progress bar */
.progress { /* indirme/scraping progress */ }

/* 11. Chip/Tag sistemi */
.chip { /* filtreleme tag'leri */ }

/* 12. Mikro-etkileşimler */
button:active { transform: scale(0.97); }
.card:hover { transform: translateY(-2px); }

/* 13. Focus visible (erişilebilirlik) */
:focus-visible { outline: 2px solid var(--border-focus); }

/* 14. Print stili */
@media print { /* yazdırma için optimize */ }

/* 15. Yüksek kontrast modu */
@media (prefers-contrast: high) { /* yüksek kontrast */ }

/* 16. Azaltılmış hareket */
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
}
```

#### 2.3 - popup.js
```javascript
// POPUP İŞLEVSELLİĞİ:

// 1. SAYFA ANALİZİ
// - Aktif sekmedeki sayfayı analiz et
// - Tüm tabloları bul ve say
// - Tüm resimleri bul (src, srcset, background-image, picture/source)
// - Tüm linkleri bul (internal, external, mailto, tel, anchor)
// - Tüm metinleri bul (headings, paragraphs, lists, blockquotes)
// - Tüm medyayı bul (video, audio, iframe embeds)
// - Tüm formları bul (inputs, selects, textareas)
// - Meta bilgileri bul (title, description, keywords, OG tags, Twitter cards)
// - Schema.org verileri bul (JSON-LD, microdata, RDFa)
// - Stil bilgileri bul (kullanılan fontlar, renkler, CSS dosyaları)
// - Performance metrikleri (sayfa boyutu, yükleme süresi, DOM element sayısı)
// - Accessibility bilgileri (ARIA labels, alt texts, heading hierarchy)
// - Technology stack tespiti (framework, CMS, analytics, CDN)

// 2. TAB SİSTEMİ
const TABS = [
  {
    id: 'tables',
    icon: '📊',
    label: 'Tablolar',
    description: 'HTML tabloları ve grid yapıları'
  },
  {
    id: 'media',
    icon: '🖼️',
    label: 'Medya',
    description: 'Resimler, videolar, sesler'
  },
  {
    id: 'links',
    icon: '🔗',
    label: 'Linkler',
    description: 'Tüm bağlantılar'
  },
  {
    id: 'text',
    icon: '📝',
    label: 'Metin',
    description: 'Başlıklar, paragraflar, listeler'
  },
  {
    id: 'forms',
    icon: '📋',
    label: 'Formlar',
    description: 'Form elemanları ve verileri'
  },
  {
    id: 'meta',
    icon: '🏷️',
    label: 'Meta',
    description: 'Meta taglar, SEO bilgileri'
  },
  {
    id: 'schema',
    icon: '🔬',
    label: 'Schema',
    description: 'Yapısal veri (JSON-LD, Microdata)'
  },
  {
    id: 'custom',
    icon: '🎯',
    label: 'Özel',
    description: 'CSS/XPath ile özel seçim'
  },
  {
    id: 'styles',
    icon: '🎨',
    label: 'Stiller',
    description: 'Fontlar, renkler, CSS'
  },
  {
    id: 'tech',
    icon: '⚡',
    label: 'Teknoloji',
    description: 'Kullanılan teknolojiler'
  },
  {
    id: 'monitor',
    icon: '👁️',
    label: 'İzleme',
    description: 'DOM değişiklik izleme'
  },
  {
    id: 'history',
    icon: '📜',
    label: 'Geçmiş',
    description: 'Önceki kazıma sonuçları'
  }
];

// 3. HER TAB İÇİN DETAYLI İÇERİK:

// TABLOLAR TAB:
// - Tablo listesi (başlık, satır/sütun sayısı, boyut)
// - Tablo önizleme (ilk 5 satır)
// - Tüm tabloyu göster butonu
// - Sütun seçimi (hangi sütunları export et)
// - Satır filtreleme
// - Sıralama
// - Tablo birleştirme (birden fazla tablo)
// - Tablo dönüştürme (transpose)

// MEDYA TAB:
// - Grid galeri görünümü (thumbnail'lar)
// - Liste görünümü (detaylı bilgi)
// - Filtreler: tip (jpg, png, gif, svg, webp, video, audio), boyut (min/max), boyut aralığı
// - Toplu seçim (tümünü seç, filtrelenmişleri seç)
// - Lazy load edilmiş resimleri de yakala
// - srcset'teki en büyük versiyonu göster
// - Background image'ları da listele
// - SVG'leri ayrı listele
// - Favicon ve touch icon'ları listele
// - Video thumbnail'larını göster
// - Resim boyut bilgisi (px cinsinden genişlik/yükseklik)
// - Dosya boyutu tahmini
// - Alt text bilgisi

// LİNKLER TAB:
// - Filtreler: tip (internal, external, anchor, mailto, tel, javascript)
// - Domain bazlı gruplama
// - Status kontrolü (broken link checker) - opsiyonel
// - Anchor text ile arama
// - Duplicate link tespiti
// - Social media linkleri ayrı gruplama
// - File download linkleri ayrı gruplama (pdf, doc, xls, zip...)
// - Link depth analizi
// - nofollow/dofollow bilgisi
// - Link relationship (rel attribute)

// METİN TAB:
// - Heading hierarchy (H1-H6 ağacı)
// - Paragraf listesi
// - Liste öğeleri (ordered, unordered)
// - Blockquote'lar
// - Code blokları
// - Kelime sayısı, karakter sayısı, okuma süresi tahmini
// - Readability skoru
// - En çok kullanılan kelimeler (word cloud)
// - Metin dili tespiti
// - Full page text extraction (article mode - Mozilla Readability)

// FORMLAR TAB:
// - Form listesi (action URL, method)
// - Input elemanları (type, name, value, placeholder)
// - Select elemanları (options listesi)
// - Textarea içerikleri
// - Hidden field'lar
// - Form validation kuralları
// - CSRF token tespiti

// META TAB:
// - Title, Description, Keywords
// - Open Graph tags (tüm og: prefix'li)
// - Twitter Card tags
// - Canonical URL
// - Alternate/Hreflang tags
// - Robots meta
// - Author, Publisher
// - Favicon URL
// - RSS/Atom feed URL'leri
// - Sitemap URL
// - AMP page URL
// - Mobile viewport settings
// - Theme color
// - Web app manifest

// SCHEMA TAB:
// - JSON-LD verilerini parse et ve göster
// - Microdata verilerini çıkar
// - RDFa verilerini çıkar
// - Schema.org tipi başlıklarıyla grupla
// - Ağaç görünümü (nested veriler için)
// - Raw JSON görünümü
// - Schema validation (schema.org'a uygunluk)

// ÖZEL TAB:
// - CSS Selector giriş alanı (autocomplete ile)
// - XPath giriş alanı
// - Regex giriş alanı
// - Canlı önizleme (selector yazılırken eşleşen elementleri göster)
// - Eşleşen element sayısı
// - Selector geçmişi
// - Selector kaydetme (favoriler)
// - Element Picker entegrasyonu (görsel seçim)
// - Selector test/doğrulama
// - Attribute filtresi
// - Text content filtresi
// - Multiple selector desteği (birden fazla seçici kombine)

// STİLLER TAB:
// - Kullanılan fontlar (font-family listesi, Google Fonts tespiti)
// - Renk paleti (sayfada kullanılan tüm renkler)
// - CSS dosyaları listesi
// - CSS variables
// - Media queries
// - Kullanılan ikonlar (icon font, SVG icon)
// - Animations/Transitions

// TEKNOLOJİ TAB:
// - Frontend framework tespiti (React, Vue, Angular, Svelte...)
// - CMS tespiti (WordPress, Drupal, Joomla...)
// - E-commerce tespiti (Shopify, WooCommerce, Magento...)
// - Analytics tespiti (GA, GTM, Hotjar, Mixpanel...)
// - CDN tespiti (Cloudflare, AWS, Akamai...)
// - Server header bilgileri
// - JavaScript kütüphaneleri tespiti
// - CSS framework tespiti (Bootstrap, Tailwind, Bulma...)
// - Build tool tespiti (Webpack, Vite...)
// - Hosting tespiti

// İZLEME TAB:
// - DOM mutation observer başlat/durdur
// - Değişiklikleri log'la
// - Yeni eklenen elementleri highlight et
// - Silinen elementleri kaydet
// - Attribute değişikliklerini izle
// - Network isteklerini izle (XHR, Fetch)
// - WebSocket mesajlarını izle
// - Console mesajlarını izle
// - İzleme süresini göster

// GEÇMİŞ TAB:
// - Önceki kazıma sonuçları (tarih, URL, tip, boyut)
// - Sonuçları tekrar görüntüle
// - Karşılaştırma (diff) modu
// - Sonuçları silme
// - Toplu export
// - İstatistikler (en çok kazınan siteler, veri boyutları)

// 4. EXPORT SİSTEMİ
// Her tab'da ve genel olarak şu formatlarda export:
// - CSV (ayırıcı seçenekleriyle: virgül, noktalı virgül, tab, pipe)
// - JSON (pretty print, minified, JSON Lines)
// - XLSX (birden fazla sheet, styling, formüller)
// - XML (custom root element, attribute mapping)
// - HTML (styled table, standalone page)
// - Markdown (GitHub Flavored Markdown)
// - PDF (sayfa düzeni seçenekleriyle, header/footer)
// - YAML
// - SQL (INSERT INTO statements, CREATE TABLE dahil)
// - Clipboard (tablo olarak, plain text olarak)
// - Google Sheets (doğrudan açma linki)
// - TSV (Tab Separated Values)
// - LaTeX (tablo formatında)
// - RSS/Atom (feed formatında)

// 5. SLIDESHOW / PREVIEW
// - Çekilen içerikleri slideshow olarak görüntüle
// - Özellikle medya (resimler) için galeri modu
// - Tablolar için sayfa sayfa görünüm
// - Önceki/Sonraki navigasyonu
// - Thumbnail strip (alt kısımda)
// - Otomatik oynatma (ayarlanabilir süre)
// - Tam ekran modu
// - Zoom in/out
// - Döndürme (resimler için)
// - Bilgi overlay'i (dosya adı, boyut, URL)
// - Keyboard navigasyon (ok tuşları, ESC)
// - Touch/swipe desteği
// - Slideshow içindeyken indirme butonu
// - Paylaşım butonu (URL kopyala)

// 6. GENEL POPUP ÖZELLİKLERİ
// - Dark/Light/Auto tema geçişi (buton ile anında)
// - Dil seçimi (bayrak ikonlarıyla)
// - Pin popup (kapatılmasını engelle) - side panel'e yönlendir
// - Arama/filtreleme (tüm tab'larda cross-search)
// - Drag & drop (export dosyasını sürükle bırak)
// - Kısayol bilgileri tooltip
// - Animasyonlu geçişler (tab değişimi, içerik yükleme)
// - Pull to refresh (sayfa yeniden analiz)
// - Keyboard navigasyon (Tab, Enter, Escape, ok tuşları)
// - Context menu (sağ tık menüsü popup içinde)
// - Undo/Redo desteği
// - Son kullanılan export formatını hatırla
// - Favori seçicileri kaydet/yükle
// - Quick actions bar (en çok kullanılan 3-4 aksiyon)
// - Bildirim merkezi (son işlemler, hatalar)
```

### FAZ 2 TESTLERİ:
```bash
# 1. Popup açılma testi
# 2. Tüm tab'ların render edilme testi
# 3. Dark/Light mode geçiş testi
# 4. Arama fonksiyonu testi
# 5. Export butonları testi (her format)
# 6. Slideshow açılma ve navigasyon testi
# 7. Keyboard navigasyon testi
# 8. i18n - dil değişimi testi
# 9. Responsive davranış testi (farklı popup boyutları)
# 10. Animasyon performans testi
# 11. Memory leak testi (uzun süre açık kalma)
# 12. Error state testi (sayfa yüklenemediğinde)
# 13. Empty state testi (veri bulunamadığında)
# 14. Loading state testi (skeleton gösterimi)
```

**FAZ 2 BİTTİĞİNDE ONAY BEKLEME, FAZ 3'E GEÇ.**

---

## 🔍 FAZ 3: CONTENT SCRIPTS - KAZIMA MOTORLARI

### Görevler:

#### 3.1 - content.js (Ana Content Script)
```javascript
// Ana content script - tüm alt modülleri koordine eder

class WebScraperContent {
  constructor() {
    this.modules = {};
    this.cachedResults = {};
    this.isActive = false;
    this.observer = null;
  }

  // 1. Message listener - popup/background ile iletişim
  // 2. Lazy module loading (ihtiyaç olunca modül yükle)
  // 3. Sonuçları cache'le (aynı istek tekrar gelince cache'den dön)
  // 4. Performance monitoring (kazıma süresi ölçümü)
  // 5. Error boundary (modül hata verirse diğerlerini etkilemesin)
  // 6. Throttle/Debounce (aşırı istek engelleme)
  // 7. Page lifecycle management (SPA navigasyonunda yenile)
}
```

#### 3.2 - element-picker.js (Görsel Element Seçici) ⭐ ÖNEMLİ
```javascript
// KAPSAMLI ELEMENT PICKER:

class ElementPicker {
  // 1. OVERLAY SİSTEMİ
  // - Tüm sayfa üzerine yarı saydam overlay
  // - Mouse hover'da element highlight (kenarlık + arka plan rengi)
  // - Element bilgi tooltip'i (tag, class, id, boyut)
  // - Nested element'lerde scroll ile iç/dış element seçimi
  // - Çoklu seçim modu (Ctrl+Click ile birden fazla element)
  // - Bölge seçimi (Shift+Drag ile dikdörtgen alan)

  // 2. SELECTOR ÜRETİCİ
  // - Seçilen element için en optimal CSS selector üret
  // - Birden fazla selector önerisi sun (unique selector, shortest, most readable)
  // - XPath selector da üret
  // - Selector'ı test et (kaç element eşleşiyor)
  // - Parent/child/sibling navigasyonu
  // - Similar elements bulma (aynı yapıdaki tekrar eden elementler)
  // - Auto-detect repeating patterns (liste, grid, tablo benzeri yapılar)

  // 3. KONTROL PANELİ (sayfanın üst/alt köşesinde floating panel)
  // - Seçilen element bilgisi
  // - CSS Selector düzenleme alanı
  // - XPath düzenleme alanı
  // - Eşleşen element sayısı
  // - Preview butonu (eşleşenleri highlight et)
  // - Confirm butonu (seçimi onayla ve veriyi çıkar)
  // - Cancel butonu
  // - Ayarlar (renk, opaklık vs.)
  // - Element tree (DOM ağacı mini görünümü)
  // - Computed styles panel
  // - Event listeners panel

  // 4. VERİ ÇIKARMA
  // - Text content
  // - HTML content
  // - Attributes (href, src, alt, title, data-*)
  // - Computed styles
  // - Position ve boyut
  // - Child elements recursively
  // - Sibling data

  // 5. PATTERN DETECTION (Akıllı Tekrar Tespiti)
  // - Seçilen elementin benzerleri otomatik bulma
  // - Tablo satırları, ürün kartları, haber listesi gibi pattern'ları algıla
  // - CSS selector'ı otomatik genelleştir
  // - Confidence score göster

  // 6. KAYIT ve TEKRARp
  // - Seçici kombinasyonu kaydetme
  // - Kaydedilen seçicileri tekrar çalıştırma
  // - Farklı sayfalarda aynı seçiciyi test etme
}
```

#### 3.3 - table-extractor.js
```javascript
class TableExtractor {
  // 1. Tüm <table> elementlerini bul
  // 2. Div-based tablo yapılarını da bul (CSS grid/flex ile yapılmış tablolar)
  // - display: table, display: grid, role="table" gibi yapılar
  // 3. Nested tabloları düzleştir
  // 4. Colspan/rowspan'ları doğru handle et
  // 5. Header satırını otomatik tespit et (<thead>, ilk satır, <th>)
  // 6. Footer satırını ayır
  // 7. Hücre içi HTML'i temizle (strip tags, trim whitespace)
  // 8. Sayısal verileri formatla (para birimi, yüzde, tarih tespiti)
  // 9. Boş satır/sütunları opsiyonel filtrele
  // 10. Tablo başlığını yakala (caption, önceki heading)
  // 11. Sortable tablo desteği (data attribute'lardan asıl değeri al)
  // 12. Pagination'lı tabloları birleştir
  // 13. CSV-like metin yapılarını da tespit et
  // 14. DataTable, AG Grid gibi kütüphane tablolarından veri çıkar
  // 15. Sticky header/column desteği
}
```

#### 3.4 - media-extractor.js
```javascript
class MediaExtractor {
  // RESİMLER:
  // 1. <img> elementleri (src, srcset, sizes)
  // 2. <picture> elementleri (tüm source'lar)
  // 3. CSS background-image (inline + stylesheet)
  // 4. SVG elementleri (inline + external)
  // 5. Canvas elementleri (toDataURL ile)
  // 6. Favicon ve apple-touch-icon
  // 7. Open Graph image
  // 8. Lazy-loaded resimler (data-src, data-lazy, data-original vb.)
  // 9. srcset'ten en büyük çözünürlüğü seç
  // 10. Base64 encoded resimleri tespit et
  // 11. WebP/AVIF fallback'ları
  // 12. Image map'leri
  // 13. Sprite sheet'leri
  // 14. CSS mask/clip-path ile kullanılan resimleri

  // VİDEOLAR:
  // 1. <video> elementleri (src, source)
  // 2. YouTube embed (video ID çıkar, thumbnail al)
  // 3. Vimeo embed (video ID çıkar)
  // 4. Dailymotion embed
  // 5. Facebook video embed
  // 6. Twitter video embed
  // 7. TikTok embed
  // 8. Instagram video embed
  // 9. HTML5 video poster image
  // 10. HLS/DASH stream URL tespiti
  // 11. Video boyutu ve süresi (mümkünse)

  // SES:
  // 1. <audio> elementleri
  // 2. SoundCloud embed
  // 3. Spotify embed
  // 4. Podcast player'lar
  // 5. Background audio

  // EMBED/IFRAME:
  // 1. Tüm iframe'leri listele
  // 2. Google Maps embed
  // 3. Google Docs/Sheets/Slides embed
  // 4. CodePen/JSFiddle embed
  // 5. Social media embed'leri
  // 6. Widget'lar

  // DOKÜMANLARconst:
  // 1. PDF linkleri
  // 2. Word/Excel/PPT linkleri
  // 3. ZIP/RAR linkleri
  // 4. Diğer dosya indirme linkleri

  // HER MEDYA İÇİN:
  // - URL (absolute)
  // - Dosya adı
  // - Dosya boyutu (HEAD request ile, opsiyonel)
  // - MIME type
  // - Boyutlar (width x height, mümkünse)
  // - Alt text / Title
  // - Context (hangi element içinde)
  // - Thumbnail preview
}
```

#### 3.5 - link-extractor.js
```javascript
class LinkExtractor {
  // 1. Tüm <a> elementleri
  // 2. Area elementleri (image map)
  // 3. JavaScript onclick içindeki URL'ler
  // 4. data-href gibi attribute'lardaki URL'ler
  // 5. CSS'teki url() referansları
  // 6. Meta refresh URL'leri
  // 7. Canonical URL
  // 8. Alternate URL'ler (hreflang)
  // 9. RSS/Atom feed URL'leri
  // 10. Sitemap URL
  // 11. Robots.txt URL

  // SINIFLANDIRMA:
  // - Internal (aynı domain)
  // - External (farklı domain)
  // - Anchor (# ile başlayan)
  // - Mailto
  // - Tel
  // - JavaScript (javascript: ile başlayan)
  // - File download (pdf, doc, xls, zip...)
  // - Social media
  // - Protocol-relative (// ile başlayan)
  // - Data URI

  // HER LİNK İÇİN:
  // - URL (absolute)
  // - Anchor text
  // - Title attribute
  // - Target attribute
  // - Rel attribute (nofollow, sponsored, ugc vb.)
  // - Link tipi (yukarıdaki sınıflandırma)
  // - Domain
  // - Path
  // - Query parameters
  // - Fragment
  // - Is broken? (opsiyonel, HEAD request ile)
}
```

#### 3.6 - text-extractor.js
```javascript
class TextExtractor {
  // 1. Heading hierarchy (H1-H6)
  //    - Her heading'in level'ı, text'i, id'si
  //    - Heading tree (nested yapı)
  //    - Heading sıralaması doğru mu kontrolü

  // 2. Paragraflar
  //    - Tüm <p> elementleri
  //    - İçindeki inline element'ler (bold, italic, link vb.) korunarak

  // 3. Listeler
  //    - Ordered lists (<ol>)
  //    - Unordered lists (<ul>)
  //    - Description lists (<dl>)
  //    - Nested listeler

  // 4. Blockquote'lar
  //    - Alıntı metni
  //    - Kaynak (cite)

  // 5. Code blokları
  //    - Inline code (<code>)
  //    - Code blocks (<pre><code>)
  //    - Dil tespiti (class="language-xxx")

  // 6. Tablo hücreleri (text olarak)

  // 7. Article modu
  //    - Mozilla Readability algoritması ile ana içeriği çıkar
  //    - Reklam, navigasyon, sidebar, footer gibi noise'u temizle
  //    - Temiz, okunabilir metin

  // 8. İstatistikler
  //    - Toplam kelime sayısı
  //    - Toplam karakter sayısı
  //    - Toplam cümle sayısı
  //    - Okuma süresi tahmini (ortalama 200 kelime/dk)
  //    - Readability skoru (Flesch-Kincaid veya benzeri)
  //    - En çok kullanılan kelimeler (top 20)
  //    - Dil tespiti
  //    - Unique kelime sayısı

  // 9. Özel text çıkarma
  //    - Email adresleri (regex ile)
  //    - Telefon numaraları (regex ile, uluslararası formatlar)
  //    - Tarihler (çeşitli formatlar)
  //    - Para miktarları (çeşitli para birimleri)
  //    - Adresler (mümkün olduğunca)
  //    - IP adresleri
  //    - Koordinatlar (lat/lng)
  //    - Sosyal medya kullanıcı adları (@mention)
  //    - Hashtag'ler (#tag)
  //    - URL'ler (metin içindeki)
}
```

#### 3.7 - form-extractor.js
```javascript
class FormExtractor {
  // 1. Tüm <form> elementleri
  //    - Action URL
  //    - Method (GET/POST)
  //    - Enctype
  //    - Name/ID

  // 2. Input elementleri
  //    - Type (text, email, password, number, date, file, hidden, checkbox, radio...)
  //    - Name, ID, Value
  //    - Placeholder
  //    - Required/Optional
  //    - Pattern (validation regex)
  //    - Min/Max/Step (number inputs)
  //    - Autocomplete attribute

  // 3. Select elementleri
  //    - Tüm option'lar (value + text)
  //    - Selected option(s)
  //    - Optgroup'lar

  // 4. Textarea
  //    - İçerik
  //    - Rows/Cols

  // 5. Button'lar
  //    - Type (submit, reset, button)
  //    - Text

  // 6. Fieldset/Legend

  // 7. CSRF Token tespiti

  // 8. Custom form element'leri (div-based dropdown'lar, custom checkbox'lar)

  // 9. Form verilerini FormData olarak export etme

  // 10. Form'u doldurma/tekrarlama şablonu oluşturma
}
```

#### 3.8 - meta-extractor.js
```javascript
class MetaExtractor {
  // 1. Temel meta tag'ler
  //    - <title>
  //    - <meta name="description">
  //    - <meta name="keywords">
  //    - <meta name="author">
  //    - <meta name="viewport">
  //    - <meta name="robots">
  //    - <meta charset>

  // 2. Open Graph
  //    - og:title, og:description, og:image, og:url, og:type
  //    - og:site_name, og:locale
  //    - og:video, og:audio
  //    - Tüm og: prefix'li meta tag'ler

  // 3. Twitter Card
  //    - twitter:card, twitter:title, twitter:description, twitter:image
  //    - twitter:site, twitter:creator
  //    - Tüm twitter: prefix'li meta tag'ler

  // 4. Dublin Core
  //    - DC.title, DC.creator, DC.subject, DC.description

  // 5. Link tag'leri
  //    - Canonical (<link rel="canonical">)
  //    - Alternate (<link rel="alternate"> hreflang dahil)
  //    - RSS/Atom (<link rel="alternate" type="application/rss+xml">)
  //    - Favicon (<link rel="icon">)
  //    - Apple touch icon
  //    - Preload/Prefetch
  //    - Manifest (<link rel="manifest">)
  //    - Stylesheet'ler
  //    - Prev/Next (pagination)

  // 6. HTTP-Equiv meta tag'ler
  //    - Content-Type
  //    - Refresh
  //    - X-UA-Compatible
  //    - Content-Security-Policy

  // 7. Sayfa performans bilgileri
  //    - DOM Content Loaded süresi
  //    - Page Load süresi
  //    - DOM element sayısı
  //    - Sayfa boyutu (HTML)
  //    - External resource sayısı

  // 8. PWA bilgileri
  //    - Web App Manifest
  //    - Service Worker var mı
  //    - Theme color
  //    - Background color

  // 9. Security bilgileri
  //    - HTTPS mi?
  //    - CSP header
  //    - X-Frame-Options
  //    - HSTS
}
```

#### 3.9 - schema-extractor.js
```javascript
class SchemaExtractor {
  // 1. JSON-LD (<script type="application/ld+json">)
  //    - Parse et
  //    - Schema.org tipini tespit et
  //    - Ağaç yapısında göster
  //    - Multiple JSON-LD blokları

  // 2. Microdata (itemscope, itemprop, itemtype)
  //    - HTML element'lerden çıkar
  //    - Schema.org tipini tespit et
  //    - Nested microdata

  // 3. RDFa (typeof, property, about)
  //    - HTML element'lerden çıkar

  // 4. Yaygın schema.org tipleri için özel parser:
  //    - Product (ürün: ad, fiyat, resim, marka, SKU, stok durumu)
  //    - Article (makale: başlık, yazar, tarih, resim)
  //    - LocalBusiness (işletme: ad, adres, telefon, çalışma saatleri)
  //    - Person (kişi: ad, iş, resim)
  //    - Event (etkinlik: ad, tarih, mekan, fiyat)
  //    - Recipe (tarif: malzemeler, süre, kalori)
  //    - Review/Rating (yorum: puan, yazar, tarih)
  //    - BreadcrumbList (breadcrumb navigasyon)
  //    - FAQ (sık sorulan sorular)
  //    - HowTo (nasıl yapılır adımları)
  //    - VideoObject (video bilgileri)
  //    - Organization (kuruluş bilgileri)
  //    - WebSite (site bilgileri, arama kutusu)
  //    - JobPosting (iş ilanı)
  //    - Course (kurs bilgileri)
  //    - Book (kitap bilgileri)
  //    - Movie (film bilgileri)
  //    - MusicRecording (müzik bilgileri)
  //    - SoftwareApplication (uygulama bilgileri)
}
```

#### 3.10 - style-extractor.js
```javascript
class StyleExtractor {
  // 1. Kullanılan fontlar
  //    - font-family değerleri (computed style'dan)
  //    - @font-face declarations
  //    - Google Fonts tespiti (fonts.googleapis.com)
  //    - Adobe Fonts tespiti
  //    - Font dosya URL'leri (woff, woff2, ttf, otf, eot)
  //    - Font ağırlıkları ve stilleri

  // 2. Renk paleti
  //    - Tüm kullanılan renkler (text, background, border)
  //    - HEX, RGB, HSL formatlarında
  //    - Renk frekansı (en çok kullanılan renkler)
  //    - CSS custom properties (--renk-adi)
  //    - Gradient'lar

  // 3. CSS dosyaları
  //    - External stylesheet URL'leri
  //    - Inline <style> blokları
  //    - Toplam CSS boyutu

  // 4. CSS Variables
  //    - :root'taki tüm custom properties
  //    - Kullanım sayıları

  // 5. Media Queries
  //    - Breakpoint'ler
  //    - Dark mode query'si var mı

  // 6. Animations
  //    - @keyframes tanımları
  //    - transition'lar
  //    - animation kullanımları

  // 7. Layout bilgileri
  //    - Flexbox kullanımı
  //    - Grid kullanımı
  //    - Float kullanımı
  //    - Position kullanımı

  // 8. Z-index haritası (tüm z-index değerleri)

  // 9. Box model bilgileri (seçilen element için)
}
```

#### 3.11 - dom-monitor.js
```javascript
class DOMMonitor {
  // MutationObserver tabanlı DOM izleme

  // 1. Element ekleme izleme
  // 2. Element silme izleme
  // 3. Attribute değişikliği izleme
  // 4. Text content değişikliği izleme
  // 5. Specific selector izleme (belirli bir elementi izle)
  // 6. İzleme logları (timestamp, tip, element, eski/yeni değer)
  // 7. İzleme filtreleri (sadece belirli tipleri izle)
  // 8. İzleme süresi sınırı
  // 9. Değişiklik sayacı
  // 10. Değişiklikleri export etme
  // 11. Değişiklik olduğunda bildirim
  // 12. Snapshot alma (DOM'un anlık durumu)
  // 13. Snapshot karşılaştırma (diff)
  // 14. Network isteklerini de izleme (XHR, Fetch interceptor)
  // 15. Performance monitoring (FPS, memory, layout thrashing)
}
```

#### 3.12 - infinite-scroll-handler.js
```javascript
class InfiniteScrollHandler {
  // 1. Sonsuz kaydırma tespiti
  //    - Scroll event + yeni element eklenmesi
  //    - IntersectionObserver kullanımı tespiti
  //    - "Load more" butonu tespiti

  // 2. Otomatik kaydırma
  //    - Sayfanın en altına kaydır
  //    - Yeni içerik yüklenmesini bekle
  //    - Belirli sayıda tekrarla
  //    - Veya belirli miktarda veri toplanana kadar
  //    - Hız ayarı (çok hızlı kaydırmayı engelle)

  // 3. Toplanan verileri artımlı olarak kaydet

  // 4. Durdurma/devam etme yeteneği

  // 5. Progress gösterimi (yüklenen sayfa/veri sayısı)

  // 6. Rate limiting (sunucuyu yormamak için)

  // 7. Duplicate veri tespiti (aynı içerik tekrar yüklendiyse)

  // 8. "Daha fazla yükle" butonu otomatik tıklama

  // 9. AJAX tabanlı sayfalama tespiti ve yönetimi
}
```

#### 3.13 - pagination-handler.js
```javascript
class PaginationHandler {
  // 1. Pagination tespiti
  //    - Numaralı sayfalama (1, 2, 3, ...)
  //    - Önceki/Sonraki butonları
  //    - "Load more" butonu
  //    - URL pattern tespiti (?page=, /page/, &p=, &offset= vb.)
  //    - AJAX pagination (DOM mutation ile)

  // 2. Otomatik sayfa gezme
  //    - Sonraki sayfaya git
  //    - Belirli sayfa aralığı (1-10 arası)
  //    - Her sayfadaki veriyi topla ve birleştir
  //    - Delay ayarı (sayfalar arası bekleme)
  //    - Rate limiting

  // 3. Toplanan verileri birleştir
  //    - Duplicate kontrolü
  //    - Sayfa numarası bilgisi ekle
  //    - Toplam sayfa sayısı tespiti

  // 4. Hata yönetimi
  //    - Sayfa bulunamazsa dur
  //    - Timeout durumunda tekrar dene
  //    - Captcha tespiti

  // 5. Progress gösterimi
  //    - Mevcut sayfa / Toplam sayfa
  //    - Toplanan veri sayısı
  //    - Tahmini kalan süre
}
```

#### 3.14 - lazy-load-handler.js
```javascript
class LazyLoadHandler {
  // 1. Lazy load tespiti
  //    - data-src, data-lazy-src, data-original
  //    - loading="lazy" attribute
  //    - IntersectionObserver kullanımı
  //    - Scroll event listener'lar

  // 2. Lazy load tetikleme
  //    - Sayfayı yavaşça kaydırarak tüm resimleri yüklet
  //    - IntersectionObserver'ı manuel tetikle
  //    - data-src'yi src'ye kopyala
  //    - Scroll event'i simüle et
  //    - Viewport dışındaki elementleri viewport'a getir

  // 3. Yükleme durumu izleme
  //    - Kaç resim yüklendi / Kaç resim kaldı
  //    - Yükleme hataları
  //    - Toplam dosya boyutu

  // 4. Native lazy loading desteği
  //    - loading="lazy"'yi "eager"'a çevir
}
```

#### 3.15 - shadow-dom-handler.js
```javascript
class ShadowDOMHandler {
  // 1. Open Shadow DOM erişimi
  //    - shadowRoot üzerinden element seçme
  //    - Shadow DOM içindeki verileri çıkarma
  //    - Nested shadow DOM'lar

  // 2. Shadow DOM keşfi
  //    - Sayfadaki tüm shadow root'ları bul
  //    - Shadow DOM ağacını göster
  //    - Shadow DOM içindeki stilleri çıkar

  // 3. Custom element'ler
  //    - Web component'leri tespit et
  //    - Custom element registry'yi kontrol et
  //    - Slot content'lerini çıkar

  // 4. Closed Shadow DOM
  //    - Erişilemez olduğunu belirt
  //    - Mümkünse workaround uygula
}
```

#### 3.16 - content.css (Overlay Stilleri)
```css
/* Element picker overlay stilleri */
/* Highlight stilleri */
/* Floating panel stilleri */
/* Notification toast stilleri */
/* Tooltip stilleri */
/* Mini toolbar stilleri */
/* Tüm stiller izole edilmeli (shadow DOM veya benzersiz prefix) */
/* Sayfa stillerini etkilememeli */
/* High z-index */
/* Print'te gizlenme */
/* Tema desteği (eklenti temasına göre) */
```

### FAZ 3 TESTLERİ:
```bash
# 1. Element picker açılma ve element seçme testi
# 2. Tablo çıkarma testi (çeşitli tablo yapıları)
# 3. Resim çıkarma testi (lazy load dahil)
# 4. Link çıkarma ve sınıflandırma testi
# 5. Metin çıkarma ve istatistik testi
# 6. Form çıkarma testi
# 7. Meta tag çıkarma testi
# 8. Schema.org veri çıkarma testi
# 9. Stil çıkarma testi
# 10. DOM monitor başlatma/durdurma testi
# 11. Infinite scroll handler testi
# 12. Pagination handler testi
# 13. Shadow DOM erişim testi
# 14. Performans testi (büyük DOM'da)
# 15. Hata yönetimi testi (bozuk HTML'de)
# 16. Cross-frame iletişim testi
# TEST PAGES: tests/fixtures/ altındaki tüm test sayfaları kullanılacak
```

**FAZ 3 BİTTİĞİNDE ONAY BEKLEME, FAZ 4'E GEÇ.**

---

## 📤 FAZ 4: EXPORT SİSTEMİ VE DOWNLOAD MANAGER

### Görevler:

#### 4.1 - Export Modülleri (utils/ altında)

**export-csv.js:**
```javascript
class CSVExporter {
  // - Ayırıcı seçenekleri: virgül, noktalı virgül, tab, pipe (|)
  // - Header satırı dahil/hariç
  // - Quoting stratejisi (always, minimal, none)
  // - Encoding seçenekleri (UTF-8, UTF-8 BOM, ISO-8859-1, Windows-1252)
  // - Satır sonu seçenekleri (CRLF, LF)
  // - Null değer gösterimi (boş, "NULL", "N/A")
  // - Büyük veri setleri için streaming export
  // - Multi-sheet desteği (birden fazla CSV dosyası ZIP içinde)
}
```

**export-json.js:**
```javascript
class JSONExporter {
  // - Pretty print (indentation ayarlı)
  // - Minified
  // - JSON Lines (her satır ayrı JSON)
  // - Nested JSON (hierarchical data)
  // - JSON Schema oluşturma (veriden otomatik)
  // - JSON5 formatı
  // - JSONP formatı
  // - GeoJSON (koordinat veriler için)
  // - Custom key mapping
  // - Type coercion (string sayıları number'a çevir)
}
```

**export-xlsx.js:**
```javascript
class XLSXExporter {
  // SheetJS (xlsx) kütüphanesi ile:
  // - Multiple sheet desteği (her veri tipi ayrı sheet)
  // - Header styling (bold, background color, freeze pane)
  // - Auto column width
  // - Number format (para birimi, yüzde, tarih)
  // - Hyperlink hücreler (URL verileri tıklanabilir)
  // - Conditional formatting (renk kodlaması)
  // - Data validation (dropdown listeler)
  // - Chart ekleme (mümkünse)
  // - Filtre butonları (auto filter)
  // - Print area ayarı
  // - Sheet protection
  // - Summary sheet (genel istatistikler)
  // - Cell comments
}
```

**export-xml.js:**
```javascript
class XMLExporter {
  // - Custom root element adı
  // - Custom row element adı
  // - Attribute vs element mapping
  // - CDATA sections (HTML içeren veriler için)
  // - XML declaration ve encoding
  // - Namespace desteği
  // - XSD schema oluşturma
  // - XSLT stylesheet ekleme
  // - Pretty print
  // - XML validation
}
```

**export-html.js:**
```javascript
class HTMLExporter {
  // - Styled HTML table (CSS inline)
  // - Standalone HTML sayfası (head, body, styles dahil)
  // - Responsive tablo
  // - Sortable tablo (client-side JavaScript)
  // - Searchable tablo (filtre kutucukları)
  // - Pagination (client-side)
  // - Dark/Light tema
  // - Print-optimized
  // - Export tarihi ve kaynak URL bilgisi
  // - Resim thumbnail'ları (base64 veya URL)
}
```

**export-markdown.js:**
```javascript
class MarkdownExporter {
  // - GitHub Flavored Markdown tabloları
  // - Heading hierarchy
  // - Link listesi formatı
  // - Resim galerisi formatı
  // - Checklist formatı
  // - Code block'lar (veri türüne göre)
  // - YAML frontmatter (metadata)
  // - Table of Contents oluşturma
  // - HTML'den Markdown'a çevirme (Turndown kullanarak)
}
```

**export-pdf.js:**
```javascript
class PDFExporter {
  // jsPDF kütüphanesi ile:
  // - Tablo formatında export
  // - Sayfa düzeni (portrait/landscape)
  // - Kağıt boyutu (A4, Letter, A3, Custom)
  // - Header/Footer (sayfa numarası, tarih, URL)
  // - Logo/watermark
  // - Font boyutu ve ailesi
  // - Renk şeması
  // - Resim ekleme (medya export'unda)
  // - Sayfa kenar boşlukları
  // - Multi-page desteği
  // - Table of Contents
  // - Bookmarks (outline)
  // - Sıkıştırma
  // - Encryption (şifreli PDF)
  // - Full page screenshot'ı PDF'e çevirme
}
```

**export-yaml.js:**
```javascript
class YAMLExporter {
  // js-yaml kütüphanesi ile:
  // - YAML 1.2 uyumlu
  // - Flow style vs Block style seçimi
  // - Nested veri yapıları
  // - Anchor ve alias desteği
  // - Custom type tag'leri
  // - Multi-document YAML
  // - Comment ekleme (metadata)
}
```

**export-sql.js:**
```javascript
class SQLExporter {
  // - CREATE TABLE statement (veri tiplerini otomatik tespit)
  // - INSERT INTO statements
  // - Batch insert desteği
  // - Veritabanı seçenekleri: MySQL, PostgreSQL, SQLite, MSSQL, Oracle
  // - Table name özelleştirme
  // - Column name sanitization
  // - Primary key ekleme (auto increment)
  // - Index önerileri
  // - Transaction wrapper
  // - DROP TABLE IF EXISTS seçeneği
  // - NULL handling
  // - String escaping
  // - CREATE DATABASE seçeneği
  // - Stored procedure template
}
```

**export-clipboard.js:**
```javascript
class ClipboardExporter {
  // - Plain text (tab-separated)
  // - HTML table (Excel/Google Sheets'e yapıştırılabilir)
  // - JSON string
  // - Markdown table
  // - Tek hücre (seçili veri)
  // - Resim URL listesi
  // - Link listesi
  // - Clipboard write API (modern)
  // - execCommand fallback (eski tarayıcılar)
  // - Büyük veri uyarısı (clipboard boyut limiti)
}
```

#### 4.2 - data-cleaner.js
```javascript
class DataCleaner {
  // 1. HTML tag temizleme (strip tags)
  // 2. Whitespace normalizasyonu (trim, collapse)
  // 3. Special character handling (HTML entities decode)
  // 4. Unicode normalizasyonu (NFC/NFD)
  // 5. Encoding düzeltme (mojibake fix)
  // 6. NULL/undefined değer temizleme
  // 7. Empty string temizleme
  // 8. Duplicate satır silme
  // 9. Leading/trailing karakter silme
  // 10. Case normalizasyonu (lowercase, uppercase, title case)
  // 11. Number formatting (binlik ayırıcı, ondalık ayırıcı)
  // 12. Date normalizasyonu (ISO 8601'e çevir)
  // 13. URL normalizasyonu (protocol, trailing slash, query sort)
  // 14. Email normalizasyonu (lowercase, trim)
  // 15. Phone normalizasyonu (E.164 formatı)
  // 16. Address normalizasyonu
  // 17. XSS temizleme (DOMPurify)
  // 18. Profanity filtresi (opsiyonel)
  // 19. Regex tabanlı find/replace
  // 20. Custom cleaner pipeline (fonksiyon zinciri)
}
```

#### 4.3 - data-transformer.js
```javascript
class DataTransformer {
  // 1. Column rename (sütun adı değiştirme)
  // 2. Column reorder (sütun sırası değiştirme)
  // 3. Column merge (sütunları birleştirme)
  // 4. Column split (sütunu ayırma, regex ile)
  // 5. Row filter (koşula göre satır filtreleme)
  // 6. Row sort (sütuna göre sıralama)
  // 7. Group by (gruplama ve agregasyon)
  // 8. Pivot / Unpivot (çapraz tablo)
  // 9. Transpose (satır-sütun değiştirme)
  // 10. Type casting (string -> number, date vs.)
  // 11. Calculated columns (formül ile yeni sütun)
  // 12. Flatten nested data (iç içe yapıyı düzleştir)
  // 13. Nest data (düz yapıyı grupla ve iç içe yap)
  // 14. Join/merge datasets (iki veri setini birleştir)
  // 15. Sample data (rastgele örnekleme)
  // 16. Head/Tail (ilk/son N satır)
  // 17. Distinct (benzersiz satırlar)
  // 18. Fill missing values (eksik değer doldurma)
}
```

#### 4.4 - data-deduplicator.js
```javascript
class DataDeduplicator {
  // 1. Exact match (tam eşleşme)
  // 2. Case-insensitive match
  // 3. Fuzzy match (Levenshtein distance)
  // 4. Column-based dedup (belirli sütunlara göre)
  // 5. URL dedup (query parameter'ları görmezden gel)
  // 6. First/Last occurrence keep
  // 7. Duplicate count
  // 8. Duplicate highlights
  // 9. Merge strategy (duplikalar birleştirildiğinde hangi veri korunsun)
}
```

#### 4.5 - data-validator.js
```javascript
class DataValidator {
  // 1. Email validation
  // 2. URL validation
  // 3. Phone validation
  // 4. Date validation
  // 5. Number range validation
  // 6. String length validation
  // 7. Regex pattern validation
  // 8. Required field validation
  // 9. Type validation
  // 10. Custom validation rules
  // 11. Validation report oluşturma (geçen/kalan/hata)
  // 12. Fix suggestions (geçersiz veriler için düzeltme önerisi)
}
```

#### 4.6 - Download Manager (background/download-manager.js)
```javascript
class DownloadManager {
  // 1. chrome.downloads API kullanımı
  // 2. Dosya adı özelleştirme
  //    - Template: {domain}_{date}_{type}_{index}.{ext}
  //    - Custom template desteği
  //    - Geçersiz karakter temizleme
  // 3. İndirme klasörü seçimi
  // 4. Toplu indirme (birden fazla dosya)
  //    - Sıralı indirme (queue)
  //    - Paralel indirme (max concurrent ayarlı)
  //    - ZIP olarak indirme (JSZip ile)
  // 5. İndirme progress takibi
  //    - İndirilen / Toplam
  //    - Hız (KB/s, MB/s)
  //    - Kalan süre tahmini
  //    - Progress bar
  // 6. Hata yönetimi
  //    - Retry mekanizması (max 3 deneme)
  //    - Failed downloads listesi
  //    - Partial download resume
  // 7. İndirme geçmişi
  // 8. Otomatik dosya tipi tespiti
  // 9. CORS proxy desteği (blocked downloads için)
  // 10. Bandwidth throttling (hız sınırlama)
  // 11. İndirme zamanlaması (belirli saatte indir)
  // 12. Duplicate file check (aynı dosya zaten varsa)
  // 13. Base64 data URL'leri dosyaya çevirme
  // 14. Blob URL'leri handle etme
}
```

#### 4.7 - compression-helper.js
```javascript
class CompressionHelper {
  // 1. ZIP oluşturma (JSZip ile)
  //    - Birden fazla dosyayı ZIP'le
  //    - Klasör yapısı
  //    - Sıkıştırma seviyesi
  //    - Şifreleme (mümkünse)
  // 2. GZIP sıkıştırma (CompressionStream API)
  // 3. LZ-String sıkıştırma (storage için)
  // 4. Base64 encode/decode
  // 5. Data URL oluşturma
}
```

### FAZ 4 TESTLERİ:
```bash
# 1. Her export formatı için unit test (doğru output üretimi)
# 2. Büyük veri seti export testi (10000+ satır)
# 3. Special characters export testi (Türkçe karakterler, emoji, Unicode)
# 4. Empty data export testi
# 5. Nested data export testi
# 6. Download manager - tekli indirme testi
# 7. Download manager - toplu indirme testi
# 8. Download manager - ZIP indirme testi
# 9. Data cleaner pipeline testi
# 10. Data transformer testi (her dönüşüm tipi)
# 11. Deduplicator testi (exact ve fuzzy)
# 12. Validator testi (her kural tipi)
# 13. Clipboard export testi
# 14. Compression testi
# 15. Memory kullanımı testi (büyük export'larda)
```

**FAZ 4 BİTTİĞİNDE ONAY BEKLEME, FAZ 5'E GEÇ.**

---

## 🔧 FAZ 5: SIDE PANEL, OPTIONS VE GELİŞMİŞ ÖZELLİKLER

### Görevler:

#### 5.1 - Side Panel (sidepanel/)
```
Side panel, popup'ın genişletilmiş versiyonudur. Her zaman açık kalabilir.

LAYOUT:
┌──────────────────────────────────────┐
│  🕷️ Web Scraper Pro          🔲 ✕  │
├──────────────────────────────────────┤
│  [📊][🖼️][🔗][📝][📋][🏷️][🔬][🎯] │  <- Icon tab bar
├──────────────────────────────────────┤
│  🔍 Arama...     🔽Filter  ⚙️      │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │  SLIDESHOW / DATA VIEWER      │  │
│  │  ┌──────────────────────────┐ │  │
│  │  │                          │ │  │
│  │  │   Ana içerik alanı       │ │  │
│  │  │   (resim, tablo, metin)  │ │  │
│  │  │                          │ │  │
│  │  │                          │ │  │
│  │  └──────────────────────────┘ │  │
│  │  ◀️ 3/42 ▶️   ▶️⏸️  ⏭️  🔄    │  │
│  │  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐  │  │
│  │  │t1││t2││t3││t4││t5││t6│  │  │  <- Thumbnail strip
│  │  └──┘└──┘└──┘└──┘└──┘└──┘  │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  📋 Veri Tablosu                     │
│  ┌────────────────────────────────┐  │
│  │ ☐ │ Ad    │ Tip  │ Boyut │ ⚡ │  │
│  │ ☑ │ img1  │ jpg  │ 45KB  │ 🔗 │  │
│  │ ☑ │ img2  │ png  │ 120KB │ 🔗 │  │
│  │ ☐ │ img3  │ webp │ 30KB  │ 🔗 │  │
│  │ ...                            │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  ☑ 2/42 seçili                       │
│  [⬇️CSV][⬇️JSON][⬇️XLSX][⬇️ZIP][+] │
├──────────────────────────────────────┤
│  [🎯 Picker] [📸 SS] [⏰ Schedule]  │
│  [🔄 Auto] [📊 Compare] [💾 Save]   │
└──────────────────────────────────────┘

SLIDESHOW ÖZELLİKLERİ:
- Tam genişlik resim/içerik görüntüleme
- Otomatik oynatma (2s, 3s, 5s, 10s aralıklar)
- Manuel navigasyon (ok tuşları, butonlar, swipe)
- Thumbnail strip (alt kısımda)
- Zoom in/out (mouse wheel, pinch, butonlar)
- Fit to width / Fit to height / Original size
- Döndürme (90° saat yönünde/ters)
- Yatay/Dikey çevirme
- Resim bilgi overlay'i (dosya adı, boyut, URL, alt text)
- Resim karşılaştırma (yan yana iki resim)
- Tam ekran modu (F11)
- Picture-in-Picture modu
- Color picker (resimden renk seçme)
- OCR (resimden metin çıkarma - Tesseract.js, opsiyonel)
- Resim üzerine çizim/not ekleme
- Filtre uygulama (brightness, contrast, grayscale, blur)
- Slideshow transition efektleri (fade, slide, zoom, flip)
- Looping (sonsuz döngü)
- Shuffle (rastgele sıra)
```

#### 5.2 - Options Page (options/)
```
KAPSAMLI AYARLAR SAYFASI:

TAB 1: GENEL AYARLAR
- Tema: Light / Dark / Auto (sistem tercihi)
- Dil seçimi (2 dil)
- Popup/Side Panel tercihi (varsayılan olarak hangisi açılsın)
- Bildirimler (açık/kapalı, ses)
- Badge gösterimi (bulunan veri sayısı)
- Otomatik sayfa analizi (her sayfa açılışında)
- Startup behavior (son durumu hatırla, temiz başla)
- Keyboard shortcuts özelleştirme
- Font boyutu ayarı (popup/sidepanel içinde)
- Animasyonlar açık/kapalı
- Tooltip'ler açık/kapalı
- Compact/Comfortable view mode
- Auto-update check

TAB 2: KAZIMA AYARLARI
- Varsayılan kazıma derinliği (sadece görünen / tüm sayfa)
- Lazy load tetikleme (otomatik / manuel)
- Infinite scroll max sayfa
- Pagination max sayfa
- Rate limiting (istekler arası minimum bekleme)
- User-Agent string (custom)
- Referer policy
- Cookie handling
- JavaScript execution (content script'te eval desteği)
- Shadow DOM erişimi (açık/kapalı)
- Iframe erişimi (açık/kapalı)
- Max element sayısı (performans sınırı)
- Timeout ayarları
- Retry sayısı
- Proxy ayarları
- Cache süresi

TAB 3: EXPORT AYARLARI
- Varsayılan export formatı
- CSV ayırıcı tercihi
- JSON indentation
- XLSX tema/renk şeması
- PDF sayfa boyutu ve yönü
- Dosya adı şablonu
- İndirme klasörü
- Otomatik dosya açma
- ZIP sıkıştırma seviyesi
- Encoding tercihi (UTF-8, UTF-8 BOM, vb.)
- Max dosya boyutu uyarısı
- Büyük veri seti stratejisi (bölerek indir, stream)

TAB 4: FİLTRELEME AYARLARI
- Minimum resim boyutu (px)
- Minimum dosya boyutu (KB)
- Hariç tutulacak domain'ler (blacklist)
- Hariç tutulacak dosya tipleri
- Hariç tutulacak URL pattern'ları
- Sadece dahil edilecek domain'ler (whitelist)
- Content type filtreleri
- Regex filtreleri
- Custom filtre kuralları

TAB 5: ZAMANLANMIŞ GÖREVLER
- Aktif görev listesi
- Yeni görev oluştur:
  - URL
  - Kazıma şablonu
  - Çalışma sıklığı (her X dakika/saat/gün/hafta)
  - Export formatı
  - Bildirim tercihi
  - Karşılaştırma modu (önceki sonuçla diff)
  - Koşullu çalışma (sadece değişiklik varsa kaydet)
- Görev geçmişi
- Görev logları

TAB 6: ŞABLONLAR
- Hazır kazıma şablonları
  - E-ticaret ürün bilgileri (Amazon, eBay, Trendyol, Hepsiburada)
  - Haber makalesi (başlık, özet, içerik, tarih, yazar)
  - Sosyal medya profili
  - İş ilanı (LinkedIn, Indeed, Kariyer.net)
  - Emlak ilanı (Sahibinden, Hepsiemlak)
  - Restoran/yemek bilgileri
  - Film/dizi bilgileri (IMDb)
  - Kitap bilgileri (Amazon, Goodreads)
  - Araç ilanı
  - Blog yazısı
  - Ürün yorumları
  - Fiyat karşılaştırma
  - GitHub repo bilgileri
  - Stack Overflow soru/cevap
  - Wikipedia makale
- Özel şablon oluşturma
  - Template editor (görsel)
  - Selector tanımlama
  - Field mapping
  - Validation kuralları
  - Export formatı
  - Test butonu
- Şablon import/export (JSON)
- Şablon paylaşma

TAB 7: VERİ YÖNETİMİ
- Depolanan veri boyutu
- Storage kullanım grafiği (chart.js)
- Veri türüne göre dağılım
- Site bazlı veri miktarı
- Toplu silme
- Toplu export
- Import (önceki export'ları geri yükle)
- Otomatik temizleme kuralları
  - X günden eski verileri sil
  - X MB'dan büyükse eski verileri sil
  - Max kayıt sayısı

TAB 8: GELİŞMİŞ
- Developer mode
- Console logging seviyesi
- Network interceptor (açık/kapalı)
- Performance profiling
- Hata raporlama
- Telemetri (anonim kullanım istatistikleri, opsiyonel)
- API key yönetimi (gelecek entegrasyonlar için)
- Webhook URL (kazıma sonuçlarını POST et)
- CORS proxy URL'si
- Custom CSS injection
- Custom JavaScript injection
- Extension ID
- Version bilgisi
- Reset to defaults (tüm ayarları sıfırla)
- Export all settings
- Import settings

TAB 9: HAKKINDA
- Versiyon bilgisi
- Changelog
- Lisans
- Kredi (kullanılan kütüphaneler)
- Privacy policy
- Geri bildirim formu
- Destek bağlantıları
- Sosyal medya bağlantıları
- Star on GitHub CTA
- Donation/Support CTA
```

#### 5.3 - Scheduler (background/scheduler.js)
```javascript
class Scheduler {
  // chrome.alarms API kullanarak:
  // 1. Zamanlı kazıma görevi oluşturma
  //    - Tekrarlayan (her X dakika/saat/gün/hafta)
  //    - Tek seferlik (belirli tarih/saatte)
  //    - Cron-like syntax desteği
  // 2. Görev yönetimi (başlat, durdur, sil, düzenle)
  // 3. Görev çalıştırma
  //    - Hedef URL'yi yeni tab'da aç (arka planda)
  //    - Şablona göre kazımayı çalıştır
  //    - Sonuçları kaydet
  //    - Önceki sonuçla karşılaştır (diff)
  //    - Bildirim gönder
  //    - Tab'ı kapat
  // 4. Görev logları
  //    - Başarılı/başarısız
  //    - Çalışma süresi
  //    - Bulunan veri sayısı
  //    - Değişiklik özeti
  // 5. Hata yönetimi
  //    - Görev başarısızsa retry
  //    - Max retry sonrası duraklatma
  //    - Hata bildirimi
  // 6. Concurrent görev limiti
  // 7. Görev önceliği
  // 8. Bağımlı görevler (A bitince B'yi başlat)
}
```

#### 5.4 - Network Interceptor (background/network-interceptor.js)
```javascript
class NetworkInterceptor {
  // chrome.webRequest / declarativeNetRequest API ile:
  // 1. XHR/Fetch isteklerini izleme
  //    - Request URL, method, headers, body
  //    - Response status, headers, body
  //    - Timing bilgisi
  // 2. API endpoint tespiti
  //    - JSON response'ları yakala
  //    - REST API pattern'larını tespit et
  //    - GraphQL query'lerini tespit et
  // 3. AJAX ile yüklenen verileri yakala
  //    - Infinite scroll'da yüklenen veriler
  //    - Dynamic content updates
  //    - Search/filter sonuçları
  // 4. Resource monitoring
  //    - Yüklenen resimler
  //    - Yüklenen scriptler
  //    - Yüklenen stylesheetler
  //    - Yüklenen fontlar
  // 5. HAR (HTTP Archive) export
  //    - Tüm network trafiğini HAR formatında export et
  // 6. Request replay
  //    - Yakalanan isteği tekrar gönder
  //    - Parametreleri değiştirerek gönder
  // 7. Filtering
  //    - URL pattern'a göre filtrele
  //    - Content-Type'a göre filtrele
  //    - Status code'a göre filtrele
}
```

#### 5.5 - Tab Manager (background/tab-manager.js)
```javascript
class TabManager {
  // 1. Aktif tab bilgisi alma
  // 2. Yeni tab açma (arka planda)
  // 3. Tab navigasyonu (URL değiştirme)
  // 4. Tab kapama
  // 5. Tab event listener'lar (onUpdated, onRemoved, onActivated)
  // 6. Multi-tab scraping koordinasyonu
  //    - Birden fazla URL'yi sırayla aç ve kazı
  //    - Tab pool (max N tab aynı anda)
  //    - Tab bazlı sonuç toplama
  // 7. Tab screenshot alma
  //    - Visible area screenshot (chrome.tabs.captureVisibleTab)
  //    - Full page screenshot (scroll + stitch)
  // 8. Tab enjeksiyon yönetimi
  //    - Content script enjekte et
  //    - CSS enjekte et
  //    - executeScript ile kod çalıştır
}
```

#### 5.6 - Notification Manager (background/notification-manager.js)
```javascript
class NotificationManager {
  // 1. chrome.notifications API
  // 2. Bildirim tipleri:
  //    - Kazıma tamamlandı (başarılı)
  //    - Kazıma hata verdi
  //    - Zamanlanmış görev çalıştı
  //    - İndirme tamamlandı
  //    - Değişiklik tespit edildi (izleme modu)
  //    - Uyarı (storage doluyor, rate limit, vb.)
  // 3. Bildirim seçenekleri:
  //    - Başlık, mesaj, ikon
  //    - Progress bar
  //    - Butonlar (aç, kapat, tekrar dene)
  //    - Ses (opsiyonel)
  // 4. In-app bildirim (popup/sidepanel içinde toast)
  // 5. Bildirim geçmişi
  // 6. Bildirim tercihleri (hangi tip bildirimleri göster)
}
```

#### 5.7 - Screenshot Capture
```javascript
class ScreenshotCapture {
  // 1. Visible area screenshot
  //    - chrome.tabs.captureVisibleTab
  //    - PNG/JPEG format
  //    - Quality ayarı

  // 2. Full page screenshot
  //    - Sayfayı parça parça capture et
  //    - Parçaları birleştir (canvas ile)
  //    - Fixed/sticky elementleri handle et
  //    - Uzun sayfalarda memory yönetimi

  // 3. Element screenshot
  //    - Belirli bir elementi capture et
  //    - Element'in tam görünümü (scroll olmadan)
  //    - Padding/margin dahil/hariç

  // 4. Area screenshot
  //    - Kullanıcının seçtiği bölge
  //    - Crop tool (drag ile alan seçimi)

  // 5. Post-processing
  //    - Annotation (ok, çerçeve, metin ekleme)
  //    - Blur/pixelate (hassas veri gizleme)
  //    - Crop
  //    - Resize
  //    - Watermark

  // 6. Export
  //    - PNG, JPEG, WebP
  //    - PDF'e ekle
  //    - Clipboard'a kopyala
  //    - Base64 string

  // 7. Delayed screenshot (X saniye sonra çek)
  // 8. Serial screenshot (her X saniyede bir çek)
  // 9. Comparison screenshot (önce/sonra)
}
```

#### 5.8 - Utility Modülleri

**selector-engine.js:**
```javascript
class SelectorEngine {
  // 1. CSS Selector desteği (tam)
  // 2. XPath desteği (tam)
  // 3. jQuery-like selector desteği (sizzle uyumlu)
  // 4. Text-based selector (:contains simülasyonu)
  // 5. Regex-based selector
  // 6. Attribute selector (%helper)
  // 7. Nth-child, nth-of-type, vb.
  // 8. Pseudo-element desteği
  // 9. Multiple selector (virgülle ayrılmış)
  // 10. Selector validation (geçerli selector mı)
  // 11. Selector optimization (en kısa benzersiz selector)
  // 12. Selector suggestion (element'ten selector üret)
  // 13. Relative selector (parent element'e göre)
  // 14. Cross-frame selector
  // 15. Shadow DOM selector
}
```

**url-helper.js:**
```javascript
class URLHelper {
  // 1. URL parse (protocol, host, port, path, query, fragment)
  // 2. URL build (parçalardan URL oluştur)
  // 3. Relative to absolute URL çevirme
  // 4. URL normalization
  // 5. Query parameter parse/build
  // 6. URL comparison (aynı sayfa mı)
  // 7. Domain extraction (subdomain, domain, TLD)
  // 8. URL validation
  // 9. URL encode/decode
  // 10. URL pattern matching (glob, regex)
  // 11. Base URL extraction
  // 12. Same-origin check
  // 13. URL template (değişken yerleştirme)
  // 14. Pagination URL pattern detection
  // 15. Clean tracking parameters (utm_*, fbclid, vb.)
}
```

**regex-helper.js:**
```javascript
class RegexHelper {
  // Hazır regex pattern'ları:
  // - Email, URL, IP, telefon, tarih, para birimi
  // - HTML tag, CSS selector, JSON string
  // - Renk kodları (hex, rgb, hsl)
  // - Sosyal medya handle'ları
  // - Barkod/SKU formatları
  // - Kredi kartı numaraları (validasyon, maskeleme)
  // - Posta kodu (ülkeye göre)
  // - IBAN, Swift kodu
  // - ISBN, DOI
  // - Regex builder (UI ile regex oluşturma)
  // - Regex tester (metin üzerinde test)
  // - Named groups desteği
  // - Regex explanation (regex'i açıkla)
}
```

**error-handler.js:**
```javascript
class ErrorHandler {
  // 1. Global error boundary
  // 2. Error logging (chrome.storage'a)
  // 3. Error reporting (opsiyonel, webhook)
  // 4. Error recovery (hata sonrası devam)
  // 5. User-friendly error messages
  // 6. Error categorization (network, permission, parsing, storage, vb.)
  // 7. Stack trace capture
  // 8. Context capture (hangi modül, hangi işlem)
  // 9. Error history (son 100 hata)
  // 10. Error statistics (en çok hata veren modül)
  // 11. Retry logic (otomatik tekrar deneme)
  // 12. Fallback strategies
  // 13. Graceful degradation
  // 14. Debug mode (detaylı logging)
}
```

**performance-helper.js:**
```javascript
class PerformanceHelper {
  // 1. İşlem süre ölçümü (performance.now)
  // 2. Memory kullanım izleme (performance.memory)
  // 3. DOM operation count
  // 4. Network request count
  // 5. FPS monitoring
  // 6. Performance report oluşturma
  // 7. Bottleneck tespiti
  // 8. Cache hit/miss istatistikleri
  // 9. Storage usage tracking
  // 10. Web Vitals (LCP, FID, CLS)
  // 11. Performance budgets (limit aşıldığında uyar)
  // 12. Benchmarking tools
}
```

### FAZ 5 TESTLERİ:
```bash
# 1. Side panel açılma ve render testi
# 2. Slideshow navigasyon testi (önceki/sonraki, auto-play)
# 3. Slideshow zoom/rotate testi
# 4. Slideshow keyboard shortcut testi
# 5. Slideshow thumbnail strip testi
# 6. Options page tüm tab'lar render testi
# 7. Ayar kaydetme/yükleme testi
# 8. Tema değiştirme testi (options'tan)
# 9. Dil değiştirme testi (options'tan)
# 10. Scheduler - görev oluşturma testi
# 11. Scheduler - görev çalıştırma testi
# 12. Network interceptor testi
# 13. Tab manager - multi-tab scraping testi
# 14. Screenshot capture testi (visible area)
# 15. Screenshot capture testi (full page)
# 16. Notification testi
# 17. Selector engine - CSS selector testi
# 18. Selector engine - XPath testi
# 19. URL helper testi
# 20. Regex helper testi
# 21. Error handler testi
# 22. Performance helper testi
# 23. Template import/export testi
# 24. Storage management testi (kullanım istatistikleri)
```

**FAZ 5 BİTTİĞİNDE ONAY BEKLEME, FAZ 6'YA GEÇ.**

---

## 🧪 FAZ 6: KAPSAMLI TEST SÜİTİ VE KALİTE GÜVENCESİ

### Görevler:

#### 6.1 - Test Ortamı Kurulumu
```bash
# 1. Gerekli test araçlarını kur
npm init -y
npm install --save-dev playwright @playwright/test jest
npm install --save-dev puppeteer-core

# 2. Chromium/Chrome kur
npx playwright install chromium
npx playwright install-deps

# 3. Test helper'ları kur
npm install --save-dev http-server wait-on

# 4. Coverage tool
npm install --save-dev c8

# 5. Linting
npm install --save-dev eslint prettier
```

#### 6.2 - Test Fixture Sayfaları (tests/fixtures/)
Her test sayfası tam bir HTML dosyası olacak:

**test-page-tables.html:**
```html
<!-- Çeşitli tablo yapıları içeren test sayfası -->
<!-- 1. Basit tablo (3x5) -->
<!-- 2. Kompleks tablo (colspan, rowspan) -->
<!-- 3. Nested tablo (tablo içinde tablo) -->
<!-- 4. Başlıksız tablo -->
<!-- 5. Div-based tablo (CSS grid) -->
<!-- 6. Çok büyük tablo (100+ satır) -->
<!-- 7. Boş tablo -->
<!-- 8. Tek satırlık tablo -->
<!-- 9. DataTable kütüphanesi ile oluşturulmuş tablo -->
<!-- 10. Responsive tablo -->
<!-- 11. Sortable tablo -->
<!-- 12. Tablo içinde link/resim/form -->
```

**test-page-images.html:**
```html
<!-- Çeşitli resim yapıları içeren test sayfası -->
<!-- 1. Normal <img> tagları (jpg, png, gif, svg, webp) -->
<!-- 2. Lazy-loaded resimler (data-src) -->
<!-- 3. <picture> elementi (srcset, source) -->
<!-- 4. Background image (CSS) -->
<!-- 5. Inline SVG -->
<!-- 6. Base64 encoded resim -->
<!-- 7. Broken resim (404) -->
<!-- 8. Responsive resim (srcset, sizes) -->
<!-- 9. Canvas elementi -->
<!-- 10. Favicon -->
<!-- 11. Video poster image -->
<!-- 12. Image map -->
<!-- 13. CSS sprite -->
<!-- 14. Çok büyük resim -->
<!-- 15. Çok küçük resim (1x1 tracking pixel) -->
```

**test-page-links.html:**
```html
<!-- Çeşitli link yapıları -->
<!-- Internal, external, anchor, mailto, tel, javascript, download -->
<!-- Tüm rel attribute'lar (nofollow, sponsored, ugc, noopener) -->
<!-- Target attribute'lar (_blank, _self, _parent, _top) -->
<!-- Social media linkleri -->
<!-- File download linkleri -->
<!-- Broken linkler -->
```

**test-page-forms.html:**
```html
<!-- Çeşitli form yapıları -->
<!-- Text, email, password, number, date, file, hidden inputs -->
<!-- Select (single, multiple, optgroup) -->
<!-- Textarea, checkbox, radio -->
<!-- Custom form elements (div-based) -->
<!-- CSRF token'lı form -->
<!-- Multi-step form -->
```

**test-page-infinite-scroll.html:**
```html
<!-- Infinite scroll simülasyonu -->
<!-- Scroll ile yeni içerik yükleme (JavaScript) -->
<!-- IntersectionObserver ile lazy loading -->
<!-- 100+ item yüklenebilir -->
```

**test-page-lazy-load.html:**
```html
<!-- Lazy load simülasyonu -->
<!-- data-src, data-lazy-src, loading="lazy" -->
<!-- IntersectionObserver tabanlı -->
<!-- Placeholder resimler -->
```

**test-page-shadow-dom.html:**
```html
<!-- Shadow DOM test sayfası -->
<!-- Open shadow root -->
<!-- Nested shadow DOM -->
<!-- Custom elements -->
<!-- Slotted content -->
```

**test-page-spa.html:**
```html
<!-- Single Page Application simülasyonu -->
<!-- Hash-based routing -->
<!-- History API based routing -->
<!-- Dynamic content loading -->
<!-- Client-side rendering -->
```

**test-page-pagination.html:**
```html
<!-- Pagination test sayfası -->
<!-- Numaralı sayfalama -->
<!-- Önceki/Sonraki butonları -->
<!-- AJAX pagination -->
<!-- URL-based pagination -->
```

#### 6.3 - Playwright E2E Testleri (tests/e2e/)

**playwright.config.js:**
```javascript
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 2,
  workers: 1, // Extension testleri sıralı çalışmalı
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list']
  ],
  use: {
    headless: false, // Extension testleri headed olmalı
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            `--disable-extensions-except=${__dirname}/web-scraper-pro`,
            `--load-extension=${__dirname}/web-scraper-pro`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
        },
      },
    },
  ],
});
```

**smoke.spec.js (Smoke Testleri):**
```javascript
// 1. Extension yükleniyor mu?
// 2. Popup açılıyor mu?
// 3. Side panel açılıyor mu?
// 4. Options page açılıyor mu?
// 5. Service worker aktif mi?
// 6. Context menu oluşturuluyor mu?
// 7. Content script enjekte ediliyor mu?
// 8. Storage çalışıyor mu?
// 9. İkon doğru görünüyor mu?
// 10. i18n çalışıyor mu?
// 11. Theme toggle çalışıyor mu?
// 12. Badge güncelleniyor mu?
// 13. Keyboard shortcut çalışıyor mu?
// 14. İlk kurulumda hoş geldin sayfası açılıyor mu?
```

**full-workflow.test.js (Tam İş Akışı Testi):**
```javascript
// End-to-end tam senaryo:
// 1. Extension'ı yükle
// 2. Test sayfasına git
// 3. Popup'ı aç
// 4. Sayfa analizinin tamamlanmasını bekle
// 5. Tablo tab'ına geç, tabloları gör
// 6. Bir tablo seç
// 7. CSV olarak export et
// 8. İndirilen dosyayı kontrol et (içerik doğrulama)
// 9. Medya tab'ına geç
// 10. Resimleri gör
// 11. Slideshow'u aç
// 12. Slideshow'da gezin
// 13. Resim indir
// 14. Element picker aç
// 15. Bir element seç
// 16. Selector'ı doğrula
// 17. Seçilen element verisini JSON olarak export et
// 18. Side panel'e geç
// 19. Aynı verileri gör
// 20. Options sayfasını aç
// 21. Tema değiştir
// 22. Dil değiştir
// 23. Ayarları kaydet
// 24. Extension'ı yeniden başlat
// 25. Ayarların korunduğunu doğrula
```

**export-all-formats.test.js:**
```javascript
// Her export formatını test et:
// 1. Aynı veri setini her formatta export et
// 2. Dosyanın oluştuğunu doğrula
// 3. Dosya boyutunun > 0 olduğunu doğrula
// 4. Dosya içeriğinin valid olduğunu doğrula
//    - CSV: satır sayısı doğru mu
//    - JSON: parse edilebilir mi
//    - XLSX: SheetJS ile okuyabilir mi
//    - XML: well-formed mu
//    - HTML: valid HTML mi
//    - Markdown: tablo formatı doğru mu
//    - PDF: header doğru mu
//    - YAML: parse edilebilir mi
//    - SQL: syntax doğru mu
// 5. Special characters test (Türkçe, emoji, Unicode)
// 6. Empty dataset test
// 7. Large dataset test (1000+ rows)
// 8. Nested data test
```

**slideshow.test.js:**
```javascript
// Slideshow testleri:
// 1. Slideshow açılıyor mu
// 2. Resimler yükleniyor mu
// 3. Önceki/Sonraki navigasyonu çalışıyor mu
// 4. Thumbnail strip çalışıyor mu
// 5. Otomatik oynatma çalışıyor mu (timer doğru mu)
// 6. Zoom in/out çalışıyor mu
// 7. Döndürme çalışıyor mu
// 8. Tam ekran modu çalışıyor mu
// 9. Keyboard navigasyon (ok tuşları, ESC) çalışıyor mu
// 10. Bilgi overlay'i doğru veri gösteriyor mu
// 11. İndirme butonu çalışıyor mu
// 12. İlk/son resimde boundary handling doğru mu
// 13. Boş galeri durumu doğru handled ediliyor mu
// 14. Transition animasyonları çalışıyor mu
```

**performance.test.js:**
```javascript
// Performans testleri:
// 1. Popup açılış süresi < 500ms
// 2. Sayfa analiz süresi < 2s (normal sayfa)
// 3. Tablo çıkarma süresi < 1s (10 tablo)
// 4. Resim listesi oluşturma süresi < 1s (100 resim)
// 5. CSV export süresi < 500ms (1000 satır)
// 6. JSON export süresi < 200ms (1000 satır)
// 7. Element picker açılış süresi < 300ms
// 8. Side panel render süresi < 500ms
// 9. Memory kullanımı < 50MB (idle)
// 10. Memory kullanımı < 200MB (aktif scraping)
// 11. Service worker startup süresi < 100ms
// 12. Storage read/write süresi < 50ms
// 13. DOM element sayısı testi (10000+ element sayfada)
// 14. Aynı anda 5 tab'da çalışma testi
```

#### 6.4 - Jest Unit Testleri (tests/unit/)
Her utility modülü için kapsamlı unit testler:

```javascript
// export-csv.test.js
// - Normal veri, boş veri, tek satır, 10000 satır
// - Farklı ayırıcılar
// - Special characters (virgül, tırnak, newline)
// - UTF-8 encoding
// - Header dahil/hariç

// data-cleaner.test.js
// - HTML strip, whitespace normalization
// - Unicode normalization
// - Date normalization (20+ format)
// - Email/Phone normalization
// - XSS temizleme
// - Custom pipeline

// selector-engine.test.js
// - CSS selector matching
// - XPath evaluation
// - Selector generation (element'ten)
// - Selector validation
// - Complex selectors (nth-child, :not, :has)

// url-helper.test.js
// - URL parse/build
// - Relative to absolute
// - Query parameter handling
// - URL validation
// - Domain extraction
// - Pagination URL detection
```

#### 6.5 - Continuous Integration Hazırlığı
```bash
# package.json scripts:
{
  "scripts": {
    "test": "npm run test:unit && npm run test:e2e",
    "test:unit": "jest --coverage",
    "test:e2e": "npx playwright test",
    "test:smoke": "npx playwright test tests/smoke.spec.js",
    "test:slideshow": "npx playwright test tests/e2e/slideshow.test.js",
    "test:export": "npx playwright test tests/e2e/export-all-formats.test.js",
    "test:perf": "npx playwright test tests/e2e/performance.test.js",
    "test:all": "npm run lint && npm run test:unit && npm run test:e2e",
    "lint": "eslint .",
    "format": "prettier --write .",
    "serve:fixtures": "http-server tests/fixtures -p 8080 -c-1",
    "report": "npx playwright show-report",
    "clean": "rm -rf test-results coverage"
  }
}
```

### FAZ 6 TESTLERİ:
```bash
# TÜM testleri çalıştır:

# 1. Test fixture sayfalarını serve et
npm run serve:fixtures &

# 2. Smoke testlerini çalıştır
npm run test:smoke

# 3. Unit testlerini çalıştır (coverage ile)
npm run test:unit

# 4. E2E testlerini çalıştır
npm run test:e2e

# 5. Performance testlerini çalıştır
npm run test:perf

# 6. Slideshow testlerini çalıştır
npm run test:slideshow

# 7. Export testlerini çalıştır
npm run test:export

# 8. Lint check
npm run lint

# 9. Sonuçları raporla
npm run report

# HEPSİ GEÇMEK ZORUNDA. Geçmeyen test varsa düzelt ve tekrar çalıştır.
# Coverage %80+ olmalı.
```

**FAZ 6 BİTTİĞİNDE ONAY BEKLEME, FAZ 7'YE GEÇ.**

---

## 📖 FAZ 7: DOKÜMANTASYON, POLİSH VE FİNAL

### Görevler:

#### 7.1 - README.md
```markdown
# Kapsamlı README:
# - Proje açıklaması (ne işe yarar, neden kullanmalı)
# - Feature listesi (tüm özellikler, ikonlarla)
# - Screenshot'lar / GIF'ler (popup, sidepanel, options, element picker, slideshow)
# - Kurulum adımları (Chrome ve Edge için ayrı ayrı)
# - Hızlı başlangıç kılavuzu
# - Keyboard shortcuts tablosu
# - Desteklenen export formatları tablosu
# - Desteklenen diller tablosu
# - Mimari diyagram (modüller arası ilişkiler)
# - Katkıda bulunma (CONTRIBUTING.md'ye link)
# - Lisans
# - Teşekkürler / Kullanılan kütüphaneler
# - FAQ
# - Bilinen sorunlar
# - Yol haritası (roadmap)
# - İletişim
```

#### 7.2 - USER-GUIDE.md
```markdown
# Detaylı kullanım kılavuzu:
# 1. Kurulum
# 2. İlk kullanım
# 3. Popup kullanımı (her tab açıklamalı)
# 4. Side Panel kullanımı
# 5. Element Picker kullanımı (adım adım, ekran görüntüleriyle)
# 6. Slideshow kullanımı
# 7. Export formatları (her format ne zaman kullanılır)
# 8. Zamanlanmış görevler
# 9. Şablonlar (hazır ve özel)
# 10. Ayarlar açıklaması
# 11. Sorun giderme
# 12. İpuçları ve püf noktaları
# 13. Gelişmiş kullanım senaryoları
```

#### 7.3 - CHANGELOG.md
```markdown
# Changelog:
# v1.0.0 - Initial Release
# - Tüm özellikler listelenerek
```

#### 7.4 - PRIVACY.md
```markdown
# Gizlilik politikası:
# - Hangi veriler toplanır (TOPLANIYOR: hiçbiri sunucuya gönderilmez)
# - Veriler nerede saklanır (lokal tarayıcı storage'ında)
# - Üçüncü parti paylaşım (YAPILMAZ)
# - İzinlerin açıklaması (her permission neden gerekli)
# - İletişim
```

#### 7.5 - Final Polish
```
1. Tüm dosyalarda tutarlı kod stili (prettier)
2. Tüm dosyalarda JSDoc yorumları
3. Tüm hata mesajlarının kullanıcı dostu olması
4. Tüm loading state'lerinin gösterilmesi
5. Tüm empty state'lerinin gösterilmesi
6. Tüm error state'lerinin gösterilmesi
7. Tüm tooltip'lerin eklenmesi
8. Tüm ARIA attribute'larının eklenmesi (erişilebilirlik)
9. Tab order'ın doğru olması
10. Focus management'ın doğru olması
11. Screen reader uyumluluğu
12. Renk kontrastı kontrolü (WCAG AA)
13. Print styling
14. Offline çalışma (CDN yerine libs/ kullanımı)
15. Graceful degradation (eski tarayıcılar için)
16. Extension badge ikonunun doğru güncellenmesi
17. Memory leak kontrolü
18. Event listener cleanup
19. Console.log temizliği (sadece debug modunda)
```

#### 7.6 - Kütüphane Dosyaları (libs/)
```
Aşağıdaki kütüphanelerin minified versiyonlarını libs/ klasörüne indir:
(Offline çalışma için, CDN erişilemezse fallback olarak)

1. xlsx.min.js (SheetJS) - Excel export
   URL: https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js

2. jspdf.min.js - PDF export
   URL: https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js

3. jspdf-autotable.min.js - PDF tablo eklentisi
   URL: https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js

4. turndown.min.js - HTML to Markdown
   URL: https://unpkg.com/turndown/dist/turndown.js

5. jszip.min.js - ZIP oluşturma
   URL: https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js

6. dayjs.min.js - Tarih işleme
   URL: https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.10/dayjs.min.js

7. dompurify.min.js - XSS temizleme
   URL: https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.8/purify.min.js

8. js-yaml.min.js - YAML işleme
   URL: https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js

9. chart.min.js - Grafik çizme
   URL: https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js

10. lz-string.min.js - Veri sıkıştırma
    URL: https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js

11. readability.min.js - Mozilla Readability (article extraction)
    // Readability CDN yoksa, inline olarak yaz (MIT lisanslı)

12. sql-formatter.min.js - SQL formatting
    URL: https://unpkg.com/sql-formatter/dist/sql-formatter.min.js

Wget/curl ile indirmek yerine fetch ile de indirebilirsin.
Önemli: Her kütüphanenin lisansını kontrol et ve docs/LICENSE-THIRD-PARTY.md'ye ekle.
```

### FAZ 7 TESTLERİ:
```bash
# 1. Son kez TÜM testleri çalıştır
npm run test:all

# 2. Lint check (0 hata)
npm run lint

# 3. Kütüphane dosyalarının varlığı kontrolü
# 4. i18n tüm diller için mesaj kontrolü (eksik key var mı)
# 5. Manifest.json validation
# 6. README render kontrolü
# 7. Accessibility audit (basit kontroller)
# 8. Extension boyut kontrolü (toplam < 10MB)
# 9. Performans son check

# TÜM TESTLER GEÇMEK ZORUNDA!
```

---

## 🏁 SON KONTROL LİSTESİ

Tüm fazlar tamamlandıktan sonra şu kontrol listesini gez:

```
✅ manifest.json geçerli ve eksiksiz
✅ Tüm ikonlar mevcut (16, 32, 48, 128, grayscale)
✅ Service worker hatasız çalışıyor
✅ Popup açılıyor ve tüm tab'lar çalışıyor
✅ Side panel açılıyor ve çalışıyor
✅ Options sayfası açılıyor ve ayarlar kaydediliyor
✅ Content script enjekte ediliyor
✅ Element picker çalışıyor (highlight, select, generate selector)
✅ Tablo çıkarma çalışıyor (tüm tablo tipleri)
✅ Medya çıkarma çalışıyor (img, video, audio, embed)
✅ Link çıkarma çalışıyor (tüm link tipleri)
✅ Metin çıkarma çalışıyor (headings, paragraphs, article mode)
✅ Form çıkarma çalışıyor
✅ Meta çıkarma çalışıyor (OG, Twitter, Dublin Core)
✅ Schema çıkarma çalışıyor (JSON-LD, Microdata)
✅ Stil çıkarma çalışıyor (fontlar, renkler)
✅ DOM monitoring çalışıyor
✅ Infinite scroll handler çalışıyor
✅ Pagination handler çalışıyor
✅ Lazy load handler çalışıyor
✅ Shadow DOM handler çalışıyor
✅ CSV export çalışıyor (doğru çıktı)
✅ JSON export çalışıyor (valid JSON)
✅ XLSX export çalışıyor (açılabilir dosya)
✅ XML export çalışıyor (well-formed)
✅ HTML export çalışıyor (standalone page)
✅ Markdown export çalışıyor (doğru format)
✅ PDF export çalışıyor (açılabilir dosya)
✅ YAML export çalışıyor (valid YAML)
✅ SQL export çalışıyor (valid SQL)
✅ Clipboard export çalışıyor
✅ ZIP export çalışıyor (birden fazla dosya)
✅ Download manager çalışıyor (tekli, toplu, ZIP)
✅ Slideshow çalışıyor (navigasyon, autoplay, zoom, rotate)
✅ Dark mode çalışıyor (popup, sidepanel, options)
✅ i18n çalışıyor (en az 2 dil)
✅ Keyboard shortcuts çalışıyor (tüm kısayollar)
✅ Context menu çalışıyor (tüm menü öğeleri)
✅ Scheduler çalışıyor (zamanlanmış görevler)
✅ Screenshot capture çalışıyor
✅ Network interceptor çalışıyor
✅ Data cleaner çalışıyor
✅ Data transformer çalışıyor
✅ Data deduplicator çalışıyor
✅ Data validator çalışıyor
✅ Regex helper çalışıyor
✅ URL helper çalışıyor
✅ Error handler çalışıyor (graceful error handling)
✅ Storage manager çalışıyor (CRUD, import/export)
✅ Notifications çalışıyor
✅ Badge güncelleniyor
✅ Template sistemi çalışıyor (hazır + özel)
✅ Performance kabul edilebilir (tüm metrikler OK)
✅ Memory leak yok
✅ Tüm unit testleri geçiyor
✅ Tüm E2E testleri geçiyor
✅ Tüm smoke testleri geçiyor
✅ Lint hataları yok
✅ README yazıldı
✅ User Guide yazıldı
✅ Privacy Policy yazıldı
✅ Tüm lib dosyaları mevcut
✅ Erişilebilirlik (a11y) kontrolleri yapıldı
✅ Cross-browser test (Chrome + Edge)
```

---

## ⚠️ GENEL KURALLAR (TÜM FAZLAR İÇİN)

1. **DURMA:** Hiçbir fazda durup onay bekleme. Testler geçiyorsa sonraki faza geç.
2. **ÇÖZÜM BUL:** "Yapamadım", "bu kütüphane yok", "bu API desteklenmiyor" DEME. Alternatif bul, workaround yaz, inline implemente et.
3. **TEST ET:** Her fazda mutlaka Chromium kur, extension'ı yükle, testleri çalıştır.
4. **EKLE:** Aklına gelen ama burada yazılmamış her özelliği de ekle.
5. **KALİTE:** Kod temiz, okunabilir, yorumlu, performanslı olsun.
6. **HAKKANİYET:** Hiçbir scraping aracı yasadışı kullanım için teşvik edilmez. README'de etik kullanım notu ekle.
7. **HATA TOLERANSI:** Her modül bağımsız çalışabilmeli. Bir modül hata verse diğerleri etkilenmemeli.
8. **GERİYE UYUMLULUK:** Chrome 110+ ve Edge 110+ destekle.
9. **BOYUT OPTİMİZASYONU:** Extension toplam boyutu < 10MB olmalı.
10. **GÜVENLİK:** XSS, injection, data leakage risklerine karşı önlem al. DOMPurify kullan. eval() KULLANMA. innerHTML yerine textContent tercih et (güvenilmeyen veriler için).

---

## 📊 ÖZET TABLOsu

| Faz | Açıklama | Tahmini Süre | Dosya Sayısı |
|-----|----------|-------------|--------------|
| 1   | Temel Altyapı | 45 dk | ~20 |
| 2   | Popup UI | 60 dk | 3 + |
| 3   | Content Scripts | 90 dk | 15 |
| 4   | Export Sistemi | 60 dk | 15 |
| 5   | Side Panel + Options + Gelişmiş | 75 dk | 20+ |
| 6   | Test Süiti | 60 dk | 25+ |
| 7   | Dokümantasyon + Final | 30 dk | 10+ |
| **TOPLAM** | | **~7 saat** | **~110+ dosya** |

---

## 🚀 BAŞLA!

Şimdi FAZ 1'den başla. Her fazı tamamladıktan sonra:
1. Testleri çalıştır
2. Hataları düzelt
3. Testler geçtiyse sonraki faza geç
4. Tüm fazlar bittiğinde son kontrol listesini gez
5. Her şey OK ise "PROJE TAMAMLANDI" mesajı ver

**BAŞARILI OL! 🕷️**
