# Web Scraper — Özellik Envanteri ve Geliştirme Planı

> Bu belge, eklentideki **mevcut tüm özellikleri** ve her birinin **yerel (offline)
> geliştirme planını** içerir. Planlanan hiçbir madde yapay zekâ, bulut servisi,
> uzaktan analiz veya harici bir API'ye bağımlı **değildir**. Tüm iyileştirmeler
> saf HTML + CSS + Vanilla JavaScript (Manifest V3) ile, tarayıcı API'leri ve
> depodaki mevcut modüller üzerinden uygulanabilir şekilde tasarlanmıştır.

---

## 1. Proje Özeti

| Katman | Konum | Açıklama |
|---|---|---|
| Chrome/Edge/Brave kaynağı | `chrome-edge/` | Tek gerçek kaynak ağacı (elle düzenlenen tek yer) |
| Firefox/Tor derlemesi | `tor/` | `npm run build:tor` ile otomatik üretilir (elle düzenlenmez) |
| DevTools paneli | `chrome-edge/devtools/panel.html` | `npm run build:panel` ile dashboard'dan üretilir |
| Testler | `test/` | Node.js test runner + jsdom (`npm test`, 215 test) |
| Derleme araçları | `tools/` | panel/tor üretimi ve `--check` CI denetimleri |

Mimari: AMD/CommonJS/browser global üçlüsüyle paketlenmiş UMD modüller;
build adımı, bundler ve bağımlılık yok (testlerde yalnızca jsdom).

---

## 2. Mevcut Özellikler ve Geliştirme Planı

### 2.1 Görsel Seçici (Point-and-Click Picker) — `content/selector_picker.js`
**Şu an:** Hover vurgulama, çoklu seçim + otomatik genelleme, Parent `[P]` /
Child `[C]` dolaşımı, canlı eşleşme sayısı, eleman önizleme, sayfa içi veri
önizleme tablosu, gölge DOM (shadow root) içine görünen sorgular, parent kapsama
alanı (`scopeSelector`) kısıtlaması, rAF ile kare başına tek highlight güncellemesi.

**Geliştirme (tamamen yerel):**
- Önizleme tablosunda kolon türü sezimi: seçici türüne göre (Link/Image/Attr)
  otomatik sütun gösterimi ve hücre içerik kırpma uzunluğunun ayarlanabilmesi.
- Seçim geçmişine "geri al" (son tıklamayı iptal) ve `Ctrl+A` ile kapsam içi
  tüm eşleşmeleri seç kısayolları.
- Kapsam (scope) içine girince URL hash'i yerine `history.replaceState` ile
  durum koruması; panel yeniden yüklense bile seçime devam.
- Dokunmatik/klavye erişilebilirliği: `Tab` ile eleman gezdirme, `Enter` ile seç.

### 2.2 Seçici Türleri (13 tip) — `src/models/Selector.js`, `src/engine/SelectorEngine.js`
**Şu an:** Text, Link, Link(Popup), Image, Table, Element(container), Element
Attribute, HTML, Grouped, Pagination, Element Click, Element Scroll, XPath.
Türlerde regex ayıklama, `multiple`, gecikme, `transforms` (trim/case/capitalize/
number/regexReplace) ve `defaultValue` desteği. `linkFromScript` artık gerçekten
`window.open(...)`/`data-url` çözümlüyor; Image seçicideki "yerelde indir"
kazıma bitince galeri indirme kuyruğunu otomatik başlatıyor.

