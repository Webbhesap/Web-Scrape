# Web Scraper Uzantı - Geliştirme Planı

**Depo:** https://github.com/Webbhesap/Web-Scrape  
**Dala:** `arena/01a065a0-web-scrape`  
**Son Güncelleme:** 2026-09-03

---

## 📋 Genel Bakış

Bu plan, **Web Scraper** Chrome uzantısı için tamamen yerel, dışarıya bağlı olmayan (offline-first) özellikleri, migliorasyonları ve mimari iyileştirmeleri belgeler. Uzantı tamamen HTML, CSS ve Vanilla JavaScript ile (Manifest V3 uyumlu) yapılmış, hiçbir dış servis, API veya bulut bağımlılığı içermez. Tüm veriler tarayıcı içindeki IndexedDB'de saklanır. Sadece ücretsiz, yerel özellikler içerir.

Amaç, bakıma bakayan için net öncelikli bir yol haritası sağlamak ve geliştirmeyi incremental (artımlı) başlatmak için kullanılabilir olmasıdır. Her özellik tamamen eklenti içinde çalışır, tarayıcı dışı hiçbir şey gerektirmez.

---

## ✿ Meydada Olan Özellik Özeti (Referans - Yerel Sadece)

Uzantı zaten **50+ yerel özellik** içinde geliyor - hiçbir bulut veya AI hizmeti gerekmez:

1. **Görsel Element Seçici** - Nokta ve tıklayarak seçici, hiyerarchy traversal, canlı önizleme ve CSS genelleştirmesi (tamamen yerel).
2. **12 Seçici Tipi** - Metin, Bağlantı, Resim, Tablo, Eleman, Özellik, HTML, Gruplu, Pagination, Tık, Scroll ve daha fazlası (tamamen yerel).
3. **URL Aralık Genişlemesi** - Numeric, sıfırlandırılmış, artış, alfabetik, değer listeleri ve cartesian product'lar (tamamen yerel).
4. **Etkileşimli Seçici Hiyerarchie Grafiği** - SVG ağacı diyagramı, renkli node'lar, pan/zoom ve tıklama navigasyonu (tamamen yerel).
5. **Scraping Motor & Canlı İzleyici** - Yapılandırılabilir istek gecikmesi (ms), sayfa yükleme gecikmesi (ms), maksimum sayfa limiti. Gerçek zamanlı metrikler (Ziyaret sayısı, Kayıt sayısı, Kuyu boyu, Geçen zaman). Kontroller: Duraklat, Devam Et, Durdur. Gerçek zamanlı etkinlik log akışı (tamamen yerel - tarayıcı içinde).
6. **Resim Galerisi & Slideshow** - Yanıt gridi, aybarak sütun sayısı, inline URL düzenleme ve per-image silme. Fullscreen slideshow fade/slide/zoom/cut geçişleri ile otomatik oynama aralığı. Fare tekerleği ile slayt gezinmesi; Space tuşu da çalışır, Esc kapatır. Otomatik gizleme 2 saniye inaktifiteden sonra — fare imleci de onlarla birlikte gözlemlenen bir görünüm için gizlenir. Galeri toolbar'undan tüm/selected görsellerin ZIP dışa aktarımı (tamamen yerel, dosya sistemi API'si ile).
7. **Tamamen Temalandırılmış Koyu UI** - Tek renk paleti CSS custom properties'leri kullanı, ve `color-scheme: dark` tarayıma dahil oluyor, böylece tarayıma ait kontrolerin (select, slider, scrollbar, vb.) koyu temayı benimsemesi yerine beyaz renkte_render olmasını sağlar. Aynı tematik, dashboard, DevTools panel, toolbar popup ve in-page selector picker için uygulanır.
8. **Veri Görüntüleyve ve Çoklu İhracat Formatları** - Interactive veri tabli, kolom sıralama (artan/azalan), canlı kelime arama ve sayfalama. **CSV'ye İhracat**: RFC 4180 uyumlu, Microsoft Excel uyumu için UTF-8 BOM, yapılandırılabilir ayraçlar (aralık `,`, noktalı virgül `;`, tab `\\t`). **Excel'e İhracat**: SpreadsheetML XML formatı (`.xls`) ile styled headers ve native column widths. **JSON'e İhracat**: Formatlı JSON kayıt dizisi. **İhracat / İçe Aktar Sitemap**: JSON tanımlamaları üzerinden sitemap'leri paylaşma ve yedekleme (tamamen yerel JSON dosyaları).

