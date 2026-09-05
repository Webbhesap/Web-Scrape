# Web Scraper — Özellik Envanteri ve Geliştirme Planı

> Bu belge, eklentideki **mevcut tüm özellikleri** ve her birinin **yerel (offline)
> geliştirme planını** içerir. Planlanan hiçbir madde yapay zekâ, bulut servisi,
> uzaktan analiz veya harici bir API'ye bağımlı **değildir**. Tüm iyileştirmeler
> saf HTML + CSS + Vanilla JavaScript (Manifest V3) ile, tarayıcı API'leri ve
> depodaki mevcut modüller üzerinden uygulanabilir şekilde tasarlanmıştır.
>
> **Durum sözleşmesi:** Her bölümde **Şu an** başlığı altında yalnızca kodda
> gerçekten var olan ve testle doğrulanmış davranışlar listelenir. **Kalan
> geliştirme** başlığı altındaki maddeler ise henüz uygulanmamıştır. Tamamlanan
> bir madde, uygulandığı turda "Kalan" listesinden çıkarılıp "Şu an" listesine
> taşınır ve ilgili tur tablosunda (§3, §3b, §3c) numaralandırılır.

---

## 1. Proje Özeti

| Katman | Konum | Açıklama |
|---|---|---|
| Chrome/Edge/Brave kaynağı | `chrome-edge/` | Tek gerçek kaynak ağacı (elle düzenlenen tek yer) |
| Firefox/Tor derlemesi | `tor/` | `npm run build:tor` ile otomatik üretilir (elle düzenlenmez, hash'le kilitli) |
| DevTools paneli | `chrome-edge/devtools/panel.html` | `npm run build:panel` ile dashboard'dan üretilir |
| Testler | `test/` | Node.js test runner + jsdom — **318 test** (`npm test`) |
| Kapsam | `npm run test:coverage` | Eşik %85 satır / %65 dal / %80 fonksiyon — ölçülen **%88,81 / %72,11 / %85,81** |
| Derleme araçları | `tools/` | panel/tor üretimi, `validate_manifest.js` ve `--check` CI denetimleri |
| CI | `.github/workflows/check.yml` | Node 22 · `npm ci` · `check` · `test` · `test:coverage` |

Mimari: AMD/CommonJS/browser global üçlüsüyle paketlenmiş UMD modüller;
build adımı, bundler ve bağımlılık yok (testlerde yalnızca jsdom).

**Kaynak-ağaç kuralı:** `chrome-edge/lib`, `chrome-edge/src` veya
`chrome-edge/content` içinde yapılan *her* değişiklik (yorum satırı bile)
`npm run build:tor` gerektirir; aksi hâlde `npm run check` "tor/ build is out
of date" ile kırmızıya döner. `tor/manifest.json` içindeki
`background.scripts` listesi bir testle kilitlidir (`test/tor_build.test.js`).

---

## 2. Mevcut Özellikler ve Geliştirme Planı

### 2.1 Görsel Seçici (Point-and-Click Picker) — `content/selector_picker.js`
**Şu an:** Hover vurgulama, çoklu seçim + otomatik genelleme, Parent `[P]` /
Child `[C]` dolaşımı, canlı eşleşme sayısı, eleman önizleme, sayfa içi veri
önizleme tablosu, gölge DOM (shadow root) içine görünen sorgular, parent kapsama
alanı (`scopeSelector`) kısıtlaması, rAF ile kare başına tek highlight
güncellemesi. `isMultiple`/`selectorType` bayrakları seçim bittikten sonra da
korunuyor; `Preview` düğmesi gerçek bir toggle; seçici türü başlıkta etiketli.

**Kalan geliştirme (tamamen yerel):**
- Önizleme tablosunda kolon türü sezimi: seçici türüne göre (Link/Image/Attr)
  otomatik sütun gösterimi ve hücre içerik kırpma uzunluğunun ayarlanabilmesi.
  *(Not: kalıcı kolon tipleri sitemap düzeyinde var — bkz. §2.6; picker
  önizlemesi bunları henüz kullanmıyor.)*
- Seçim geçmişine "geri al" (son tıklamayı iptal) ve `Ctrl+A` ile kapsam içi
  tüm eşleşmeleri seç kısayolları.
- Kapsam (scope) içine girince URL hash'i yerine `history.replaceState` ile
  durum koruması; panel yeniden yüklense bile seçime devam.
- Dokunmatik/klavye erişilebilirliği: `Tab` ile eleman gezdirme, `Enter` ile seç.

### 2.2 Seçici Türleri (13 tip) — `src/models/Selector.js`, `src/engine/SelectorEngine.js`
**Şu an:** Text, Link, Link(Popup), Image, Table, Element(container), Element
Attribute, HTML, Grouped, Pagination, Element Click, Element Scroll, XPath.
Türlerde regex ayıklama, `multiple`, gecikme, `transforms` (trim/case/capitalize/
number/regexReplace) ve `defaultValue` desteği. `linkFromScript` gerçekten
`window.open(...)`/`data-url` çözümlüyor; Image seçicideki "yerelde indir"
kazıma bitince galeri indirme kuyruğunu otomatik başlatıyor.

**Element Click · `discardInitialElements`** iki aşamalı snapshot ile çalışıyor:
tıklama öncesi eleman kümesi donduruluyor, yalnızca yeni yüklenenler kayda
geçiyor (yerel DOM diff'i). **`maxClicks`** artık uçtan uca bağlı: model
1–200 aralığına kıskaçlıyor (varsayılan 50), `Sitemap.normalizeImported`
içe aktarmada koruyor, dashboard'da sayı girişi + EN/TR ipucu metni var,
aksiyon yükü içeriğe taşınıyor ve içerik scripti döngüyü gerçekten sınırlıyor.

**Kalan geliştirme:**
- **Table**: colspan/rowspan farkındalığı ve "başlık satırını otomatik algıla"
  güçlendirmesi (th sayımı + ilk satır doluluk skoru). *(Bugün `colspan`
  yalnızca arayüz tablolarının HTML'inde geçiyor; ayrıştırıcı hücre
  yayılımını bilmiyor.)*
- **Grouped**: ayraç yerine JSON dizi çıktısı seçeneği (kolon tipinin
  Excel/CSV'de bozulmaması için).
- **XPath**: hata mesajlarının UI'da gösterimi — geçersiz predicate bugün
  yalnızca `console.warn('XPath error:', e)` üretiyor, kullanıcı hiçbir şey
  görmüyor; predicate tabanlı çoklu eşleme testleri de eksik.
- Yeni yerel tür önerisi: **SelectorDiff / Değişim Takibi** — aynı sitemap'in
  iki kazıması arasındaki farkı depodaki kayıtlarla yerel olarak hesaplayıp
  "yeni/kaybolan/değişen" etiketiyle listeleyen **kolon üreticisi**.
  *(Sitemap-tanımı düzeyindeki diff var — bkz. §2.9; bu madde kayıt
  düzeyindedir ve farklı bir iştir.)*

### 2.3 URL Aralığı Genişletme — `src/engine/UrlRangeExpander.js`
**Şu an:** Sayısal, sıfır dolgulu, adımlı `[0-100:10]`, alfabetik `[a-z]`,
virgülle liste, kartezien çarpım; 100.000 URL güvenlik tavanı; canlı önizleme
(giriş ekranında debounce'lu sayı + örnek URL'ler + tavan uyarısı). Ölü `parts`
dizisi temizlendi.

**Kalan geliştirme:**
- `[1-100:10]` yanı sıra `[start,step]` biçimi ve negatif adımlı listeler.
- Genişletme sonucunu kopyalama / `.txt` indirme butonları (yalnızca Blob).
- Taslak: `Tarih aralığı [2024-01-01..2024-12-31:7d]` üretici (tamamen yerel
  Date matematiği).

### 2.4 Kazıma Motoru ve Zamanlayıcı — `src/engine/ScraperEngine.js`
**Şu an:** Kuyruk + BFS, `requestInterval`/`pageLoadDelay`/`maxPages`, `maxDepth`,
include/exclude glob desenleri, üstel geri çekilmeli `requestRetries`,
(parent,url) bazlı kuyruk tekilleştirme, pause/resume/stop, canlı metrikler;
kardeş alan mirası **seçim sırasından bağımsız** (iki geçişli akış); gölge DOM
delme sitemap seçeneği olarak kalıcı.

Bu turda motora eklenenler:
- **`concurrency`** artık çalışan bir worker havuzu (tekrarlanan yapılandırma
  anahtarı temizlendi; havuz gerçekten paralel işliyor).
- **Per-request timeout + `AbortController`**: takılı istekler iptal edilip
  logda `timeout` olarak işaretleniyor; iptal sekme/sözleşme sızıntısı
  bırakmıyor.
- **`robots.txt` yerel okuyucusu** (`lib/robots.js`): fetch + mini parser,
  opsiyonel anahtar — yalnızca kullanıcı açarsa uygulanır; `URIError` ve
  iç içe `$` yakalanma yolları sertleştirildi.
- **Kazıma durumu dışa/içe aktarımı** (kuyruk + visited → JSON): "kaldığı
  yerden devam et" (`test/queue_state.test.js`, `test/progress_save_resume.test.js`).
- Motor adımları `try/catch` ile sarılı; hata `abort` olayına bağlanıp
  sessizce yutulmuyor.

**Kalan geliştirme:**
- Sayfa başına bellek tavanı: sonuç akışını IndexedDB tamponuna yazıp büyük
  kazımalarda `results` dizisini budama. *(Depolama tarafı parçalı yazıyor —
  bkz. §2.11 — ama motor `this.results` dizisini kazıma boyunca bellekte
  tutuyor; 100k+ kayıtta bu hâlâ bir tavan.)*
- Tarama başlığı seçicileri (robots.txt `Sitemap:`/`Crawl-delay:` satırlarının
  okunup arayüzde önerilmesi).

### 2.5 Sekme-Tabanlı JS Enjeksiyonlu Çalıştırıcı — `dashboard.js` + `content/scraper_content.js`
**Şu an:** Arka plan sekmesi açıp `document.documentElement.outerHTML` kazıma;
click/scroll aksiyonlarını içerik scripti ile uygulama; sekme kapanma/hata
yollarında temizlik; Tor tarafında promise-tabanlı `browser.*` sürümü.
`createTabOrFetchRunner` "kazıma başladı" ile "sözleşme sonuçlandı" durumlarını
ayrı tutuyor — bu sayede zaman aşımında sekme yetim kalmıyor.

İçerik scripti sertleştirmesi: boş `clickElementSelector` artık
`querySelectorAll('')` çağırmıyor (yakalanmayan `SyntaxError` riski giderildi);
`clickMore`/`clickOnce` yolları benzersizlik (`clickElementUniquenessType`) ve
`maxClicks` sınırlarına gerçekten uyuyor.

**Kalan geliştirme:**
- Sekme başına "hazır olma" kriteri olarak `readyState` + ağ kararsızlığı
  (networkidle benzeri, yerel sayaç) algısı: dinamik sayfaların yarım
  yakalanmasını azaltır.
- Aksiyon seçimlerini sayfa bazında önbellekleme (aynı şablondaki sayfalarda
  click desenini yeniden keşfetmeme).
- Enjeksiyon modunda `prefers-reduced-motion` zorlamasıyla gereksiz
  animasyon/scroll beklemelerini kısaltma.

### 2.6 Veri Görüntüleyici — `dashboard.js` (browse-data)
**Şu an:** Sıralama (çok kolonlu, shift+tık), global arama + kolon bazlı filtre,
kolon gizleme (oturuma özel localStorage), sayfalama + sayfa boyutu, istatistik
çubuğu (n/Σ/x̄/min/max), hücre düzenleme (anında depoya yazar), satır silme,
bul/değiştir (regex, büyük/küçük harf, tam kelime, kolon seçimi), sitemap
değişince filtre sıfırlama.

Bu turda düzeltilen/güçlendirilen:
- **Kolon tipleri kalıcı**: tarih/sayı/metin algılaması sitemap başına
  `columnTypes` olarak saklanıyor ve CSV dışa aktarımına taşınıyor.
- **Tablo başlıkları anahtar birleşimi**: `derivedData()` tüm kayıtların
  anahtarlarını birleştiriyor; ilk kayıtta eksik alan varsa sütun kaybolmuyor.
- **Performans**: arama debounce'lu, istatistik tek geçişte, kaydırma/çizim
  rAF ile kısılmış; `Math.min(...nums)` kaynaklı ~64k+ kayıt `RangeError`'ı
  döngüsel min/max/sum ile giderildi.
- **Kolon filtresi imleci** yazarken yerinde kalıyor (her tuş vuruşunda
  odak/ caret kaybolmuyor).

**Kalan geliştirme:**
- Tabloya "Yalnızca seçili satırları dışa aktar" (satır onay kutuları) ve
  çift tıklamayla satır detay modalı.
- Sütun genişliklerini sürükleme ile ayarlama ve localStorage'a yazma.
- Dışa aktarımda "filtrelenmiş görünüme göre" modu (mevcut kopyalama
  davranışının CSV/Excel butonlarına genelleştirilmesi).
- **Tablo sanallaştırma**: 10k+ satırda yalnızca görünen satırların DOM'a
  basılması. *(Galeri sanallaştırılmış — bkz. §2.8; veri tablosu bugün
  yalnızca sayfalı, sanal değil.)*
- Hücre düzenlemede tüm veri kümesini yazmak yerine yalnızca değişen kaydı
  yazma (opsiyonel mikro-iyileştirme).

### 2.7 Dışa Aktarma — `src/export/Exporter.js`, `lib/csv.js`, `lib/xlsx.js`, `lib/zip.js`
**Şu an:** CSV (RFC 4180, BOM, ayraç **ve tırnak karakteri** seçenekleri),
SpreadsheetML `.xls`, gerçek OOXML `.xlsx` (STORE-zip ile), JSON, TSV, NDJSON,
**Markdown tablosu**, **XML (Dataset)**, HTML tablosu olarak panoya kopyalama
(zengin içerik), sitemap JSON dışa/içe aktarma, toplu yedek, ZIP galeri indirme
(başarısız HTTP yanıtlarını atlar; 4'lü paralel indirme).

Bu turda eklenen/düzeltilen:
- **`meta.json`** artık dışa aktarma ZIP'inin içinde (kazıma bilgileri, kayıt
  sayısı, zaman damgası — tamamen yerel üretim).
- **ZIP taşma korumaları**: 65k+ satır / 4GB+ ZIP64 sınırları denetleniyor ve
  kullanıcıya bölme uyarısı veriliyor.
- **CSV round-trip simetrisi**: `parse()` `options.quoteChar`'ı yok sayıyordu
  (yalnızca `unparse()` kullanıyordu); özel tırnakla yazılan CSV geri
  okunamıyordu. Tarayıcı `startsWith` ile çok karakterli tırnak işaretlerini de
  destekliyor. Varsayılan `"` davranışı 4100 örnekli fark testiyle birebir
  korunarak doğrulandı.
- `toXML` içinde `recordFields` döngü dışına alındı (kayıt başına yeniden
  hesaplanmıyor).

**Kalan geliştirme:**
- CSV'de tarih/sayı biçimi seçenekleri (TR ondalık `1,23` üretme seçeneği —
  yerel `Intl` ile).
- Dışa aktarma şablonlarını (kolon sırası + yeniden adlandırma) sitemap'e
  gömme; içe aktarmada ters eşleme.
- Sayısal hücre algılamasını (`lib/xlsx.js` `isNumericCell`) `transforms.parseNumber`
  üzerinden tek kaynağa indirme — CSV/XLSX/istatistik çubuğu aynı sayı
  tanımını kullansın (bugün üç ayrı sezgi var; tutarsızlık riski).

### 2.8 Görsel Galeri ve Slayt Gösterisi — `dashboard.js`
**Şu an:** Kolon ayarlı ızgara, URL satır içi düzenleme, tekil silme, toplu/seçili
ZIP, tam ekran slayt (fade/slide/zoom/cut), otomatik oynatma aralığı, fare
tekerleği + ok tuşları + Space/Esc, 2 sn sonra kontrollerle birlikte imlecin de
saklanması, slayttan tek görsel indirme (orijinal ad+uzantı), indirme yöneticisi
(ilerleme çubuğu, hata listesi, yeniden dene, iptal; çakışma-güvenli adlar).

Bu turda eklenen/düzeltilen:
- **Galeri sanallaştırma**: `GALLERY_VIRTUAL_THRESHOLD = 120` üzerinde yalnızca
  görünür pencere DOM'a basılıyor (`renderGalleryWindow`, rAF/setTimeout ile
  kısılmış kaydırma); altında düz ızgara + sayfa kaydırması korunuyor.
- **İndirme yöneticisi**: `Set` tabanlı tekilleştirme, düzgün imleç ilerlemesi
  ve doğru sayaçlar (başarılı/başarısız/toplam artık birbirini bozmuyor).
  Kuyruk `concurrency: 3` ile çalışıyor; galeri ZIP'i ise ayrı yoldan
  `BATCH = 4` paralel indiriyor ve `resp.ok` denetimiyle başarısız yanıtları
  arşive sokmuyor (404 hata sayfası "bozuk görsel" olarak ZIP'e dolmuyor).

**Kalan geliştirme:**
- Galeri "görsel boyutu/kaynak filtre" ön ayarları (yalnızca 300px+ gibi;
  yerel `Image()` ölçümü).
- "Yalnızca yüklenemeyenleri göster" hata filtresi.
- ZIP'e seçili görsellerin JSON yan-dosya listesi (`index.json`) eklenmesi.
- Slaytta EXIF başlığı yerine yerel `Image.decode()` + `naturalWidth` ile
  çözünürlük rozeti (harici kütüphane yok).

### 2.9 Sitemap Yönetimi, Hiyerarşi ve Şablonlar — `src/models/Sitemap.js`, `lib/sitemap_templates.js`
**Şu an:** Oluşturma/kopyalama/silme/arama; sürükle-bırak ile nesteleme ve
kardeş sıralama (döngü korumalı); seçici ID yeniden adlandırma hiyerarşiyi
**koruyor** ve çakışan ID'yi reddediyor; geri-al/yinele (Ctrl+Z / Ctrl+Y);
webscraper.io sitemap JSON'u içe aktarma (normalizasyon + kısmi hata raporu);
yerleşik 5 şablon + kullanıcı şablonları (kaydet/kullan); URL önizleme.

Bu turda eklenen/düzeltilen:
- **Sitemap karşılaştırma ("farkları göster")**: iki sürüm arasındaki seçici
  değişikliklerinin yerel diff'i; seçici ekleme/silme/değişme, **kolon tipleri**
  ve `maxClicks` gibi ayarlar ayrı bölümler hâlinde listeleniyor
  (`test/sitemap_diff.test.js`).
- `normalizeImported` artık `columnTypes` ve `maxClicks` alanlarını düşürmüyor.

**Kalan geliştirme:**
- Şablon Galerisi genişletme: forum/liste-yorum/fiyat takibi iskeletleri
  (yalnızca depodaki statik veri, ağ isteği yok).
- Kopyalama sırasında ID çakışmalarını otomatik son-ek ile çözme
  (`_copy2` davranışının seçicilere de uygulanması).
- Döngüsel bağımlılık denetiminin `reorderSibling`'de de bildirim üretmesi:
  `wouldCreateCycle` bugün sessizce `false` dönüyor, kullanıcı sürüklemenin
  neden uygulanmadığını görmüyor.

### 2.10 Seçici Hiyerarşi Grafiği — `src/ui/SelectorGraph.js`
**Şu an:** HTML kart tabanlı ağaç (CSS bağlantı çizgileri ile); renk kodlu tür
pilleri (`TXT`/`LNK`/`IMG`/`TBL`/`XPATH` …); yakınlaştır (+/−) ve Reset
denetimleri; düğüme tıklayınca seçici düzenleme; döngü düğümleri kesikli turuncu
çerçeveyle işaretli ve **dal başına** `visitedPath` zinciri ile korunuyor (ölü
global `visited` seti temizlendi — kardeş dalları yanlışlıkla döngü saymıyor).

Bu turda eklenen:
- **Sürükle-bırak ile yeniden ebeveynleme**: düğümler `draggable`; başka bir
  düğümün üzerine bırakınca `Sitemap.reparentSelector` çağrılıyor; kök
  hedefi (`_root`) destekli; döngü yaratacak ve kendi üzerine bırakmalar
  reddediliyor.
- **PNG olarak indirme**: ekran grafiği HTML olduğu için dışa aktarma DOM'un
  ekran görüntüsünü almıyor — aynı ağaç, saf yerleşim verisinden bir
  `<canvas>`'a 2× ölçekte yeniden çiziliyor ve `canvas.toBlob('image/png')`
  ile kodlanıp indiriliyor. Harici kütüphane yok, tamamen yerel.

Her ikisi de `test/selector_graph.test.js` ile kilitli (yerleşim geometrisi,
döngü dayanıklılığı, sürükle-bırak kuralları, PNG blob üretimi).

**Kalan geliştirme:**
- Klavye ile gezinme ve ARIA ağaç rolleri (grafik bugün yalnızca fare ile
  erişilebilir).
- Dallanmış tipleri (Link/Element) vurgulayan "akış vurgusu" modu.
- Sürüklerken bırakma hedefinin görsel önizlemesi (şu an yalnızca hedef kartta
  kesikli çerçeve var; "bırakılırsa nereye bağlanır" oku yok).

### 2.11 Depolama — `src/storage/Storage.js`
**Şu an:** Öncelik `chrome.storage.local`; Firefox'ta IndexedDB; standalone'da
localStorage; örnek sitemap'lerin ilk açılışta tohumlanması; veri kayıtlarının
sitemap başına saklanması; yer imi şablonları; bozuk kayıtlara tolerans.

Bu turda eklenen/düzeltilen:
- **Parçalı (chunked) IndexedDB yazımı**: kazınan veriler
  `scraped_data_chunks` içinde kayıt bloklarına bölünüyor (blok başına
  ≤ 2000 kayıt), başlık `scraped_data`'da **en son** yazılıyor — böylece ne
  bayat bir başlık ne de yarım kalmış bir geçiş yetim blok bırakabiliyor.
  `unlimitedStorage` kotası aşımında geri alma (rollback) + kullanıcı uyarısı.
- **Blok sızıntısı giderildi**: `deleteSitemap` ve `clearScrapedData` artık
  ilgili tüm blokları siliyor. *(İlk deneme her zaman erken çıkıyordu —
  `IDBRequest.delete()` `undefined` döndürdüğü için; önceden hesaplanmış
  anahtar birleşimi ile düzeltildi.)*
- `getBytesInUse` kota algılaması için içeride kullanılıyor.

**Kalan geliştirme:**
- Depolama **doluluk göstergesi** (arayüzde) ve "en eski kazımayı temizle"
  bakım aracı. *(Kota bilgisi motor içinde var ama kullanıcıya gösterilmiyor.)*
- Uygulama içi şema sürümü (`schemaVersion`) ile migrate zinciri;
  geri-dönüşlü yedek.
- `browser.storage.session` kullanımı: sekme-geçici durum (aktif kazıma
  imleci) — Chrome/Edge/Firefox'un yerel API'si.

### 2.12 Artımlı Kazıma Modları — `lib/datamode.js`
**Şu an:** replace / append / merge (anahtar kolona göre yerinde güncelleme);
anahtarsız merge → append'e düşer ve uyarır; veri özeti loglanır. Mod seçimi
arayüzden (`scrape-data-mode`) her kazımada okunuyor.

**Kalan geliştirme:**
- Anahtar kolon yerine **birden fazla anahtar** (bileşik anahtar) desteği.
- `merge` moduna "silme algılama" (kaybolan anahtarları `stale=true` işaretle
  — silmek opsiyonel).
- Mod seçimini sitemap'e kalıcı yazma.

### 2.13 Metin Dönüşümleri — `lib/transforms.js`
**Şu an:** trim, lowercase, uppercase, capitalize, TR/ABD yerelleştirmeli sayı
ayrıştırma (`1.234,56 ₺` → 1234.56), regexReplace ($1 gruplu); dizi sonuçların
her elemanına uygulanır; `defaultValue`; editörde sıralama/çıkarma.
**Dönüşüm zinciri önizlemesi** seçici düzenleme ekranında "örnek metinle dene"
kutusu olarak var (yerel, anında çalışır — `test/transform_preview.test.js`).
Sayı ayrıştırma motorla **tek kaynaktan** (`parseNumber`) besleniyor.

> **Düzeltilen kritik hata:** `transforms.js`, `dashboard.html`'de motordan
> sonra yükleniyordu; tarayıcıda motor modülü `undefined` yakalayıp tüm
> kazımalarda `TypeError` üretiyordu — artık motordan önce yükleniyor ve bu
> sıra bir testle kilitlendi. Ayrıca `Selector.js` transforms bağımlılığını
> örtük global yerine açıkça çözüyor.

**Kalan geliştirme:**
- Yeni yerel adımlar: `title-case istisnaları`, `boşluk normalizasyon (NBSP)`,
  `sıra-boz` (split-sort-join), `sayı→para birimi biçimle` (Intl),
  `kısalt (ellipsis)`, `boş değerleri sıfır yap`.
- Kullanıcının kendi JS ifadesini yazabildiği `customJs` adımı (yalnızca
  sandbox'lı, ağ erişimsiz değerlendirme).

### 2.14 Arayüz, Tema ve Erişilebilirlik — `dashboard.css`, `popup`, DevTools paneli
**Şu an:** Tek karanlık palet (CSS değişkenleri), `color-scheme: dark`, tarayıcı
kontrolü temalı tema; popup, panel ve picker'da aynı tema; klavye kısayolları
(Ctrl+Alt+N/S/D/G, ?, F1 yardım diyalogu); dil EN/TR (tam sözlük — 399/399
anahtar paritesi, çift anahtar hatası giderildi: `downloadImages` /
`downloadImagesAll` ayrıldı); ikon butonlarında `:focus-visible` odak halkası.

Yardım diyaloğu: boşluğa tıklayınca ve `×` ikon butonuyla gerçekten kapanıyor
(`[hidden] { display: none !important }`), kapanışta odak tetikleyen öğeye
dönüyor, buton `aria-label` + `data-i18n-title` taşıyor.

**Kalan geliştirme:**
- Açık tema seçeneği (`[data-theme="light"]` + tek dosya token seti; yerel tercih).
- `prefers-reduced-motion` ile slayt/animasyon otomatik yumuşatma.
- Yardım diyaloguna arama filtresi ve kısayol çakışma denetimi.
- Odak halkası ve kontrast iyileştirmelerinin tüm etkileşimli öğelere
  yayılması (WCAG AA hedefi, yalnızca CSS) — bugün iki kural kapsanıyor.

### 2.15 Tor/Firefox-native Derleme — `tools/build_tor.js`, `tools/tor_native/`
**Şu an:** `chrome.*` hiç barındırmayan tam promise-tabanlı `browser.*` derlemesi;
çapa (anchor) tabanlı dönüşümler — kaynak kayarsa derleme **patlar**, sessiz
bayat kod olmaz; yetki akışı (`permissions.request` kullanıcı jestinde); öksüz
dosya denetimi; `npm run check:tor` CI kapısı; `web_accessible_resources`
daraltıldı (yalnız `content/*`).

Bu turda eklenen kalite kapıları:
- **`manifest.json` şema doğrulaması** (`tools/validate_manifest.js`): hem
  `chrome-edge` hem `tor` manifesti `npm run check` içinde JSON + alan beyaz
  listesi denetiminden geçiyor.
- **Dosya-temelli hash snapshot testleri** (`test/tor_hashes.test.js`): `tor/`
  ağacının elle değiştirilmediğini `npm run check` üretiyor.
- `assertNoChromeApi` yorumlarda geçen `chrome.<tanımlayıcı>` metnini de
  yakalıyor — bu yüzden tor'a kopyalanan yorumlarda `chrome.*` yazılmamalı.

**Kalan geliştirme:**
- `content_scripts` matches desenlerinin otomatik üretilmesi (elle liste yerine).
- Derleme çıktısına WAR (web_accessible_resources) içerik denetimi — şu an
  şema doğrulayıcı alanın *varlığını* denetliyor, içeriğinin kaynak ağaçla
  tutarlılığını değil.

### 2.16 Test Altyapısı — `test/`
**Şu an:** **318 test** (unit/integration/UI/E2E), jsdom tabanlı; üretilen
dosyaların senkronu (panel/tor) CI ile doğrulanıyor.

- **Kapsam eşiği**: `npm run test:coverage` → %85 satır / %65 dal / %80
  fonksiyon; ölçülen %88,81 / %72,11 / %85,81 (CI'da `--test-concurrency=1`
  ile deterministik).
- **Property tabanlı testler** (`test/properties.test.js`): `UrlRangeExpander`
  ve `globToRegExp` için özellik denetimleri, `postProcess` tip korunumu.
- **Üçüncü tur regresyon paketi** (`test/review_round3.test.js`, 25 test):
  içerik scripti gerçek jsdom bağlamında (`runScripts: dangerously`)
  önyüklenip `EXECUTE_PAGE_ACTIONS` mesaj yakalamasıyla çalıştırılıyor;
  `clickMore`/`maxClicks`/`uniqueness` davranışları kırmızı→yeşil doğrulandı.
- Yardım diyaloğu için `dashboard.css` gerçek `<style>` olarak enjekte edilip
  **GÖRÜNÜRLÜK** (kaskad) doğrulanıyor — `hidden` özelliğinin CSS'i
  yenemediği sınıf bug'ları artık kaçmıyor.

**Kalan geliştirme:**
- jsdom yerine hızlı alternatif: motor modüllerini DOM-free sahte
  `querySelectorAll` ile besleyen "hızlı" test seti (`npm run test:fast`,
  saniyeler içinde koşar). Tam paket bugün ~80 sn sürüyor.

---

## 3. Birinci Tur — Giderilen Sorunlar (kod incelemesi çıktıları)

| # | Sorun | Etki | Çözüm |
|---|---|---|---|
| 1 | `dashboard.html`'de `transforms.js`, `SelectorEngine.js`'ten sonra yükleniyordu | Tarayıcıda her kazıma `TypeError`; transform/defaultValue tamamen bozuk | Script sırası düzeltildi + sırayı kilitleyen testler eklendi |
| 2 | `lib/i18n.js` içinde `downloadImages` anahtarı iki kez tanımlı (en+tr) | Görsel seçici etiketi, galeri butonunun metnini gösteriyor | İkinci kullanım `downloadImagesAll` anahtarına taşındı; çift-anahtar denetim testi |
| 3 | Seçici ID yeniden adlandırma, çocukları `_root`'a düşürüyordu | Hiyerarşi sessizce bozuluyordu | `Sitemap.renameSelector()` çocuk referanslarını taşıyor |
| 4 | Aynı ID'yle yeni seçici eklemek mevcut seçiciyi sessizce eziyordu | Veri kaybı | ID çakışması hata mesajıyla reddediliyor (EN/TR) |
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
`.help-overlay { display: flex }` yazar stil kuralı, `hidden` özniteliğinin
tarayıcı varsayılanı `display: none`'ını kaskadda yeniyordu. Tıklama sonrası
özellik değişiyor ama diyalog ekranda kalıyordu. Aynı tuzak slideshow
overlay'inde önceden fark edilip `.slideshow-overlay[hidden] { display: none
!important }` ile fix'lenmişti; yardım overlay'i gözden kaçmıştı. Mevcut testler
yalnız `hidden` özelliğine bakıyordu (jsdom `<link>` CSS'ini uygulamadığından
görünüm hatası testten kaçtı).

| # | Sorun | Etki | Çözüm |
|---|---|---|---|
| 22 | `[hidden]`, `.help-overlay`'ın `display:flex`'ini yenemiyordu | Yardım penceresi kapat/boşluğa tık ile KAPANMIYORDU | `[hidden] { display: none !important }` genel kuralı (reset bölgesinde) + `.help-overlay[hidden]` compound kuralı — slideshow kalıbıyla tutarlı |
| 23 | Kapatma, metin butonuydu (`btn-secondary` "Close") | Köşede ikon beklenir; görsel ağırlık | `AppIcons.get('x')` ile `×` ikonlu `.btn-icon`; erişilebilirlik `aria-label` + `data-i18n-title` (çeviri buton içeriğini ezmesin); Escape ve `?` kısayolları korundu; kapanışta odak tetikleyen öğeye dönüyor |

**Regresyon:** `test/help_dialog.test.js` (4 test) dashboard.css'i jsdom'a
gerçek `<style>` olarak enjekte edip overlay'in `hidden` iken GÖRÜNMEZ, açıkken
`flex` olduğunu; tor kopyası senkronunu; ikon butonun erişilebilir etiketini ve
kapalıyken tıklama güvenliğini kilitliyor. Düzeltme öncesi 3 testin kırmızı
olduğu doğrulandı (kırmızı→yeşil akış).

## 3c. Üçüncü Tur — Derin Depo İncelemesi (tüm dosyalar)

**Kapsam:** Depodaki tüm kaynak dosyaların satır satır incelemesi: hatalı kod,
yarım kalmış özellikler, performans sorunları ve kod tekrarı. Bulunan her sorun
düzeltildi, testle kilitlendi; `Plan.md`'nin gerçek kod durumuyla örtüşmeyen
maddeleri bu turda ayıklandı (§2'deki "Şu an" / "Kalan" ayrımı).

| # | Sorun | Etki | Çözüm |
|---|---|---|---|
| 24 | `ScraperEngine` yapılandırmasında `concurrency` anahtarı iki kez atanıyordu | İkinci atama birinciyi eziyordu; seçenek belirsiz | Tek anahtara indirildi; worker havuzu gerçekten paralel |
| 25 | `Selector.js`, `transforms` modülünü örtük global'den okuyordu | Modül tek başına yüklendiğinde `undefined` → sessiz bozulma | Açık bağımlılık çözümlemesi |
| 26 | Diff görünümünde `baseLabel` yanlış başlık üretiyordu | Karşılaştırma ekranında yanıltıcı etiket | Doğru temel etiketi |
| 27 | `Storage.deleteSitemap` / `clearScrapedData` veri bloklarını sızdırıyordu | Silinen sitemap'in kayıtları IndexedDB'de kalıyordu (kota şişmesi) | Önceden hesaplanmış anahtar birleşimi ile tüm bloklar siliniyor |
| 28 | Veri görüntüleyicide debounce/tek-geçiş/rAF eksikti | Her tuş vuruşunda tam yeniden çizim; büyük veride arayüz donması | Arama debounce'lu, istatistik tek geçiş, çizim rAF kısılmış |
| 29 | Tablo başlıkları yalnızca ilk kaydın anahtarlarından üretiliyordu | İlk kayıtta eksik alan varsa o sütun **hiç görünmüyordu** (sessiz veri gizleme) | `derivedData()` ile anahtar birleşimi |
| 30 | Kolon filtresi her tuş vuruşunda odağı/imleci yeniden çiziyordu | Filtre kutusunda yazı yazılamıyordu (imleç sona atlıyordu) | Caret korunuyor |
| 31 | `lib/zip.js` boyut/ofsayt taşmalarını denetlemiyordu | 4GB+ / 65k+ girişte bozuk ZIP, sessiz veri kaybı | Taşma korumaları + kullanıcıya bölme uyarısı |
| 32 | 9 gereksiz kaçış (`no-useless-escape`) ve tekrarlanan/kaçışlı karakter sınıfları | Okunabilirlik; bazı motorlarda uyarı | Temizlendi — 14 örnekli eşdeğerlik denetimiyle **0 davranış farkı** doğrulandı |
| 33 | `lib/robots.js`: `decodeURIComponent` `URIError` fırlatabiliyordu; iç içe `$` yanlış eşleşiyordu | Bozuk/kötü niyetli robots.txt tüm kazımayı düşürüyordu | Güvenli çözümleme + `try/catch` |
| 34 | `ScraperEngine` adım hataları yakalanmıyordu | Tek sayfa hatası tüm kazımayı öldürüyordu | `try/catch` + `abort` olayına bağlama |
| 35 | `toXML` içinde `recordFields` her kayıtta yeniden hesaplanıyordu | Büyük dışa aktarmada O(n·m) gereksiz iş | Döngü dışına alındı |
| 36 | `download_manager`: dizi tabanlı tekilleştirme, kayan imleç, yanlış sayaçlar | Aynı görsel iki kez iniyor; ilerleme çubuğu gerçeği yansıtmıyordu | `Set` + düzgün imleç + doğru başarılı/başarısız/toplam |
| 37 | Sayı ayrıştırma üç ayrı yerde üç ayrı sezgiyle yapılıyordu | CSV, XLSX ve istatistik çubuğu aynı metni farklı sayıya çevirebiliyordu | `transforms.parseNumber` tek kaynak |
| 38 | Zaman aşımında sekme yetim kalıyordu; `isDone` iki farklı anlamda kullanılıyordu | Arka plan sekmeleri kapanmıyor, sözleşme hiç sonuçlanmıyordu | `AbortController` + `createTabOrFetchRunner` (ayrı `isDone` / `settled`) |
| 39 | `Sitemap`, `columnTypes` alanını içe aktarmada düşürüyordu | Kalıcı kolon tipleri kayboluyordu | Korunan alan listesine eklendi |
| 40 | `DataFlattener` büyük çocuk dizilerinde `RangeError` üretiyordu | Geniş kayıtlarda çökme | Yığın yayılımı yerine döngü |
| 41 | `SelectorEngine.queryFirst` her çağrıda tam sorgu çalıştırıyordu | Sıcak yolda gereksiz maliyet | Hızlı yol (fast path) |
| 42 | `background.js`'te ölü `importScripts` çağrıları vardı | MV3 service worker'da anlamsız/yanıltıcı | Kaldırıldı (yorum metni de tor `chrome.*` denetimine takılmayacak şekilde yeniden yazıldı) |
| 43 | `maxClicks` "hayalet seçenek"ti: içerik scripti okuyordu ama hiçbir arayüz/model onu üretmiyordu | Ayar değiştirilemiyordu, hep varsayılan çalışıyordu | Uçtan uca bağlandı: model kıskaçı (1–200, varsayılan 50), `normalizeImported`, dashboard sayı girişi, EN/TR i18n, aksiyon yükü |
| 44 | `lib/csv.js` `parse()`, `options.quoteChar`'ı yok sayıyordu (`unparse()` kullanıyordu) | Özel tırnakla yazılan CSV geri okunamıyordu — round-trip asimetrik | `startsWith` tabanlı tarayıcı; çok karakterli tırnak destekli; 4100 örnekli fark testiyle varsayılan davranış birebir korundu |
| 45 | `test/csv_xlsx_export.test.js` `lib/xlsx.js`'i import edip hiç kullanmıyordu | Ölü import; modülün bağımlılıksız iki girişi (`generateExcelXml`, `buildHtmlTable`) bu dosyada hiç doğrulanmıyordu | Gerçek assertion'larla kullanıldı: sayfa adı sanitize/31 karakter tavanı, XML+HTML kaçışı, sayısal hücre tipi, boş/bozuk girdide çökmeme |

**Regresyon testleri:** `test/review_round3.test.js` (25 test) + `storage_chunks`
(+2) + `sitemap_diff` (+1) + `data_viewer_upgrade` (+1, başlık birleşimi) +
`csv_xlsx_export` (+2: `quoteChar` round-trip ve `lib/xlsx.js` doğrudan API). Kritik düzeltmeler için
**kırmızı→yeşil** akışı çalıştırıldı: `git show HEAD:` ile eski kaynak
geçici olarak geri konulup yeni testlerin gerçekten kırıldığı görüldü, ardından
düzeltme geri yüklendi.

**Doğrulama:** `npm run check` yeşil · `npm test` **318/318** ·
`npm run test:coverage` **%88,81 satır / %72,11 dal / %85,81 fonksiyon**
(eşikler %85/%65/%80, çıkış kodu 0) · `npm run build` panel + 47 tor dosyası.

**Plan.md düzeltmeleri:** Tamamlanmış olmasına rağmen "Geliştirme" listesinde
durduğu için yanıltıcı olan maddeler "Şu an" bölümüne taşındı —
`discardInitialElements` (§2.2), `concurrency`/`robots.txt`/durum dışa-içe
aktarımı/per-request timeout (§2.4), `columnTypes` kalıcılığı (§2.6),
Markdown/XML/`meta.json` (§2.7), galeri sanallaştırma (§2.8), sitemap diff
(§2.9), grafik sürükle-bırak + PNG (§2.10), parçalı IndexedDB yazımı (§2.11),
dönüşüm önizleme (§2.13), manifest şeması + tor hash testleri (§2.15), kapsam
eşiği + property testleri (§2.16). Test sayısı 215 → **318** olarak
güncellendi. Yol haritasında (§4) tamamlanan maddeler işaretlendi ve
"görüntüleyici sanallaştırma" ifadesi netleştirildi (galeri sanal, veri tablosu
sayfalı).

**Bilinen küçük/opsiyonel kalanlar:** (a) hücre düzenlemesinde tüm veri kümesi
yeniden yazılıyor, (b) Chrome tarafında çift `JSON.stringify` çağrısı,
(c) `lib/xlsx.js` `isNumericCell` sayı sezgisi `transforms.parseNumber` ile
birleştirilebilir (bkz. §2.7).

---

## 4. Yol Haritası (öncelik sırası)

**P1 — Motor ve veri bütünlüğü**
1. ~~`discardInitialElements` gerçeğe dönüştürme (snapshot-diff).~~ ✅ **Tamam**
2. ~~Kazıma kuyruğu durumunun dışa/içe aktarımı (kaldığı yerden devam).~~ ✅ **Tamam**
3. ~~concurrency > 1 worker havuzu + per-request timeout.~~ ✅ **Tamam**
4. ~~IndexedDB parçalı kayıt yazımı + kota aşımı davranışı.~~ ✅ **Tamam**
5. **Kalan:** motor `results` dizisinin IndexedDB tamponuna akıtılıp
   bellekten budanması (§2.4) — büyük kazımalarda son bellek tavanı.

**P2 — Kullanıcı arayüzü**
6. ~~Galeri sanallaştırma.~~ ✅ **Tamam** (eşik 120 kare). **Kalan:** veri
   tablosu sanallaştırma — bugün yalnızca sayfalı, sanal değil (§2.6).
7. ~~Seçici düzenleme ekranında "örnek veriyle dönüşüm önizleme".~~ ✅ **Tamam**
8. ~~Grafikte sürükle-bırak yeniden ebeveynleme + PNG dışa aktarma.~~ ✅ **Tamam**
9. ~~Kolon tipi kalıcılığı (sitemap'e bağlı CSV sayı/tarih biçimleri).~~ ✅ **Tamam**
10. **Kalan:** satır onay kutuları + çift tık detay modalı, sütun genişliği
    sürükleme, "filtrelenmiş görünüme göre dışa aktar" (§2.6).
11. **Kalan:** picker geri-al / `Ctrl+A` / `replaceState` / `Tab`-`Enter`
    klavye gezinme (§2.1).

**P3 — Dışa aktarma ve şeffaflık**
12. ~~Markdown + XML dışa aktarımı, ZIP içine `meta.json`.~~ ✅ **Tamam**
13. ~~`robots.txt` yerel okuyucu (opsiyonel anahtar).~~ ✅ **Tamam**
    **Kalan:** tarama başlığı seçicileri (§2.4).
14. ~~Sitemap sürüm-diff aracı (`compare(sitemapA, sitemapB)` saf fonksiyon).~~ ✅ **Tamam**
15. **Kalan:** TR ondalık CSV biçimi, dışa aktarma kolon şablonları (§2.7);
    galeri boyut/kaynak filtreleri, `index.json`, çözünürlük rozeti (§2.8).

**P4 — Kalite kapıları**
16. ~~Kapsam eşiği + property tabanlı testler + tor hash denetimi.~~ ✅ **Tamam**
17. ~~Manifest şema doğrulayıcı (build içinde).~~ ✅ **Tamam**
18. ~~`npm run check`'in CI workflow'u ile GitHub Actions'a bağlanması.~~ ✅ **Tamam**
19. **Kalan:** DOM-free "hızlı" test seti (§2.16); WAR içerik tutarlılık
    denetimi ve `content_scripts` matches üretimi (§2.15).

**P5 — Erişilebilirlik ve bakım (yeni)**
20. Açık tema, `prefers-reduced-motion`, yardım diyaloğu arama filtresi,
    odak halkası/kontrast yaygınlaştırma (§2.14).
21. Grafik klavye gezinme + ARIA rolleri (§2.10).
22. Depolama doluluk göstergesi + "en eski kazımayı temizle", `schemaVersion`
    migrate zinciri, `browser.storage.session` (§2.11).
23. Bileşik anahtar + `merge` silme algılama + modun sitemap'e yazılması (§2.12).
24. `reorderSibling` döngü bildirimini kullanıcıya taşıma; şablon galerisini
    forum/yorum/fiyat iskeletleriyle genişletme (§2.9).

> **Kapsam dışı (bilinçli):** LLM/AI entegrasyonu, bulut senkronizasyonu,
> harici çözümleme/vektör API'leri, uzak proxy havuzları, telemetri —
> proje baştan sona çevrimdışı ve yerel kalacaktır.