**Geliştirme:**
- **Element Click · discardInitialElements**: iki aşamalı snapshot ile
  tıklama-öncesi elemanların ayıklanıp yalnızca yeni yüklenenlerin kayda
  geçmesi (mevcut fetch-akışında yarım kalan tek ayar; DOM diff'i yerel).
- **Table**: colspan/rowspan farkındalığı ve "başlık satırını otomatik algıla"
  güçlendirmesi (th sayımı + ilk satır doluluk skoru).
- **Grouped**: ayraç yerine JSON dizi çıktısı seçeneği (kolon tipinin
  Excel/CSV'de bozulmaması için).
- **XPath**: predicate tabanlı çoklu eşleme testleri ve hata mesajlarının
  UI'da gösterimi (şu an console'a yazılıyor).
- Yeni yerel tür önerisi: **SelectorDiff / Değişim Takibi** — aynı sitemap'in
  iki kazıması arsındaki farkı depodaki kayıtlarla yerel olarak hesaplayıp
  "yeni/kaybolan/değişen" etiketiyle listleyen kolon üreticisi.

### 2.3 URL Aralığı Genişletme — `src/engine/UrlRangeExpander.js`
**Şu an:** Sayısal, sıfır dolgulu, adımlı `[0-100:10]`, alfabetik `[a-z]`,
virgülle liste, kartezien çarpım; 100.000 URL güvenlik tavanı; canlı önizleme
(giriş ekranında debounce'lu sayı + örnek URL'ler + tavan uyarısı).

**Geliştirme:**
- `[1-100:10]` yanı sıra `[start,step]` biçimi ve negatif adımlı listeler.
- Genişletme sonucunu kopyalama / `.txt` indirme butonları (yalnızca Blob).
- Taslak: `Tarih aralığı [2024-01-01..2024-12-31:7d]` üretici (tamamen yerel
  Date matematiği).

### 2.4 Kazıma Motoru ve Zamanlayıcı — `src/engine/ScraperEngine.js`
**Şu an:** Kuyruk + BFS, `requestInterval`/`pageLoadDelay`/`maxPages`, `maxDepth`,
include/exclude glob desenleri, üstel geri çekilmeli `requestRetries`,
(parent,url) bazlı kuyruk tekilleştirme, pause/resume/stop, canlı metrikler;
kardeş alan mirası artık **seçim sırasından bağımsız** (iki geçişli akış);
gölge DOM delme sitemap seçeneği olarak kalıcı.

**Geliştirme:**
- `concurrency` seçeneğinin UI'ya bağlanması (motor altyapısı hazır; kuyruk
  worker havuzu, hâlâ sıralı çalışıyor) — yalnızca yerel zamanlayıcı işi.
- Sayfa başına bellek tavanı: sonuç akışını IndexedDB tamponuna yazıp
  büyük kazımalarda `results` dizisini budama (yerel depolama, sunucu yok).
- `robots.txt` **yerel** okuyucusu (fetch + mini parser) — opsiyonel anahtar;
  yalnızca kullanıcı açarsa uygulanır, ağaç taramasına saygı modu.
- Kazıma durumunun (kuyruk, visited) JSON dışa/İçe aktarımı → "kaldığı yerden
  devam et" (yerel dosya, sunucu yok).
- Zaman aşımı (per-request timeout) ve `AbortController` ile iptal edilebilir
  fetch; takılı sayfaları logda "timeout" olarak işaretleme.

### 2.5 Sekme-Tabanlı JS Enjeksiyonlu Çalıştırıcı — `dashboard.js` + `content/scraper_content.js`
**Şu an:** Arka plan sekmesi açıp `document.documentElement.outerHTML` kazıma;
click/scroll aksiyonlarını içerik scripti ile uygulama; sekme kapanma/hata
yollarında temizlik; Tor tarafında promise-tabanlı `browser.*` sürümü.

**Geliştirme:**
- `chrome.tabs.captureVisibleTab` YERİNE — sekme başına "hazır olma" kriteri
  olarak `readyState` + ağ kararsızlığı (networkidle benzeri, yerel sayaç)
  algısı: dinamik sayfaların yarım yakalanmasını azaltır.
- Aksiyon seçimlerini sayfa bazında önbellekleme (aynı şablondaki sayfalarda
  click desenini yeniden keşfetmeme).
- "İstemciyi gizleme" yerine tutarlı görünüm: enjeksiyon modunda `prefers-
  reduced-motion` zorlamasıyla gereksiz animasyon/scroll beklemelerini kısaltma.

### 2.6 Veri Görüntüleyici — `dashboard.js` (browse-data)
**Şu an:** Sıralama (çok kolonlu, shift+tık), global arama + kolon bazlı filtre,
kolon gizleme (oturuma özel localStorage), sayfalama + sayfa boyutu, istatistik
çubuğu (n/Σ/x̄/min/max — büyük veride yığın taşması olmayacak şekilde döngüsel),
hücre düzenleme (anında depoya yazar), satır silme, bul/değiştir (regex,
büyük/küçük harf, tam kelime, kolon seçimi), sitemap değişince filtre sıfırlama.

