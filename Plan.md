# Web Scraper — Kalan Geliştirme Planı

> Bu belge **yalnızca henüz uygulanmamış** işleri listeler. Tamamlanmış
> özellikler, giderilmiş hatalar ve geçmiş inceleme turları bilinçli olarak
> buradan çıkarıldı; kodun mevcut durumu için tek gerçek kaynak `chrome-edge/`
> ağacı ve `test/` paketidir.
>
> Planlanan hiçbir madde yapay zekâ, bulut servisi, uzaktan analiz veya harici
> bir API'ye bağımlı **değildir**. Tüm işler saf HTML + CSS + Vanilla JavaScript
> (Manifest V3) ile, tarayıcı API'leri ve depodaki mevcut modüller üzerinden
> uygulanabilir.

---

## 1. Çalışma Kuralları

| Katman | Konum | Kural |
|---|---|---|
| Chrome/Edge/Brave kaynağı | `chrome-edge/` | Elle düzenlenen **tek** yer |
| Firefox/Tor derlemesi | `tor/` | `npm run build:tor` üretir — elle düzenlenmez, hash'le kilitli |
| DevTools paneli | `chrome-edge/devtools/panel.html` | `npm run build:panel` üretir — elle düzenlenmez |
| Testler | `test/` | Node.js test runner + jsdom (`npm test`) |
| Kapsam | `npm run test:coverage` | Eşik %85 satır / %65 dal / %80 fonksiyon |
| CI | `.github/workflows/check.yml` | `npm ci` · `check` · `test` · `test:coverage` |

**Kaynak-ağaç kuralı:** `chrome-edge/lib`, `chrome-edge/src` veya
`chrome-edge/content` içinde yapılan *her* değişiklik (yorum satırı bile)
`npm run build:tor` gerektirir; aksi hâlde `npm run check` "tor/ build is out
of date" ile kırmızıya döner.

**Tor yorum kuralı:** `tools/build_tor.js` içindeki `assertNoChromeApi`,
tor'a kopyalanan dosyalarda `chrome.<tanımlayıcı>` metnini **yorumlarda bile**
yakalar. Tor'a gidecek yorumlarda `chrome.*` yazılmamalı.

**Kilitli testler:** `tor/manifest.json` içindeki `background.scripts` listesi
`test/tor_build.test.js` ile kilitlidir — `Storage.js` bu listeden çıkarılamaz.
Ayrıca olumsuz-assertion içeren testler kaynak yorumlarıyla da eşleştiği için,
bir davranışı kaldırırken ilgili yorum metni de gözden geçirilmelidir.

---

## 2. Kalan Geliştirme Maddeleri

### 2.1 Görsel Seçici — `content/selector_picker.js`
- Önizleme tablosunda kolon türü sezimi: seçici türüne göre (Link/Image/Attr)
  otomatik sütun gösterimi ve hücre içerik kırpma uzunluğunun ayarlanabilmesi.
  Kalıcı kolon tipleri sitemap düzeyinde zaten var (§2.6) — picker önizlemesi
  bunları henüz okumuyor.
- Seçim geçmişine "geri al" (son tıklamayı iptal) ve `Ctrl+A` ile kapsam içi
  tüm eşleşmeleri seç kısayolları.
- Kapsam (scope) içine girince URL hash'i yerine `history.replaceState` ile
  durum koruması; panel yeniden yüklense bile seçime devam.
- Dokunmatik/klavye erişilebilirliği: `Tab` ile eleman gezdirme, `Enter` ile seç.

### 2.2 Seçici Türleri — `src/models/Selector.js`, `src/engine/SelectorEngine.js`
- **Table**: colspan/rowspan farkındalığı ve "başlık satırını otomatik algıla"
  güçlendirmesi (th sayımı + ilk satır doluluk skoru). Bugün `colspan` yalnızca
  arayüz tablolarının HTML'inde geçiyor; ayrıştırıcı hücre yayılımını bilmiyor.
