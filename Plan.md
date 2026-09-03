# Web Scraper — Geliştirme Planı (Plan.md)

Bu belge, eklentideki **mevcut özelliklerin** en iyi şekilde geliştirilmesi için planlanan
iyileştirmeleri içerir. Tüm maddeler **tamamen yerel** çalışır; hiçbiri yapay zekâ veya
dışa bağımlı (harici) API içermez. Yalnızca saf HTML + CSS + Vanilla JavaScript kullanılır.

---

## Yapılan Hata Düzeltmeleri (bu plandan önce tamamlandı)

| # | Düzeltme | Dosya |
|---|----------|-------|
| 1 | Yarım kalmış **SelectorXPath** tipi tamamlandı: `SelectorEngine.extract()` yönlendirmesi, `document.evaluate` yerine belgenin kendi penceresinden `doc.evaluate` kullanımı, `FIRST_ORDERED_NODE_TYPE` için yanlış `snapshotItem(0)` çağrısının `singleNodeValue` ile düzeltilmesi, model `toJSON`/constructor desteği, dashboard tip listesi + rozet + graf rengi + i18n | `src/engine/SelectorEngine.js`, `src/models/Selector.js`, `dashboard/*`, `src/ui/SelectorGraph.js`, `lib/i18n.js` |
| 2 | `ScraperEngine.start()` tekrar çağrıldığında kuyruk ve `endTime` sıfırlanmıyordu → yeniden başlatmada eski işler tekrar işleniyordu | `src/engine/ScraperEngine.js` |
| 3 | Aynı URL'nin kuyruğa defalarca eklenmesi (performans/tekrar kayıt sorunu) → `enqueueJob()` ile (parent, url) bazlı tekilleştirme | `src/engine/ScraperEngine.js` |
| 4 | `SelectorPagination.maxPages` alanı tanımlı ama motor tarafından hiç kullanılmıyordu → sayfalama derinliği takibi ile sınır uygulanır | `src/engine/ScraperEngine.js` |
| 5 | Kayıt oluşturma kodunun 4 yerde kopyalanması → `pushLeafRecord()` / `enqueueLinks()` yardımcıları ile kod tekrarı giderildi | `src/engine/ScraperEngine.js` |
| 6 | Arka plan servisinin `PICKER_RESULT` mesajını yeniden yayınlaması sonsuz/çift işleme riski taşıyordu → `_forwarded` bayrağı ile döngü kırıldı; `OPEN_DASHBOARD` yanıtı senkron olduğu halde `return true` ile kanal açık tutuluyordu | `background.js`, `dashboard/dashboard.js` |
| 7 | `cloneSitemap` her zaman `_copy` kimliği ürettiğinden ikinci klonlama öncekini eziyordu → boş kimlik bulana dek `_copy2, _copy3…` denenir | `dashboard/dashboard.js` |
| 8 | `SelectorGraph` her render'da `window`'a yeni `mousemove/mouseup` dinleyicileri ekleyip hiç kaldırmıyordu (bellek sızıntısı) → container başına temizleme kancası | `src/ui/SelectorGraph.js` |
| 9 | CSV üretiminde `quoteChar` doğrudan `new RegExp()` içine gömülüyordu; özel karakterler bozulmaya yol açıyordu → `split/join` ile güvenli kaçış | `lib/csv.js` |
| 10 | `UrlRangeExpander` `[1-99999999]` gibi bir yazım hatasında arayüzü donduruyordu → 100.000 URL güvenlik tavanı | `src/engine/UrlRangeExpander.js` |
| 11 | "Request interval / Page load delay" alanına 0 yazılınca `|| 2000` nedeniyle 2 sn'ye zorlanıyordu → `Number.isFinite` koruması | `dashboard/dashboard.js` |
| 12 | Kazıma çalışırken "Start" tekrar tıklanınca ikinci motor ilkinin metriklerini bozuyordu → çift başlatma koruması + i18n mesajı | `dashboard/dashboard.js`, `lib/i18n.js` |
| 13 | Galeri ZIP indirmede `URL.createObjectURL` hiç serbest bırakılmıyordu (bellek sızıntısı) | `dashboard/dashboard.js` |
| 14 | Depolamada bozuk kayıtlara karşı korunma: `records` dizi kontrolü, `localStorage` JSON parse `try/catch` | `src/storage/Storage.js` |

---

## Geliştirilecek Özellikler (sırasıyla uygulandı — tümü TAMAMLANDI ✅)