**Geliştirme:**
- Kolon tipleri: tarih/sayı/metin algılamayı kalıcı hale getirme (sitemap
  başına kolon tipi eşlemesi; yerel).
- Tabloya "Yalnızca seçili satırları dışa aktar" (satır onay kutuları) ve
  çift tıklamayla satır detay modalı.
- Sütun genişliklerini sürükleme ile ayarlama ve localStorage'a yazma.
- Dışa aktarımda "filtrelenmiş görünüme göre" modu (mevcut kopyalama
  davranışının CSV/Excel butonlarına genelleştirilmesi).
- Sanallaştırma: 10k+ satırda yalnızca görünen satırların DOM'a basılması
  (mevcut sayfalama ile entegre, bağımlılıksız yerel çözüm).

### 2.7 Dışa Aktarma — `src/export/Exporter.js`, `lib/csv.js`, `lib/xlsx.js`, `lib/zip.js`
**Şu an:** CSV (RFC 4180, BOM, ayraç seçenekleri), SpreadsheetML `.xls`, gerçek
OOXML `.xlsx` (STORE-zip ile), JSON, TSV, NDJSON, HTML tablosu olarak panoya
kopyalama (zengin içerik), sitemap JSON dışa/içe aktarma, toplu yedek, ZIP galeri
indirme (artık başarısız HTTP yanıtlarını atlar; 4'lü paralel indirme).

**Geliştirme:**
- `.xlsx` için DEFLATE yerine **store** korunarak 65k+ satır / 4GB+ ZIP64
  sınır kontrolü + kullanıcıya bölme uyarısı.
- CSV'de tarih/sayı biçimi seçenekleri (TR ondalık `1,23` üretme seçeneği —
  yerel Intl ile).
- Markdown tablosu + kopyalama (kolon hizalı, kaçışlı) — panoya zengin metin.
- XML (Dataset) dışa aktarımı: mevcut SpreadsheetML altyapısıyla düşük maliyet.
- Dışa aktarma şablonlarını (kolon sırası + yeniden adlandırma) sitemap'e
  gömme; içe aktarmada ters eşleme.
- ZIP'e `manifest.json`-beni bir `meta.json` (kazıma bilgileri, kayıt sayısı,
  zaman damgası) ekleme — hepsi yerel üretim.

### 2.8 Görsel Galeri ve Slayt Gösterisi — `dashboard.js`
**Şu an:** Kolon ayarlı ızgara, URL satır içi düzenleme, tekil silme, toplu/seçili
ZIP, tam ekran slayt (fade/slide/zoom/cut), otomatik oynatma aralığı, fare
tekerleği + ok tuşları + Space/Esc, 2 sn sonra kontrollerle birlikte imlecin de
saklanması, slayttan tek görsel indirme (orijinal ad+uzantı), indirme yöneticisi
(ilerleme çubuğu, hata listesi, yeniden dene, iptal; çakışma-güvenli adlar).

**Geliştirme:**
- Galeri "görsel boyutu/kaynak filtre" ön ayarları (yalnızca 300px+ gibi;
  yerel `Image()` ölçümü).
- Kare (grid) yoğunluğu, hafif yakınlaştırma (CSS zoom) ve `loading=lazy`
  zaten var; "yalnızca yüklenemeyenleri göster" hata filtresi.
- ZIP'e seçili görsellerin JSON yan-dosya listesi (`index.json`) eklenmesi.
- Slaytta EXIF başlığı yerine yerel `Image.decode()` + `naturalWidth` ile
  çözünürlük rozeti (harici kütüphane yok).

### 2.9 Sitemap Yönetimi, Hiyerarşi ve Şablonlar — `src/models/Sitemap.js`, `lib/sitemap_templates.js`
**Şu an:** Oluşturma/kopyalama/silme/arama; sürükle-bırak ile nesteleme ve
kardeş sıralama (döngü korumalı); seçici ID yeniden adlandırma artık hiyerarşiyi
**koruyor** ve çakışan ID'yi reddediyor; geri-al/yinele (Ctrl+Z / Ctrl+Y);
webscraper.io sitemap JSON'u içe aktarma (normalizasyon + kısmi hata raporu);
yerleşik 5 şablon + kullanıcı şablonları (kaydet/kullan); URL önizleme.

