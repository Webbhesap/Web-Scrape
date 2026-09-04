# Web Scraper — Gelişmiş Özellik Planı (Plan.md)

Bu belge, eklentide mevcut olan özelliklerin **en gelişmiş hallerini** (geliştirme
yol haritasını) içerir. Tüm maddeler **tamamen yerel** çalışır: yapay zekâ yok,
dış API yok, internet tabanlı servis yok. Sıradaki her özellik uygulanır uygulanmaz
tam test paketi çalıştırılır ve hatalar düzeltilir.

Kaynak kod yerleşimi:

| Klasör | İçerik |
|---|---|
| `chrome-edge/` | Chrome / Edge / Brave / Chromium (Manifest V3) eklentisi |
| `tor/` | Tor Browser / Firefox ESR derlemesi (`npm run build:tor` ile üretilir) |
| kök dizin | Testler (`test/`), derleme araçları (`tools/`), bu plan |

---

## Ö1 — Seçici metin dönüşümleri ve varsayılan değer (Text transforms + default value)

**Mevcut:** Seçiciler ham metin/öznitelik çıkarır; yalnızca `regex` ile eşleşme
yakalanabilir.

**Gelişmiş hali:**

- Seçici başına dönüşüm zinciri (`transforms`): `trim`, `lowercase`,
  `uppercase`, `capitalize`, `number` (1.234,56 / 1,234.56 / $ € ₺ önekli
  para birimleri dahil yerel ayrıştırma), `regexReplace` (bul/değiştir,
  yakalama gruplarıyla `$1` desteği).
- Boş çıkan kayıtlar için seçici başına `defaultValue`.
- Dönüşümler çıkarma anında uygulanır; CSV/Excel/JSON dışa aktarmaya kadar
  veri temiz olur.
- UI: seçici düzenleme formunda "Dönüşümler" bölümü (dönüşüm ekle/çıkar/sırala).
- Her iki derlemede (chrome-edge + tor) birebir çalışır.

**Kabul ölçütleri:** birim testleri dönüşüm zincirinin sırasını, sayı
ayrıştırmayı (TR/EN biçimleri) ve varsayılan değeri kapsar; dashboard formu
dönüşümleri kaydedip geri yükler.

---

## Ö2 — Gölge DOM (Shadow DOM) desteği

**Mevcut:** `querySelectorAll` yalnızca açık ağacı tarar; gölge kökleri içindeki
öğeler hiç bulunamaz.

**Gelişmiş hali:**

- `SelectorEngine.queryAll/queryFirst` açık + kapalı olmayan gölge köklerini
  özyinelemeli tarar (`shadowRoot` erişilebilen tüm öğeler).
- Site haritası ayarı: "Gölge DOM içine in" (varsayılan açık; kapatılınca
  eski davranış).
- Picker (`content/selector_picker.js`) kapsam sorgularını aynı yardımcıyla
  yapar; gölge içindeki öğeler de seçilebilir.

**Kabul ölçütleri:** jsdom'da gölge kök içine yerleştirilmiş öğelerin
`SelectorText`/`SelectorElementAttribute` ile çıkarıldığını gösteren testler.

---

## Ö3 — Motor dayanıklılığı: yeniden deneme, maksimum derinlik, URL desenleri

**Mevcut:** Tek hata tüm sayfayı düşürür; tarama derinliği sınırsızdır; hangi
URL'lerin izleneceği kısıtlanamaz.

**Gelişmiş hali:**

- **Yeniden deneme + geri çekilme (backoff):** sayfa başına `requestRetry`
  denemesi, üstel bekleme; kalıcı hatalar günlükte "error" olarak işaretlenir.
- **Maksimum derinlik (`maxDepth`):** kök sayfa 0 olmak üzere bağlantı
  derinliği sınırlanır; `maxPages` ile birlikte çalışır.
- **URL desen filtreleri:** `includeUrlPatterns` / `excludeUrlPatterns`
  (joker `*` destekli). Yalnızca eşleşen URL'ler kuyruğa girer; hariç
  tutulanlar günlüklenir.
- Üç ayar da kazıma görünümündeki yapılandırma panelinden alınır.