### Özellik 1 — Veri Görüntüleyici: Sayfa boyutu seçici ve satır silme ✅
Mevcut veri tablosu 25 kayıtlık sabit sayfa boyutuyla çalışıyor ve satır silinemiyor.
- Sayfa boyutu seçici: **25 / 50 / 100 / 250** kayıt.
- Her satıra **satır silme** düğmesi; silme kalıcı olarak depoya yazılır.
- Sayfa boyutu değişince geçerli sayfa akıllıca korunur (taşma durumunda son sayfaya gidilir).
- i18n: EN + TR etiketleri.

### Özellik 2 — Dışa Aktarma: TSV ve NDJSON (JSON Lines) formatları + panoya kopyalama ✅
Mevcut dışa aktarma CSV / Excel / JSON ile sınırlı.
- **TSV** (`.tsv`, sekme ayraçlı) dışa aktarma.
- **NDJSON / JSON Lines** (`.ndjson`, satır başına bir JSON kaydı) dışa aktarma — büyük veri
  kümelerini akış hâlinde işleyen araçlarla uyum için.
- "Browse Data" görünümüne **panoya CSV kopyala** düğmesi.
- `Exporter` sınıfına saf fonksiyonlar olarak eklenir; birim testleri yazılır.

### Özellik 3 — Sitemap Yedekleme: Tümünü dışa/içe aktarma ✅
Mevcut içe/dışa aktarma tek sitemap ile sınırlı.
- **Tüm sitemap'leri tek JSON dosyası** (`webscraper_backup_YYYY-MM-DD.json`) olarak indirme.
- Aynı dosyayı **içe aktarma**: tekli sitemap JSON'u da, yedek dizisi de kabul edilir;
  çakışan kimlikler üzerine yazılır, sonuç raporlanır.
- Sitemaps listesi araç çubuğuna "Tümünü Dışa Aktar" düğmesi.

### Özellik 4 — URL Aralığı Önizleme (Sitemap Meta formu) ✅
`[1-100]` gibi kalıplar yazarken kullanıcı kaç URL üretileceğini göremiyor.
- Başlangıç URL alanının altında **canlı önizleme**: üretilecek toplam URL sayısı ve
  ilk 5 örnek URL.
- 100.000 tavanına ulaşıldığında uyarı gösterilir.
- Tamamen istemci tarafında, `UrlRangeExpander` ile hesaplanır.

### Özellik 5 — Galeri İyileştirmeleri ✅
- Görseller **`loading="lazy"`** ile tembel yüklenir (yüzlerce görselde performans).
- **Tümünü seç / Seçimi temizle** düğmeleri (ZIP'e seçili indirme ile birlikte çalışır).
- Seçili görsel sayısı rozeti.

### Özellik 6 — Kazıma Monitörü: Hata metriği ve günlük indirme ✅
- Metrik kartlarına **Hata sayacı** eklenir (başarısız sayfa/istek sayısı).
- **Günlüğü indir** düğmesi: etkinlik günlüğünü zaman damgalı `.txt` olarak kaydeder.
- Günlük kutusu 500 satırla sınırlanır (uzun kazımalarda DOM şişmesini önler).

---

## Uygulama Kuralları
1. Özellikler yukarıdaki sırayla uygulanır.
2. Her özellikten sonra **tüm test paketi** (`npm test`) çalıştırılır ve yeni özellik için
   regresyon testi eklenir.
3. `devtools/panel.html`, `dashboard.html` değiştiğinde `npm run build:panel` ile yeniden üretilir.
4. Hiçbir özellik ağ tabanlı üçüncü taraf servis, uzak API veya yapay zekâ bileşeni içermez.

---

## Test Durumu

| Aşama | Test Dosyası | Sonuç |
|-------|--------------|-------|
| Hata düzeltmeleri | `test/engine_fixes.test.js` (7 test) | ✅ |
| Özellik 1 | `test/data_viewer_features.test.js` (2 test) | ✅ |
| Özellik 2 | `test/export_formats.test.js` (4 test) | ✅ |
| Özellik 3 | `test/sitemap_backup.test.js` (4 test) | ✅ |
| Özellik 4 | `test/url_preview.test.js` (2 test) | ✅ |
| Özellik 5 | `test/gallery_features.test.js` (2 test) | ✅ |
| Özellik 6 | `test/scrape_monitor.test.js` (3 test) | ✅ |
| **Toplam paket** | `npm test` | **97 / 97 geçti** ✅ |