**Geliştirme:**
- Sitemap karşılaştırma ("farkları göster") — iki sürüm arasındaki seçici
  değişikliklerinin yerel diff'i; mevcut JSON export ile beslenir.
- Şablon Galerisi genişletme: forum/liste-yorum/fiyat takibi iskeletleri
  (yalnızca depodaki statik veri, ağ isteği yok).
- Kopyalama sırasında ID çakışmalarını otomatik son-ek ile çözme
  (`_copy2` davranışının seçicilere de uygulanması).
- Döngüsel bağımlılık denetiminin `reorderSibling`'de de bildirim üretmesi
  (sessiz `false` yerine kullanıcı mesajı).

### 2.10 Seçici Hiyerarşi Grafiği — `src/ui/SelectorGraph.js`
**Şu an:** SVG ağaç; renk kodlu tür pilleri; pan/zoom/reset; düğüme tıklayınca
seçici düzenleme; döngü düğümleri işaretli (ölü döngü koruma kodu temizlendi).

**Geliştirme:**
- Düğüm sürükleyip başka düğüme bırakarak yeniden ebeveynleme (mevcut drag &
  drop mantığının grafiğe bağlanması; kaydetme zaten `Sitemap.reparentSelector`).
- Klavye ile gezinme ve ARIA ağaç rolleri.
- Grafiği PNG olarak indirme (`canvas.drawImage` + SVG serileştirme — yerel).
- Dallanmış tipleri (Link/Element) vurgulayan "akış vurgusu" modu.

### 2.11 Depolama — `src/storage/Storage.js`
**Şu an:** Öncelik `chrome.storage.local`; Firefox'ta IndexedDB; standalone'da
localStorage; örnek sitemap'lerin ilk açılışta tohumlanması; veri kayıtlarının
sitemap başına saklanması; yer imi şablonları; bozuk kayıtlara tolerans.

**Geliştirme:**
- Kazınan veriler için IndexedDB'ye **parçalı yazım** (kayıt blokları;
  `unlimitedStorage` kotası aşımında yumuşak davranış + kullanıcı uyarısı).
- Depolama doluluk göstergesi ve "en eski kazımayı temizle" bakım aracı.
- Uygulama içi şema sürümü (`schemaVersion`) ile migrate zinciri;
  geri-dönüşlü yedek.
- `browser.storage.session` kullanımı: sekme-geçici durum (aktif kazıma
  imleci) — Chrome/Edge/Firefox'un yerel API'si.

### 2.12 Artımlı Kazıma Modları — `lib/datamode.js`
**Şu an:** replace / append / merge (anahtar kolona göre yerinde güncelleme);
anahtarsız merge → append'e düşer ve uyarır; veri özeti loglanır.

**Geliştirme:**
- Anahtar kolon yerine **birden fazla anahtar** (bileşik anahtar) desteği.
- `merge` moduna "silme algılama" (kaybolan anahtarları `stale=true` işaretle
  — silmek opsiyonel).
- Mod seçimini sitemap'e kalıcı yazma (şu an UI seçimi her kazımada okunuyor).

### 2.13 Metin Dönüşümleri — `lib/transforms.js`
**Şu an:** trim, lowercase, uppercase, capitalize, TR/ABD yerelleştirmeli sayı
 ayrıştırma (`1.234,56 ₺` → 1234.56), regexReplace ($1 gruplu); dizi sonuçların
 her elemanına uygulanır; `defaultValue`; editörde sıralama/çıkarma.
 **Düzeltilen kritik hata:** `transforms.js`, `dashboard.html`'de motordan
 sonra yükleniyordu; tarayıcıda motor modülü `undefined` yakalayıp tüm
 kazımalarda `TypeError` üretiyordu — artık motordan önce yükleniyor ve bu
 sıra bir testle kilitlendi.

**Geliştirme:**
- Yeni yerel adımlar: `title-case istisnaları`, `boşluk normalizasyon (NBSP)`,
  `sıra-boz` (split-sort-join), `sayı→para birimi biçimle` (Intl),
  `kısalt (ellipsis)` , `boş değerleri sıfır yap`.