---

## 🚀 Önceliklendirilmiş Geliştirilebilir Özellikler & Geliştirmeler (Yerel Sadece)

### Faiz 1: Çekirdek Geliştirmler (Yüksek Etki, Düşük Risk - Tamamen Yerel)

| ID | Özellik | Açıklama | Çaba |
|----|---------|----------|------|
| **F1** | **Akıllı CSS Seçici Otogenelizasyon ✅** | Kullanıcı benzer öğeleri tıkladığında daha sağlam, iç içe gelen seçiciler üretmesi için multi-element algılama algoritmasını geliştirme (örnek: listedeki ürün kartları). Şu an iyi, ama dinamik sınıflar ve shadow DOM için optimize edilebilir. TAMAMEN YEREL - herhangi bir dış servis gerekmez. | Orta |
| **F2** | **XPath Seçici Destek ✅** | Kullanıcının custom XPath sorguları yazabilmesi için yeni bir seçici tipi veya uzantısı ekleme. Mevcut `SelectorElementAttribute` UI'sinde bir toggle olabilir. TAMAMEN YEREL - tarayıcı içi XPath motoru kullanılır. | Yüksek |
| **F3** | **Yerel Oturum Kalıcılığı** | IndexedDB üzerinden sitemap durumunu (ziaret edilen URL'ler, çıkarılan veri, kuyu durumu) tarayıcı yeniden başlatmalarının üzerine koruma. **HİÇBİR BULUT SERVISI YOK** - veriler sadece bu tarayıcıdaki IndexedDB'de saklanır. | Orta |
| **F4** | **Seçici Şablon Kütüphanesi ✅** | Amazon, eBay, Indeed gibi yaygın siteler için ön tanımlı selector'lar, kullanıcılar tek tıkla içe aktarabilirseki yeni scrpae'lar için kurulum zamanını azaltma. Şablonlar JSON olarak saklanır, buluta yüklenmez. | Orta |
| **F5** | **Sonsuz Scroll & Load More Otomasyonu ✅** | "Load More" butonları ve infinite scroll'ların tanımı ve otomasyonu ile geliştirme, yapılandırılabilir maksimum istek, gecikme ve görsel geri bildirimle birlikte. TAMAMEN YEREL. | Orta |

### Faiz 2: UI/UX & Erişilebilirlik İyileştirmeleri (Yerel)

| ID | Özellik | Açıklama | Çaba |
|----|---------|----------|------|
| **F6** | **Duygun Popup & Dashboard ✅** | Popup ve dashboard layout'larını dar ekranlar için uygun yapma (örnek: dikey sidebar, gömülü DevTools). Şu bazı yerlerde fixed-width. | Düşük |
| **F7** | **Klavye Navigasyon & Erişilebilirlik Çaprazı ✅** | Tam klavye navigasyonu (Tab/Shift-Tab), ARIA etiketleri, fokus yönetimi, ekran okuyucu uyumu forselector picker, gallery ve data table. | Orta |
| **F8** | **Tema Değişici (Koyu/Gün/Yüksek-Erkiçe) ✅** | Otomatik `color-scheme: dark`'in yanında manuel tema değiştirici ekleyin, özelleştirilebilir renk değişkenleri ve storage'a kalıcılık. TAMAMEN YEREL - storage'da renk ayarları saklanır. | Orta |
| **F9** | **Sürükle ve Bırak Seçici İçe Aktarıma ✅** | Kullanıcılar OS dosya gezgininden JSON sitemap dosyasını dashboard veya popup'ına sürükleyerek içeri aktarabilir, "İçe Aktar" butonu iletişim kutusundan ziyade. TAMAMEN YEREL - dosya okuma File API ile. | Düşük |

### Faiz 3: İhracat & Veri Kullanımı (Yerel)

| ID | Özellik | Açıklama | Çaba |
|----|---------|----------|------|
| **F10** | **XML & Google Sheets İhracatı ✅** | Google Sheets `IMPORTXML` ile uyumlu XML ihraç formatı, plus "Copy as cURL" özelliği mevcut çıkarma konfigürasyonu için. XML dosyası yerel olarak oluşturulur, Google Sheets'e yüklenmeden önce önizleme yapılır. | Orta |
| **F11** | **Toplu Veri Dönüşümü ✅** | Post-scrape dönüşümler: boşlukları kestirme, URL'leri normalleştirme, regex değiştirme, küçük/büyük harf, ve sütun başına custom JavaScript parçacıkları. TAMAMEN YEREL - JavaScript engine içinde çalışır. | Yüksek |
| **F12** | **Kural Tabanlı Dinamik Veri Tespiti ✅** | Kural tabanlı (regex/pattern matching) tespit of dinamik olarak yüklenen veriler (fiyatlar AJAX ile güncelliyor, review sayısı, stok durumu) ve önerilen selector üretme. **YEREL AI YOK** - sadece regex/pattern kuralları kullanılır, dışarıdaki AI servisi yok. | Yüksek |

### Faiz 4: Motor & Performans (Yerel)

| ID | Özellik | Açıklama | Çaba |
|----|---------|----------|------|
| **F13** | **Bölümlice Sayfa Scraping ile İzolasyon ✅** | Birden fazla sayfayı aynı anda scrapping yapma, per-tab izolasyon (storage, CSS, JS) ile büyük sitemap'leri hızlandırma, concurrency cap ve global throttle ile. TAMAMEN YEREL - tab isolation IndexedDB ile. | Yüksek |
| **F14** | **Bellek Sızıntısı Düzeltmeleri & Temizlik ✅** | Uzun süren crawling (>100 sayfa) sırasında event listeners, timeouts ve Interval referanslarının sistematik incelemesi ve düzeltilmesi. | Orta |
| **F15** | **Seçici Logger & Log Dışa Aktarıma** | Kullanıcılar aktivite log'ını JSON/CSV olarak dışa aktarabilir, severity (info/warn/error) ve zaman aralığı ile filtreleyebilir, console erişimi olmadan debug için. TAMAMEN YEREL - tarayıcı log'ı. | Düşük |

### Faiz 5: Test & Kalite Garantisi (Yerel)

| ID | Özellik | Açıklama | Çaba |
|----|---------|----------|------|
| **F16** | **Cross-Browser Uyumluluk Testleri** | Test süitesini Firefox ve Edge davranışları (Manifest V3 farkları, storage API, icon handling) kapsamına genişletme. TAMAMEN YEREL - jsdom ile simülasyon. | Orta |
| **F17** | **Otomasyon Testleri (Sadece Yerel Araçlar)** | Test otomasyonu için yerel araçlar kullanılarak genişletme. Puppeteer/Playwright **YOK** - sadece test framework'ları (jest/jsdom) kullanılır. | Orta |
| **F18** | **Property-Based Testing for Selector Generation** | Seçici oluşumu için property-based testing. `hypothesis` **YOK** - sadece deterministic test case'lar kullanır, hiçbir dış servis yok. | Yüksek |

### Faiz 6: Dokumentasyon & Onboarding (Yerel)

| ID | Özellik | Açıklama | Çaba |
|----|---------|----------|------|
| **F19** | **[Kaldırıldı] Interaktif Quick-Start Eğitimi** | Kullanıcının ilk kez deneyimi için adım adım rehber (Shepherd.js gibi hafif kütüphane ile), kurulum, sitemap oluşturma, scraping yapma ve veri ihracatı covered. **BUÖZ KALDIRILDI** - kullanıcı istemediği için kaldırıldı. | - |
| **F20** | **[Kaldırıldı] Video Demo Kütüphanesi** | Kısa (30-60 saniye) ekran kaydı demolar en çok kullanılan özellikler için: görsel picker, range expansion, gallery slideshow, CSV ihracatı. **BUÖZ KALDIRILDI** - kullanıcı istemediği için kaldırıldı. | - |
| **F21** | **Geliştirici Katkı Rehberi** | Yeni bir selector type ekleme, test suite'ını çalışma, DevTools panel'ını build etme ve PR'lar submit etme hakkında dokümantasyon, inklinting/formatting standartları içeren. TAMAMEN YEREL. | Düşük |

---

## 📦 Önerilen Geliştirme Adımı

**F1 (Akıllı CSS Seçici Otogenelizasyon) ve F6 (Duygun Popup/Dashboard)'a başlayın.**

Bu iki özellik, anında kalite-artışlar sunarken kapsamları sınırlı ve mevcut `src/models/Selector.js` ve `dashboard/dashboard.html`/`popup/popup.html` yapıları kullanılarak implement edilebilir. TAMAMEN YEREL - herhangi bir API anahtarı veya bulut servisi gerekmez.

**Aşamalı Eylemler:**
1. Repo'yu fork/clonelayın ve test süitesinin geçerli olduğundan emin olun: `npm install && npm test` (73 test, tamamen yerel - herhangi bir API key veya dış servis gerekmez)
2. `feature/F1-smart-generalization` gibi bir feature branch oluşturun ve iyileştirmeleri uygulayın
3. `PLAN.md` ilerleme güncellemelerini güncelleyin, tamamlandıkça sık sık commit'leyin `arena/01a065a0-web-scrape`
4. PR açarken sadece ilgili dosyaları `git add` gönderin - tüm repo değil, sadece özelliği değiştiren dosyalar.

---

## 🛠️ Geliştirme Akışı (Yerel Odaklı)

- **Dala:** `arena/01a065a0-web-scrape` (bu oturum)
- **Commit formatı:** `git commit -m "F1: improve CSS selector generalization for dynamic class names - local only"`
- **Push:** `git push origin arena/01a065a0-web-scrape`
- **Testler:** `npm test` (73 test, tamamen yerel - herhangi bir API key veya dış servis gerekmez)
- **Panel build:** `npm run build:panel` (dashboard/html'ten `devtools/panel.html`'i yeniden üretir - tamamen yerel)
- **Önemli:** PR açarken sadece güncellenen dosyaları `git add` gönderin. Tüm repo değil, sadece changed files gönderin.

---

## 📬 Geri Bildirime & Planlama

Bu plan canlı bir belgedir. Her özellik şu şekilde işlenebilir:
- **Deferred** – daha sonraki faz veya sürüme ertelenebilir
- **Split** – bağımsız PR'lar halinde parçalanabilir
- **Merged** – düşük-risk/yüksek-değerse olduğu gibi birleştirilebilir
- **Replaced** – başka bir yerel fikir ile değiştirilebilir

İnceleyin, yeniden sıralayın veya herhangi bir öğeyi genişletin. F1 (Akıllı CSS Seçici Otogenelizasyon) gibi birinci faiz öğesini seçin, feature branch oluşturun ve ilk incremental değişikliği uygulayın. Tüm kod tamamen yerel kalır, hiçbir dış servise bağlanmaz.

---

*Web Scraper uzantısı - tamamen yerel geliştirme planı. Herhangi bir bulut, API veya AI servisi gerekmez. F20 (Video Demo Kütüphanesi) ve F19 (Interaktif Quick-Start Eğitimi) özellikleri kullanıcı isteğiyle tamamen kaldırılmıştır.*