**Kabul ölçütleri:** hata veren sayfanın yeniden denendiği, derinliğin
aşıldığında kuyruğa yeni iş eklenmediği ve desenlerin kuyruğa girişi
engellediği birim testleri.

---

## Ö4 — Artımlı kazıma (birleştirme modu)

**Mevcut:** Her kazıma önceki kayıtların üzerine yazar.

**Gelişmiş hali:**

- Kazıma ayarında "Mevcut veriyle birleştir" seçeneği: `append` (sona ekle),
  `merge` (anahtar sütuna göre birleştir/güncelle), `replace` (eskisi).
- `merge` modunda anahtar sütun seçilir; aynı anahtarlı satırlar güncellenir,
  yenileri eklenir.
- Kayıt sayacı artık toplam birleşik kaydı gösterir.

**Kabul ölçütleri:** birim testleri: append toplam sayıyı artırır; merge aynı
anahtarı günceller, yeni anahtarı ekler; replace eskiyi siler.

---

## Ö5 — Veri görüntüleyici: sütun filtreleri, istatistikler, çoklu sıralama,
sütun görünürlüğü

**Mevcut:** Tek genel arama, tek sütunda sıralama, tüm sütunlar görünür.

**Gelişmiş hali:**

- **Sütun filtre satırı:** her sütun altında kendi metin filtresi; genel
  aramayla birlikte çalışır.
- **Sayısal istatistik satırı:** sayısal algılanan sütunlar için
  toplam/ortalama/min/maks görünür tabloda alt bilgi olarak; sayısal
  sıralama artık değer tipine göre yapılır.
- **Çoklu sıralama:** Shift+tık ile ikincil sıralama sütunları.
- **Sütun görünürlüğü:** sütun başlığı menüsünden gizle/göster; görünüm
  seçimi oturum boyunca korunur.

**Kabul ölçütleri:** jsdom testleri filtre birleşimini, istatistik doğruluğunu,
çoklu sıralama önceliğini ve gizli sütunların CSV kopyasına dahil edilmediğini
doğrular.

---

## Ö6 — Gerçek XLSX dışa aktarma + panoya zengin tablo

**Mevcut:** Excel çıktısı SpreadsheetML `.xls` uzantısıyla; panoya yalnızca
düz CSV metni.

**Gelişmiş hali:**

- **Gerçek `.xlsx`:** sıfır bağımlılıkla (mevcut `SimpleZip` + XML şablonları)
  çalışma kitabı üretilir; sayfa adı site haritası adı, sütun genişlikleri
  içerikten otomatik.
- `.xls` (SpreadsheetML) seçeneği geriye dönük uyumluluk için korunur.
- **Panoya zengin HTML tablosu:** tabloyu biçimli olarak kopyalar; elektronik
  tablolara doğrudan yapıştırılabilir.
- Dışa aktarma görünümünde biçim seçici: CSV / TSV / XLSX / XLS / JSON /
  NDJSON.

**Kabul ölçütleri:** üretilen xlsx baytlarının geçerli ZIP olduğunu ve
`xl/worksheets/sheet1.xml` + `[Content_Types].xml` belgelerini içerdiğini
doğrulayan testler; sütun başlıklarının hücrelerde korunduğu assert edilir.

---

## Ö7 — Galeri indirme yöneticisi

**Mevcut:** ZIP dışa aktarma tüm görselleri sessizce sırayla indirer; başarısız
olanlar sessizce atlanır.

**Gelişmiş hali:**

- İndirme kuyruğu: tek tek indirme, ilerleme çubuğu (tamamlanan/toplam),
  başarısız listesi ve "Başarısızları yeniden dene" düğmesi.
- Dosya adı çakışmalarında otomatik numaralandırma.
- ZIP akışı yine de tek tıkla; bireysel indirme seçeneği kalır.