- Dönüşüm zincirini önizleme: seçici düzenleme ekranında "örnek metinle dene"
  kutusu (yerel, anında çalışır).

### 2.14 Arayüz, Tema ve Erişilebilirlik — `dashboard.css`, `popup`, DevTools paneli
**Şu an:** Tek karanlık palet (CSS değişkenleri), `color-scheme: dark`, tarayıcı
kontrolü temalı tema; popup, panel ve picker'da aynı tema; klavye kısayolları
(Ctrl+Alt+N/S/D/G, ?, F1 yardım diyalogu); dil EN/TR (tam sözlük, çift anahtar
hatası giderildi: `downloadImages` / `downloadImagesAll` ayrıldı).

**Geliştirme:**
- Açık tema seçeneği (`[data-theme="light"]` + tek dosya token seti; yerel tercih).
- `prefers-reduced-motion` ile slayt/animasyon otomatik yumuşatma.
- Yardım diyaloguna arama filtresi ve kısayol çakışma denetimi.
- Odak halkası ve kontrast iyileştirmeleri (WCAG AA hedefi, yalnızca CSS).

### 2.15 Tor/Firefox-native Derleme — `tools/build_tor.js`, `tools/tor_native/`
**Şu an:** `chrome.*` hiç barındırmayan tam promise-tabanlı `browser.*` derlemesi;
çapa (anchor) tabanlı dönüşümler — kaynak kayarsa derleme **patlar**, sessiz
bayat kod olmaz; yetki akışı (`permissions.request` kullanıcı jestinde); orf
dosya denetimi; `npm run check:tor` CI kapısı.

**Geliştirme:**
- Derleme çıktısına içerik denetimleri: WAR listesi, `manifest.json` şema
  doğrulaması (JSON + alan beyaz listesi) — `--check`e eklenir.
- `web_accessible_resources` daraltıldı (yalnız `content/*`); ileride
  `content_scripts` matches desenlerinin otomatik üretilmesi.
- Snapshot testleri: tor/ ağacının dosya-temeli hash'lerini `npm run check`
  üretsin (elle kontrol yerine).

### 2.16 Test Altyapısı — `test/`
**Şu an:** 215 test (unit/integration/UI/E2E), jsdom tabanlı; üretilen
dosyaların senkronu (panel/tor) CI ile doğrulanıyor. Bu turda eklenen
regresyon testleri: gerçek HTML script sırası + tarayıcı-bağlamı duman testi,
i18n çift-anahtar denetimi, `renameSelector`, alan-mirası sırası bağımsızlığı,
`linkFromScript`, galeri ZIP'te başarısız indirme atlama; yardım diyaloğu
için dashboard.css'i gerçek `<style>` olarak enjekte edip GÖRÜNÜRLÜĞÜ
(kaskad) doğrulayan testler — `hidden` özelliğinin CSS'i yenemediği sınıfı
bug'ları artık kaçmıyor.

**Geliştirme:**
- `node --test --experimental-coverage` ile kapsam eşiği (ör. engine ≥ %90)
  ve `npm run cover` script'i.
- Örüntü-fuzzer: `UrlRangeExpander` ve `globToRegExp` için özellik tabanlı
  (property) testler; `postProcess` tip korunum denetimleri.
- jsdom yerine hızlı alternatif: motor modüllerini DOM-free sahte
  `querySelectorAll` ile besleyen "hızlı" test seti (saniyeler içinde koşar).

---

## 3. Bu Turda Giderilen Sorunlar (kod incelemesi çıktıları)