- **Grouped**: ayraç yerine JSON dizi çıktısı seçeneği (kolon tipinin
  Excel/CSV'de bozulmaması için).
- **XPath**: hata mesajlarının arayüzde gösterimi — geçersiz predicate bugün
  yalnızca `console.warn('XPath error:', e)` üretiyor, kullanıcı hiçbir şey
  görmüyor. Predicate tabanlı çoklu eşleme testleri de eksik.
- Yeni yerel tür: **SelectorDiff / Değişim Takibi** — aynı sitemap'in iki
  kazıması arasındaki farkı depodaki kayıtlarla yerel olarak hesaplayıp
  "yeni/kaybolan/değişen" etiketiyle listeleyen **kolon üreticisi**.
  Sitemap-*tanımı* düzeyindeki diff var (§2.9); bu madde *kayıt* düzeyindedir
  ve farklı bir iştir.

### 2.3 URL Aralığı Genişletme — `src/engine/UrlRangeExpander.js`
- `[1-100:10]` yanı sıra `[start,step]` biçimi ve negatif adımlı listeler.
- Genişletme sonucunu kopyalama / `.txt` indirme butonları (yalnızca Blob).
- Tarih aralığı üreticisi: `[2024-01-01..2024-12-31:7d]` (tamamen yerel Date
  matematiği).

### 2.4 Kazıma Motoru — `src/engine/ScraperEngine.js`
- Sayfa başına bellek tavanı: sonuç akışını IndexedDB tamponuna yazıp büyük
  kazımalarda `results` dizisini budama. Depolama tarafı parçalı yazıyor
  (§2.11) ama motor `this.results` dizisini kazıma boyunca bellekte tutuyor —
  100k+ kayıtta bu hâlâ bir tavan.
- Tarama başlığı seçicileri: `robots.txt` içindeki `Sitemap:` / `Crawl-delay:`
  satırlarının okunup arayüzde önerilmesi (robots.txt okuyucusu mevcut).

### 2.5 Sekme-Tabanlı Enjeksiyonlu Çalıştırıcı — `dashboard.js` + `content/scraper_content.js`
- Sekme başına "hazır olma" kriteri olarak `readyState` + ağ kararsızlığı
  (networkidle benzeri, yerel sayaç) algısı: dinamik sayfaların yarım
  yakalanmasını azaltır.
- Aksiyon seçimlerini sayfa bazında önbellekleme (aynı şablondaki sayfalarda
  click desenini yeniden keşfetmeme).
- Enjeksiyon modunda `prefers-reduced-motion` zorlamasıyla gereksiz
  animasyon/scroll beklemelerini kısaltma.

### 2.6 Veri Görüntüleyici — `dashboard.js` (browse-data)
- Satır onay kutuları + "Yalnızca seçili satırları dışa aktar".
- Çift tıklamayla satır detay modalı.
- Sütun genişliklerini sürükleme ile ayarlama ve localStorage'a yazma.
- Dışa aktarımda "filtrelenmiş görünüme göre" modu (mevcut kopyalama
  davranışının CSV/Excel butonlarına genelleştirilmesi).
- **Tablo sanallaştırma**: 10k+ satırda yalnızca görünen satırların DOM'a
  basılması. Galeri sanallaştırılmış (§2.8) ama veri tablosu bugün yalnızca
  sayfalı, sanal değil.
- Opsiyonel: hücre düzenlemede tüm veri kümesini yazmak yerine yalnızca değişen
  kaydı yazma.

### 2.7 Dışa Aktarma — `src/export/Exporter.js`, `lib/csv.js`, `lib/xlsx.js`
- CSV'de tarih/sayı biçimi seçenekleri (TR ondalık `1,23` üretme — yerel
  `Intl` ile).
- Dışa aktarma şablonlarını (kolon sırası + yeniden adlandırma) sitemap'e
  gömme; içe aktarmada ters eşleme.
- Sayısal hücre algılamasını (`lib/xlsx.js` `isNumericCell`)
  `transforms.parseNumber` üzerinden tek kaynağa indirme — CSV/XLSX/istatistik
  çubuğu aynı sayı tanımını kullansın. Bugün ayrı sezgiler var; tutarsızlık
  riski sürüyor.