**Kabul ölçütleri:** indirme yöneticisinin kuyruk/durum hesaplarını ve isim
çakışması numaralandırmasını test eden birim testleri (ağ çağrıları mock'lanır).

---

## Ö8 — Site haritası şablonları

**Mevcut:** Her site haritası sıfırdan kurulur.

**Gelişmiş hali:**

- Yerleşik, tamamen yerel şablon kütüphanesi: "Ürün listesi", "Tablo",
  "Sayfalanmış liste", "Görsel galerisi", "Bağlantı + alt sayfa".
- "Site haritası oluştur" iletişiminde şablon seçimi; seçilen şablon uygun
  seçici iskeletini doldurur, kullanıcı sadece seçicileri seçer.
- Kendi site haritasını "Şablon olarak kaydet" (yerel depoda saklanır).

**Kabul ölçütleri:** şablon listesinin geldiği, seçilen şablonun doğru seçici
iskeletini ürettiği ve kullanıcı şablonunun kaydedilip listelendiği testler.

---

## Ö9 — Klavye kısayolları ve yardım diyaloğu

**Mevcut:** Kısayollar dağınık ve belgelenmemiş (yalnızca picker içinde
P/C/Esc).

**Gelişmiş hali:**

- Global kısayollar: `Ctrl+Alt+N` yeni site haritası, `Ctrl+Alt+S` kazımayı
  başlat/duraklat, `Ctrl+Alt+D` veri görünümü, `Ctrl+Alt+G` grafik, `?`
  yardım diyaloğu.
- Yardar diyaloğu: tüm kısayolların tablosu, aç/kapa erişilebilir.
- Picker kısayolları (P/C/Enter/Esc) yardımda listelenir.

**Kabul ölçütleri:** jsdom testleri kısayol tetiklemesinin doğru görünüm
değişimini yaptığını ve yardım diyaloğunun açılıp kapanabildiğini doğrular.

---

## Ö10 — Geri al/Yinele + webscraper.io içe aktarma uyumluluğu

**Mevcut:** Yanlışlıkla silinen bir seçici geri getirilemez; içe aktarma
yalnızca kendi biçimimizi okur.

**Gelişmiş hali:**

- **Geri al/Yinele:** seçici ekleme/düzenleme/silme/sürükle-bırak işlemleri
  için snapshot yığını; `Ctrl+Z` / `Ctrl+Y` (ve yardım diyaloğunda liste).
- **webscraper.io uyumluluğu:** içe aktarma, webscraper.io sitemap JSON
  alanlarını (`_id`, `startUrl`, `selectors[].parentSelectors`, `regex`,
  `clickElementUniquenessType`, `tableDataRowSelector`, ...) tanır ve
  bilinmeyen alanları güvenle yoksayar; eksik alanlar varsayılanlara
  tamamlanır.
- Uyumsuz kayıt kullanıcıya satır satır raporlanır (mevcut kısmi içe aktarma
  akışıyla).

**Kabul ölçütleri:** webscraper.io biçiminde gerçek bir sitemap örneğinin
içe aktarılıp doğrulandığı; geri alma yığınınun ekleme→silme→geri al
döngüsünü doğru yaptığı testler.

---

## Uygulama sırası ve test disiplini

1. Ö1 → tam test paketi çalıştır, hataları düzelt
2. Ö2 → tam test paketi
3. Ö3 → tam test paketi
4. Ö4 → tam test paketi
5. Ö5 → tam test paketi
6. Ö6 → tam test paketi
7. Ö7 → tam test paketi
8. Ö8 → tam test paketi
9. Ö9 → tam test paketi
10. Ö10 → tam test paketi + `npm run build:tor` + `npm run check:tor`
    (`tor/` derlemesinin chrome-edge kaynağıyla birebir güncel olduğunu
    doğrular)

Her adımdan sonra: `npm test` (tümü yeşil olmalı), `node tools/build_tor.js`,
`node tools/build_panel.js`.

## İlerleme durumu

- [x] Ö1 Metin dönüşümleri + varsayılan değer
- [x] Ö2 Gölge DOM desteği
- [ ] Ö3 Yeniden deneme / maksimum derinlik / URL desenleri
- [ ] Ö4 Artımlı kazıma (append/merge/replace)
- [ ] Ö5 Sütun filtreleri, istatistikler, çoklu sıralama, sütun görünürlüğü
- [ ] Ö6 Gerçek XLSX + panoya zengin tablo
- [ ] Ö7 Galeri indirme yöneticisi
- [ ] Ö8 Site haritası şablonları
- [ ] Ö9 Klavye kısayolları + yardım diyaloğu
- [ ] Ö10 Geri al/Yinele + webscraper.io uyumluluğu