| # | Sorun | Etki | Çözüm |
|---|---|---|---|
| 1 | `dashboard.html`'de `transforms.js`, `SelectorEngine.js`'ten sonra yükleniyordu | Tarayıcıda her kazıma `TypeError`; transform/defaultValue tamamen bozuk | Script sırası düzeltildi + sırayı kilitleyen testler eklendi |
| 2 | `lib/i18n.js` içinde `downloadImages` anahtarı iki kez tanımlı (en+tr) | Görsel seçici etiketi, galeri butonunun metnini gösteriyor | İkinci kullanım `downloadImagesAll` anahtarına taşındı; çift-anahtar denetim testi |
| 3 | Seçici ID yeniden adlandırma, çocukları `_root`'a düşürüyordu | Hiyerarşi sessizce bozuluyordu | `Sitemap.renameSelector()` çocuk referanslarını taşıyor |
| 4 | Aynı ID'yle yeni seçici eklemek mevcut seçici sessizce eziyordu | Veri kaybı | ID çakışması hata mesajıyla reddediliyor (EN/TR) |
| 5 | Link/table çocuk kayıtları, kardeş alanlardan **önce** miras alıyordu | Seçici tanım sırasına bağlı sessiz veri kaybı | İki geçişli akış: önce tüm veri alanları, sonra link/table/nested |
| 6 | `renderDataStatsBar` içinde `Math.min(...nums)` | ~64k+ kayıtta `RangeError: too many arguments` | Döngüsel min/max/sum |
| 7 | `downloadGalleryZip` HTTP durumunu umursamıyordu | 404 hata sayfaları "görsel" diye ZIP'e doluyordu | `resp.ok` denetimi, 4'lü paralel indirme, eksik bildirimi |
| 8 | `finish` işleyicisi `state.currentSitemap`'ı geç okuyordu | Sitemap değişir/silinirse yanlış yere yazma veya çökme | Kazıma başlarken `scrapeSitemapId` donduruldu |
| 9 | `logScrape` geçmişi sınırsızdı | Uzun kazımalarda bellek şişmesi | İndirilebilir geçmiş 20.000 satırla sınırlı |
| 10 | Browse-data filtreleri sitemap'ler arasında asılı kalıyordu | "Kayıt yok" yanıltıcı boş tablo | Sitemap değişince filtre/sıralama/arama sıfırlanır |
| 11 | `linkFromScript` link türü hiç uygulanmamıştı (yarım özellik) | Seçenek sessizce href'e düşüyordu | `window.open`/`data-url` çözümlemesi + test |
| 12 | Image seçicideki "yerelde indir" ayarı hiçbir yere bağlı değildi (yarım özellik) | Ayar etkisizdi | Kazıma sonunda galeri + indirme kuyruğunu otomatik başlatıyor |
| 13 | `scraper_content.js`: boş `clickElementSelector` ile `querySelectorAll('')` | Her sayfada yakalanmayan `SyntaxError` riski | Boş seçici "tıklama yok" olarak güvenli erken dönüş |
| 14 | Picker: `isMultiple`/`selectorType` yarım bağlanmış, `Preview` düğmesi ölü | Buton işlevsiz görünüyordu | Multiple bayrağı seçim bittiğinde korunuyor; Preview gerçek toggle; tür etiketi başlıkta |
| 15 | Gölge DOM birleştirme `out.includes(el)` ile O(n²) | Büyük shadow ağaçlarında yavaş kazıma | Set tabanlı birleştirme |
| 16 | `getElementVisibleText` her alanda tüm alt ağacı klonluyordu | Alan × kayıt başına pahalı klon | Script/br içermeyen elemanlarda klonlama atlanır (aynı çıktı) |
| 17 | Manifest `web_accessible_resources` tüm `dashboard/*` ve `devtools/*`'ı web'e açıyordu | Rastgele web sayfası extension arayüzünü iframe'leyebilir | Yalnızca `content/*` bırakıldı (güvenlik sertleştirme) |
| 18 | `popup.js` üç butonda kopyalanmış chrome/standalone dalları + korumasız `await` | Bağımsız modda çökme, bozuk depoda yakalanmayan red | Tek `openDashboard()` yardımcısı; storage hatası boş duruma düşer |
| 19 | `UrlRangeExpander`'da ölü `parts` dizisi, `SelectorGraph`'ta ölü `visited` seti, `dashboard.js`'te ölü `hasChildren`, `csv.js`'de işlevsiz `quotes` seçeneği, `scraper_content.js`'te kullanılmayan `cleanText`/`resolveUrl` | Kafa karışıklığı / yanlış API izlenimi | Temizlendi veya gerçek davranışa bağlandı |
| 20 | `normalizeImported`, `clickElementUniquenessType` alanını düşürüyordu | İçe aktarılan Element Click ayarı kayboluyordu | Korunan alan listesine eklendi |
| 21 | `package.json` `main` alanı service worker'ı gösteriyordu | `require('web-scraper')` çökerdi; anlamsız | `private: true` ile kaldırıldı |