### 2.8 Görsel Galeri ve Slayt Gösterisi — `dashboard.js`
- Galeri "görsel boyutu/kaynak filtre" ön ayarları (yalnızca 300px+ gibi;
  yerel `Image()` ölçümü).
- "Yalnızca yüklenemeyenleri göster" hata filtresi.
- ZIP'e seçili görsellerin JSON yan-dosya listesi (`index.json`) eklenmesi.
- Slaytta EXIF başlığı yerine yerel `Image.decode()` + `naturalWidth` ile
  çözünürlük rozeti (harici kütüphane yok).

### 2.9 Sitemap Yönetimi ve Şablonlar — `src/models/Sitemap.js`, `lib/sitemap_templates.js`
- Şablon Galerisi genişletme: forum / liste-yorum / fiyat takibi iskeletleri
  (yalnızca depodaki statik veri, ağ isteği yok).
- Kopyalama sırasında seçici ID çakışmalarını otomatik son-ek ile çözme
  (`_copy2` davranışının seçicilere de uygulanması).
- Döngüsel bağımlılık denetiminin `reorderSibling`'de de bildirim üretmesi:
  `wouldCreateCycle` bugün sessizce `false` dönüyor, kullanıcı sürüklemenin
  neden uygulanmadığını görmüyor.

### 2.10 Seçici Hiyerarşi Grafiği — `src/ui/SelectorGraph.js`
- Klavye ile gezinme ve ARIA ağaç rolleri (grafik bugün yalnızca fare ile
  erişilebilir).
- Dallanmış tipleri (Link/Element) vurgulayan "akış vurgusu" modu.
- Sürüklerken bırakma hedefinin görsel önizlemesi: şu an yalnızca hedef kartta
  kesikli çerçeve var; "bırakılırsa nereye bağlanır" oku/gölgesi yok.

### 2.11 Depolama — `src/storage/Storage.js`
- Depolama **doluluk göstergesi** (arayüzde). `getBytesInUse` kota algılaması
  için içeride kullanılıyor ama kullanıcıya gösterilmiyor.
- "En eski kazımayı temizle" bakım aracı.
- Uygulama içi şema sürümü (`schemaVersion`) ile migrate zinciri;
  geri-dönüşlü yedek.
- `browser.storage.session` kullanımı: sekme-geçici durum (aktif kazıma
  imleci) — Chrome/Edge/Firefox'un yerel API'si.

### 2.12 Artımlı Kazıma Modları — `lib/datamode.js`
- Anahtar kolon yerine **birden fazla anahtar** (bileşik anahtar) desteği.
- `merge` moduna "silme algılama": kaybolan anahtarları `stale=true` işaretle
  (silmek opsiyonel).
- Mod seçimini sitemap'e kalıcı yazma — bugün arayüz seçimi her kazımada
  yeniden okunuyor.