## 3b. İkinci Tur — Klavye Kısayolları Yardım Penceresi

**Kullanıcı raporu:** "Klavye kısayolları penceresi boşluğa tıklayınca veya
üst kısmındaki kapat butonuna tıklayınca kapanmıyor."

**Kök neden (satır 22):** JS tarafı doğruydu — hem `btn-help-close` hem de
boşluğa (backdrop) tıklama dinleyicisi `hidden = true` set ediyordu; ancak
`.help-overlay { display: flex }` yazar stil kuralı, `hidden`
özniteliğinin tarayıcı varsayılanı `display: none`'ını kaskadda yeniyordu.
Tıklama sonrası özellik değişiyor ama diyalog ekranda kalıyordu. Aynı
tuzak slideshow overlay'inde önceden fark edilip `.slideshow-overlay[hidden]
{ display: none !important }` ile fix'lenmişti; yardım overlay'i gözden
kaçmıştı. Mevcut testler yalnız `hidden` özelliğine bakıyordu (jsdom
`<link>` CSS'ini uygulamadığından görünüm hatası testten kaçtı).

| # | Sorun | Etki | Çözüm |
|---|---|---|---|
| 22 | `[hidden]`, `.help-overlay`'ın `display:flex`'ini yenemiyordu | Yardım penceresi kapat/boşluğa tık ile KAPANMIYORDU | `[hidden] { display: none !important }` genel kuralı (reset bölgesinde) + `.help-overlay[hidden]` compound kuralı — slideshow kalıbıyla tutarlı |
| 23 | Kapatma, metin butonuydu (`btn-secondary` "Close") | Köşede ikon beklenir; görsel ağırlık | `AppIcons.get('x')` ile `×` ikonlu `.btn-icon`; erişilebilirlik `aria-label` + `data-i18n-title` (çeviri buton içeriğini ezmesin); Escape ve `?` kısayolları korundu; kapanışta odak tetikleyen öğeye dönüyor |

**Regresyon:** `test/help_dialog.test.js` (4 test) dashboard.css'i jsdom'a
gerçek `<style>` olarak enjekte edip overlay'in `hidden` iken GÖRÜNMEZ,
açıkken `flex` olduğunu; tor kopyası senkronunu; ikon butonun erişilebilir
etiketini ve kapalıyken tıklama güvenliğini kilitliyor. Düzeltme öncesi
3 testin kırmızı olduğu doğrulandı (kırmızı→yeşil akış).

---

## 4. Yol Haritası (öncelik sırası)

**P1 — Motor ve veri bütünlüğü**
1. `discardInitialElements` gerçeğe dönüştürme (snapshot-diff).
2. Kazıma kuyruğu durumunun dışa/içe aktarımı (kaldığı yerden devam).
3. concurrency > 1 worker havuzu + per-request timeout.
4. IndexedDB parçalı kayıt yazımı + kota aşımı davranışı.

**P2 — Kullanıcı arayüzü**
5. Galeri/görüntüleyici sanallaştırma (10k+ satır/görsel).
6. Seçici düzenleme ekranında "örnek veriyle dönüşüm önizleme".
7. Grafikte sürükle-bırak yeniden ebeveynleme + PNG dışa aktarma.
8. Kolon tipi kalıcılığı (sitemap'e bağlı CSV sayı/tarih biçimleri).

**P3 — Dışa aktarma ve şeffaflık**
9. Markdown + XML dışa aktarımı, ZIP içine `meta.json`.
10. `robots.txt` yerel okuyucu (opsiyonel anahtar) ve tarama başlığı seçicileri.
11. Sitemap sürüm-diff aracı (`compare(sitemapA, sitemapB)` saf fonksiyon).

**P4 — Kalite kapıları**
12. Kapsam eşiği + property tabanlı testler + tor hash denetimi.
13. Manifest şema doğrulayıcı (build içinde).
14. `npm run check`'in CI workflow'u ile GitHub Actions'a bağlanması.

> **Kapsam dışı (bilinçli):** LLM/AI entegrasyonu, bulut senkronizasyonu,
> harici çözümleme/vektör API'leri, uzak proxy havuzları, teleme metriği —
> proje baştan sona çevrimdışı ve yerel kalacaktır.