### 2.13 Metin Dönüşümleri — `lib/transforms.js`
Bugün yalnızca `trim`, `lowercase`, `uppercase`, `capitalize`, `number`,
`regexReplace` var. Eklenecek yerel adımlar:
- `title-case` istisnaları
- boşluk normalizasyonu (NBSP)
- `sıra-boz` (split-sort-join)
- `sayı → para birimi biçimle` (Intl)
- `kısalt` (ellipsis)
- `boş değerleri sıfır yap`
- Kullanıcının kendi JS ifadesini yazabildiği `customJs` adımı (yalnızca
  sandbox'lı, ağ erişimsiz değerlendirme).

### 2.14 Arayüz, Tema ve Erişilebilirlik — `dashboard.css`, `popup`, DevTools paneli
- Açık tema seçeneği (`[data-theme="light"]` + tek dosya token seti; yerel
  tercih). Bugün tek karanlık palet var.
- `prefers-reduced-motion` ile slayt/animasyon otomatik yumuşatma.
- Yardım diyaloguna arama filtresi ve kısayol çakışma denetimi.
- Odak halkası ve kontrast iyileştirmelerinin **tüm** etkileşimli öğelere
  yayılması (WCAG AA hedefi, yalnızca CSS) — bugün `:focus-visible` yalnızca
  iki kuralda tanımlı.

### 2.15 Tor/Firefox-native Derleme — `tools/build_tor.js`, `tools/tor_native/`
- `content_scripts` matches desenlerinin otomatik üretilmesi (elle liste
  yerine).
- `web_accessible_resources` **içerik** tutarlılık denetimi: şema doğrulayıcı
  alanın varlığını denetliyor, içeriğinin kaynak ağaçla tutarlılığını değil.

### 2.16 Test Altyapısı — `test/`
- jsdom yerine hızlı alternatif: motor modüllerini DOM-free sahte
  `querySelectorAll` ile besleyen "hızlı" test seti (`npm run test:fast`).
  Tam paket bugün ~80 sn sürüyor.

---

## 3. Yol Haritası (öncelik sırası)

**P1 — Motor ve veri bütünlüğü**
1. Motor `results` dizisinin IndexedDB tamponuna akıtılıp bellekten budanması
   (§2.4) — büyük kazımalarda kalan son bellek tavanı.
2. `robots.txt` tarama başlığı seçicileri (§2.4).

**P2 — Kullanıcı arayüzü**
3. Veri tablosu sanallaştırma (§2.6) — galeri sanal, tablo yalnızca sayfalı.
4. Satır onay kutuları + çift tık detay modalı + sütun genişliği sürükleme +
   "filtrelenmiş görünüme göre dışa aktar" (§2.6).
5. Picker geri-al / `Ctrl+A` / `replaceState` / `Tab`-`Enter` klavye gezinme
   (§2.1).

**P3 — Dışa aktarma ve veri biçimi**
6. TR ondalık CSV biçimi + dışa aktarma kolon şablonları (§2.7).
7. Sayısal hücre algılamasını `transforms.parseNumber`'da birleştirme (§2.7).
8. Galeri boyut/kaynak filtreleri, `index.json`, çözünürlük rozeti (§2.8).

**P4 — Erişilebilirlik ve tema**
9. Açık tema, `prefers-reduced-motion`, yardım diyaloğu arama filtresi, odak
   halkası/kontrast yaygınlaştırma (§2.14).
10. Grafik klavye gezinme + ARIA rolleri + bırakma hedefi önizlemesi (§2.10).

**P5 — Depolama ve bakım araçları**
11. Depolama doluluk göstergesi + "en eski kazımayı temizle" (§2.11).
12. `schemaVersion` migrate zinciri + `browser.storage.session` (§2.11).
13. Bileşik anahtar + `merge` silme algılama + modun sitemap'e yazılması (§2.12).

**P6 — Model ve şablon genişletme**
14. `reorderSibling` döngü bildirimini kullanıcıya taşıma; şablon galerisini
    forum/yorum/fiyat iskeletleriyle genişletme; kopyalamada seçici ID son-eki
    (§2.9).
15. Table colspan/rowspan + başlık satırı otomatik algılama; Grouped JSON dizi
    çıktısı; XPath hatalarının arayüze taşınması (§2.2).
16. Yeni dönüşüm adımları + `customJs` (§2.13).
17. SelectorDiff kayıt-düzeyi değişim takibi kolonu (§2.2).
18. URL aralığı `[start,step]`, negatif adım, kopyala/`.txt`, tarih aralığı
    (§2.3).

**P7 — Kalite kapıları**
19. DOM-free "hızlı" test seti (§2.16).
20. WAR içerik tutarlılık denetimi + `content_scripts` matches üretimi (§2.15).
21. Enjeksiyon modunda networkidle-benzeri hazırlık algısı + aksiyon
    önbellekleme (§2.5).

> **Kapsam dışı (bilinçli):** LLM/AI entegrasyonu, bulut senkronizasyonu,
> harici çözümleme/vektör API'leri, uzak proxy havuzları, telemetri —
> proje baştan sona çevrimdışı ve yerel kalacaktır.
