# MASTER AI CODING AGENT PROMPT

## Chrome / Edge için Profesyonel Web Scraper + Crawler + Content & Media Intelligence Extension

Sen kıdemli bir Chrome/Edge Extension Architect, Web Scraping Engineer, Front-End Engineer, UX Engineer, Browser Automation Engineer, Performance Engineer ve QA Automation Engineer olarak hareket edeceksin.

Görevin; Chrome ve Chromium tabanlı Microsoft Edge üzerinde çalışan, Manifest V3 kullanan, son derece hızlı, kullanıcı dostu, modüler, sürdürülebilir ve production-quality bir **Web Scraper + Crawler + Content Discovery + Media Gallery + Data Extraction Extension** geliştirmek.

Bu proje basit bir HTML scraper değildir.

Hedef ürün; profesyonel web scraping, crawling, selector generation, content discovery, image/media extraction, gallery management, dataset extraction ve local data management özelliklerini tek bir extension içinde birleştiren gelişmiş bir araçtır.

---

# 0. KESİN ÜRÜN KURALLARI

1. Zamanlanmış görevler olmayacak.
2. Scheduler olmayacak.
3. Cron olmayacak.
4. Periodic scraping olmayacak.
5. Background automatic crawling olmayacak.
6. Kullanıcı bir web sayfasına girdiğinde extension otomatik tarama yapmayacak.
7. Sayfa açıldığı anda DOM'u otomatik indekslemeyecek.
8. Kullanıcı herhangi bir işlem başlatmadığı sürece scraping yapılmayacak.
9. Kullanıcı istediğinde tarama başlatacak.
10. Kullanıcı istediğinde crawl başlatacak.
11. Kullanıcı istediğinde deep scan başlatacak.
12. Kullanıcı istediğinde resource discovery başlatacak.
13. Uzun işlemler cancel edilebilir olacak.
14. Partial sonuçlar korunacak.
15. Tarama sonuçları extension içerisinde indirimsiz görüntülenebilecek.
16. Kullanıcı sonuçları silebilecek.
17. Kullanıcı sonuçları düzenleyebilecek.
18. Kullanıcı tag/favorite/archive işlemleri yapabilecek.
19. Görseller profesyonel bir gallery/media manager içerisinde yönetilecek.
20. Slideshow basit slider olmayacak.
21. Popup ve SidePanel kullanım modu Settings üzerinden değiştirilebilecek.
22. HTML + CSS + Vanilla JavaScript kullanılacak.
23. React/Vue/Angular/Svelte kullanılmayacak.
24. Vite kullanılmayacak.
25. Zorunlu bundler kullanılmayacak.
26. Runtime CDN JavaScript kullanılmayacak.
27. Harici AI kullanılmayacak.
28. Lokal AI kullanılmayacak.
29. Ollama kullanılmayacak.
30. LM Studio kullanılmayacak.
31. AI API kullanılmayacak.
32. API key istenmeyecek.
33. Machine learning model kurulumu istenmeyecek.
34. Tüm içerik analizi deterministik, heuristic ve DOM tabanlı sistemlerle yapılacak.

---

# 1. TEMEL TEKNİK MİMARİ

Manifest V3 kullan.

Ana yapı:

```text
extension/
├── manifest.json
├── service-worker.js
├── popup/
├── sidepanel/
├── options/
├── dashboard/
├── gallery/
├── content/
├── crawler/
├── extractor/
├── selectors/
├── parser/
├── media/
├── datasets/
├── storage/
├── export/
├── history/
├── collections/
├── components/
├── utils/
├── vendor/
├── tests/
├── fixtures/
└── docs/
```

Mimari modüler olmalı.

Her ana sistem bağımsız test edilebilir olmalı.

---

# 2. UI MODE

Kullanıcı Settings üzerinden:

```text
UI Mode

○ Popup
○ SidePanel
```

seçebilecek.

## Popup

Hızlı işlemler:

* Scan Current Page
* Deep Scan
* Extract Selection
* Open Gallery
* Open Dashboard
* Stop Current Task

## SidePanel

Ana çalışma alanı olarak kullanılacak.

Sekmeler:

* Overview
* Text
* Links
* Images
* Media
* Pages
* Tables
* Data
* Selectors
* Crawl
* Gallery
* History
* Export
* Settings

---

# 3. OTOMATİK TARAMA YOK

Extension sayfa açıldığında:

* scraping yapmayacak,
* tüm linkleri çıkarmayacak,
* tüm görselleri toplamaya başlamayacak,
* CSS parsing yapmayacak,
* iframe taramayacak,
* crawler başlatmayacak,
* resource discovery başlatmayacak.

Extension yalnızca kullanıcı işlemi başlattığında çalışacak.

Başlatma yöntemleri:

* Popup
* SidePanel
* Toolbar
* Context Menu
* Keyboard Shortcut
* Selected Element
* Selected Text
* Selected Link
* Selected Image
* Selected Table

---

# 4. CURRENT PAGE SCAN

Kullanıcı "Scan Current Page" dediğinde:

* title
* headings
* paragraphs
* lists
* tables
* links
* images
* video
* audio
* iframe
* embeds
* SVG
* metadata
* OpenGraph
* Twitter Cards
* JSON-LD
* schema.org
* microdata
* RDFa
* data attributes
* forms
* buttons
* navigation
* breadcrumbs

keşfedilecek.

---

# 5. TEXT ENGINE

Text extraction:

* visible text
* innerText
* textContent
* cleaned text
* article text
* heading text
* paragraph text
* caption
* button text
* label
* breadcrumbs
* selected text

Text cleaning:

* trim
* normalize whitespace
* duplicate removal
* HTML removal
* entity decode

Metin blokları source element ile ilişkilendirilmeli.

---

# 6. LINK ENGINE

Her link için:

* absolute URL
* relative URL
* anchor text
* title
* rel
* target
* download
* domain
* subdomain
* pathname
* query
* hash
* external/internal
* same-origin
* file extension
* inferred type

classification:

* navigation
* article
* product
* category
* document
* image
* media
* pagination
* next
* previous
* external
* download

Filtre:

* same domain
* same subdomain
* external
* exclude domain
* URL regex
* text regex
* extension
* path
* query

---

# 7. IMAGE DISCOVERY ENGINE

Görsel keşfi çok kapsamlı olacak.

Ara:

* img src
* srcset
* picture
* source
* data-src
* data-srcset
* data-original
* data-lazy-src
* lazy attributes
* background-image
* CSS background
* inline style URL
* SVG
* poster
* OpenGraph image
* Twitter image
* image links
* iframe images mümkünse
* page source image URLs
* JSON embedded image URLs

`srcset` içerisinden en yüksek çözünürlükteki adayı belirle.

Thumbnail/original ilişkilerini heuristic olarak algıla.

---

# 8. IMAGE METADATA

Her image:

```text
id
url
originalUrl
pageUrl
sourcePage
position
width
height
aspectRatio
mimeType
extension
fileSize
alt
title
filename
domain
sourceType
lazyLoaded
duplicate
hash
perceptualHash
createdAt
updatedAt
tags
favorite
selected
hidden
status
```

alanlarına sahip olabilir.

---

# 9. GALLERY / MEDIA MANAGER

Gallery basit slideshow olmayacak.

Görünüm:

* Grid
* Masonry
* Large Grid
* List
* Compact
* Filmstrip
* Fullscreen
* Compare
* Slideshow
* Contact Sheet

Destek:

* single select
* multi-select
* shift select
* ctrl/cmd select
* select all
* invert selection

---

# 10. IMAGE VIEWER

Viewer:

* fullscreen
* zoom
* pan
* rotate
* flip
* fit
* actual size
* previous
* next
* keyboard navigation
* mouse wheel
* slideshow
* metadata
* source page
* source URL
* copy URL
* rename
* favorite
* tag
* delete
* open source
* download

Compare:

* side-by-side
* overlay
* synchronized zoom
* synchronized pan

---

# 11. İNDİRMEDEN ÖNİZLEME

Çekilmiş içerikler kullanıcı tarafından download edilmeden extension içerisinde görüntülenebilecek.

Image preview:

* remote URL
* thumbnail
* metadata

üzerinden çalışmalı.

Full-size resource yalnızca viewer gerektiğinde yüklenmeli.

Download işlemi sadece kullanıcı tarafından başlatıldığında yapılmalı.

Persistent cache zorunlu olmayacak.

---

# 12. IMAGE OPERATIONS

Toplu işlemler:

* favorite
* tag
* rename
* delete
* restore
* hide
* reveal
* copy URL
* copy source URL
* open source
* export metadata
* download selected
* ZIP
* deduplicate

Delete işlemi web sitesindeki dosyayı silmeye çalışmayacak.

Delete yalnızca extension collection'ından kaldırma anlamına gelecek.

---

# 13. DUPLICATE DETECTION

Duplicate sistemi:

1. normalized URL
2. filename
3. source relation
4. content hash
5. perceptual hash

üzerinden çalışacak.

Duplicate grupları:

```text
Group
 ├── Original
 ├── Duplicate
 └── Duplicate
```

şeklinde gösterilecek.

Kullanıcı preferred asset seçebilecek.

---

# 14. MEDIA ENGINE

Image dışında:

* video
* audio
* poster
* source
* embed
* iframe
* object
* document resources

keşfedilecek.

Media Center:

* Images
* Videos
* Audio
* Documents
* Other

şeklinde ayrılacak.

---

# 15. DEEP SCAN

Kullanıcı manuel olarak:

`Deep Scan`

başlatabilecek.

Deep Scan:

* linked pages
* images
* media
* iframe
* CSS resources
* background images

keşfedebilir.

Varsayılan depth düşük tutulmalı.

Hard limits:

* max pages
* max depth
* max assets
* max bytes
* max runtime
* max concurrency

olmalı.

---

# 16. PAGE CRAWLER

Crawler modları:

### Current Page

Tek sayfa.

### Linked Pages

Sayfadaki linkleri tara.

### Site Crawl

Aynı domain içinde ilerle.

### URL List

Kullanıcının girdiği URL'leri tara.

### Selector Crawl

Seçilen elementlerin linklerini takip et.

### Pagination Crawl

Pagination algıla.

### Next Button Crawl

Next düğmelerini takip et.

### Infinite Scroll Crawl

Kullanıcı başlatırsa controlled scroll uygula.

### Recursive Crawl

Depth bazlı crawl.

---

# 17. CRAWL RULES

Kullanıcı ayarlayabilir:

* max pages
* max depth
* concurrency
* timeout
* retry
* allowed domains
* blocked domains
* URL include regex
* URL exclude regex
* same-origin
* same-domain
* external links
* follow pagination
* follow canonical
* follow iframe
* load lazy content
* controlled scroll

Crawl delay yalnızca aktif crawler throttle değeridir.

Scheduler değildir.

---

# 18. CRAWL FRONTIER

Queue state:

```text
DISCOVERED
QUEUED
OPENED
SCANNED
EXTRACTED
FAILED
SKIPPED
CANCELLED
```

Visited tracking normalized URL üzerinden yapılmalı.

---

# 19. LOOP PROTECTION

Önle:

* cyclic URLs
* duplicate URLs
* tracking query variations
* duplicate pagination
* infinite scroll loops
* repeated content pages

Page content signature kullanılabilir.

---

# 20. DYNAMIC PAGE SUPPORT

Kullanıcı scan başlattığında:

* DOM stabilization
* MutationObserver
* controlled wait
* lazy-loading
* infinite scroll
* load more buttons

kullanılabilir.

SPA:

* React
* Vue
* Angular
* Next.js
* Nuxt

gibi sitelerde DOM son haline ulaşana kadar kontrollü bekleme sistemi oluştur.

Ancak kullanıcı tarama başlatmadan bunların hiçbiri çalışmayacak.

---

# 21. SELECTOR BUILDER

Kullanıcı sayfada element seçebilecek.

Destek:

* hover highlight
* click select
* multi-select
* similar elements

Üretebil:

* CSS selector
* robust CSS selector
* XPath
* text selector
* attribute selector
* class selector
* id selector
* structural selector

Selector kalite analizi:

* unique
* stable
* repeated
* brittle

ve confidence göstergesi.

---

# 22. VISUAL ELEMENT DISCOVERY

Kullanıcı bir element seçtiğinde:

* sibling analysis
* parent analysis
* child pattern
* repeated structure
* DOM similarity

yap.

"Find Similar Elements" özelliği ekle.

Örnek:

Kullanıcı bir product card'a tıklarsa sistem:

```text
Found 48 similar elements
```

göstermeli.

---

# 23. REPEATED BLOCK DETECTION

Heuristic engine ile:

* product cards
* article cards
* search results
* profiles
* listings
* menus
* repeated sections

tespit edilebilmeli.

DOM similarity algoritmaları kullan.

AI kullanma.

---

# 24. TABLE EXTRACTION

Destek:

* HTML table
* nested table
* ARIA grid
* div-based table
* repeated row structure

Table viewer:

* search
* filter
* sort
* edit
* select rows
* delete rows

Export:

* CSV
* TSV
* JSON

XLSX kullanımı gerekliyse lokal library kullan.

---

# 25. LIST EXTRACTION

Otomatik tekrar eden yapıları bul.

Örnek:

```text
Product
 ├── title
 ├── price
 ├── image
 └── url
```

Bu yapı CSS/DOM heuristics ile çıkarılmalı.

---

# 26. ATTRIBUTE EXTRACTION

Destek:

* href
* src
* srcset
* alt
* title
* aria-label
* class
* id
* name
* value
* style
* data-*
* custom attributes

---

# 27. REGEX EXTRACTION

Kullanıcı kendi regex'ini çalıştırabilsin:

* email
* phone
* price
* SKU
* ID
* date
* URL
* hashtags
* custom patterns

Regex preview:

* matches
* sample
* count

---

# 28. DATA CLEANING

Transformation pipeline:

* trim
* whitespace normalization
* remove HTML
* lowercase
* uppercase
* title case
* replace
* regex replace
* split
* join
* number parsing
* currency parsing
* date parsing
* URL parsing
* JSON parsing
* deduplication

---

# 29. STRUCTURED DATA ENGINE

Keşfet:

* JSON-LD
* Schema.org
* Product
* Article
* NewsArticle
* Person
* Organization
* BreadcrumbList
* FAQPage
* Event
* Recipe
* VideoObject
* ImageObject

Structured Data paneli oluştur.

---

# 30. PAGE INTELLIGENCE

AI yerine heuristic page classification kullan.

Örneğin:

```text
Page Type:
Product Listing

Words:
8,421

Images:
42

Links:
126

Tables:
2

Structured Data:
3
```

Page type inference:

* article
* product
* listing
* search
* category
* documentation
* forum
* profile
* landing page

gibi heuristic kurallarla belirlenebilir.

---

# 31. PAGE COLLECTION

Her sayfa:

```text
id
url
canonical
title
domain
timestamp
text
metadata
links
images
media
crawlDepth
parentPage
status
tags
notes
favorite
```

bilgileriyle saklanmalı.

---

# 32. CONTENT EDITOR

Çekilen veriler düzenlenebilir.

Görünümler:

* plain text
* cleaned text
* HTML
* JSON

Original / Edited ayrımı göster.

---

# 33. LINK MANAGER

Features:

* search
* sort
* filters
* copy
* open
* tag
* favorite
* export
* visited
* ignored

Broken link detection isteğe bağlı manuel işlem olacak.

---

# 34. PAGE GRAPH

Graph:

* page nodes
* link edges

Destek:

* zoom
* pan
* search
* inspect
* depth highlighting

---

# 35. CRAWL TREE

Örnek:

```text
Home
 ├── Category
 │    ├── Product 1
 │    ├── Product 2
 │    └── Product 3
 └── Article
```

---

# 36. HISTORY

Geçmiş:

* scans
* crawls
* extraction
* export
* delete
* edit
* bulk actions

tutulsun.

History'den:

* inspect
* restore
* rerun manually

yapılabilir.

Otomatik rerun yoktur.

---

# 37. UNDO / REDO

Destek:

* delete
* tag
* rename
* edit
* bulk operations

---

# 38. TRASH

Silinen:

* pages
* images
* links
* rows

Trash'e gider.

İşlemler:

* restore
* permanent delete
* empty trash

---

# 39. GLOBAL SEARCH

Ara:

* URL
* title
* text
* image alt
* filename
* tags
* metadata
* extracted fields

Destek:

* exact
* fuzzy
* regex

---

# 40. TAGS

Custom tags.

Bulk tagging desteklenmeli.

---

# 41. FAVORITES

Favorite:

* pages
* images
* links
* datasets

---

# 42. EXPORT SYSTEM

Destek:

* JSON
* CSV
* TSV
* HTML
* Markdown
* TXT

Uygunsa:

* XLSX

Image:

* selected URLs
* metadata
* download selected
* ZIP

Page:

* HTML
* cleaned HTML
* Markdown
* JSON

---

# 43. IMPORT

Destek:

* URL list
* JSON
* CSV
* exported project

---

# 44. PROJECT EXPORT / IMPORT

Kullanıcı:

* collections
* tags
* recipes
* selectors
* datasets
* metadata
* settings

export/import yapabilsin.

Binary media varsayılan olarak JSON içine gömülmeyecek.

---

# 45. RECIPE SYSTEM

Kullanıcı extraction recipe oluşturabilsin.

Recipe:

```text
name
domain
selectors
fields
cleaning
crawl rules
filters
```

Recipe yalnızca manuel çalıştırılacak.

Scheduler olmayacak.

---

# 46. DOWNLOAD MANAGER

Download yalnızca kullanıcı başlatır.

Queue:

* pending
* downloading
* success
* failed
* skipped

Features:

* retry failed
* filename template
* conflict strategy

---

# 47. CONTEXT MENU

Right-click:

Page:

* Scan Page
* Deep Scan
* Add to Collection

Link:

* Scrape Linked Page
* Add URL

Image:

* Inspect Image
* Add Image
* Open Source

Selection:

* Extract Selection
* Create Selector

Table:

* Extract Table

---

# 48. KEYBOARD SHORTCUTS

Destek:

* Open extension
* Open SidePanel
* Scan current page
* Stop scan
* Open Gallery
* Capture selection

---

# 49. SCAN STATE MACHINE

```text
IDLE
PREPARING
SCANNING
EXTRACTING
NORMALIZING
DEDUPING
INDEXING
COMPLETED
CANCELLED
FAILED
```

---

# 50. CANCELLATION

Uzun işlem her zaman stop edilebilir.

Partial results kaydedilmeli.

---

# 51. ERROR MANAGEMENT

Destek:

* permission denied
* unsupported URL
* iframe inaccessible
* timeout
* network error
* malformed HTML
* invalid selector
* extension context invalidated

Hata kullanıcı dostu gösterilmeli.

---

# 52. PERMISSIONS

Gereksiz permission isteme.

Mümkün olduğunca:

* activeTab
* scripting
* storage
* sidePanel
* contextMenus
* downloads

gibi ihtiyaç duyulan API'leri kullan.

Daha geniş erişim gerçekten gerektiğinde optional host permissions tercih et.

Permission explanation ekranı oluştur.

---

# 53. SECURITY

Yapma:

* credential extraction
* password harvesting
* cookie dumping
* hidden tracking
* remote code execution
* unsafe eval
* arbitrary script injection
* CDN'den runtime code

Güvenilmeyen HTML sanitize edilmeli.

`javascript:` URL'leri güvenli şekilde ele alınmalı.

SVG/HTML içeriği güvenli render edilmeli.

---

# 54. LOCAL DATABASE

IndexedDB tercih et.

Stores:

```text
pages
images
media
links
datasets
rows
collections
tags
recipes
selectors
crawlNodes
history
trash
settings
cache
```

Versioned migration sistemi oluştur.

---

# 55. PERFORMANCE

10.000+ record dataset performanslı çalışmalı.

Uygula:

* lazy rendering
* virtual list
* batch writes
* indexed queries
* debounced search
* lazy images
* IntersectionObserver
* chunk processing
* concurrency limits
* worker gerekliyse Web Worker

Tüm dataset'i aynı anda DOM'a yükleme.

---

# 56. MEMORY MANAGEMENT

Özellikle Gallery:

* thumbnails
* lazy loading
* full image only when opened
* object URL cleanup
* cache eviction
* memory pressure protection

kullanmalı.

---

# 57. TAB MANAGEMENT

Crawler temporary tab açıyorsa:

* tracking
* cleanup
* orphan cleanup

yap.

Kullanıcının mevcut tab'larını kapatma.

---

# 58. URL NORMALIZATION

Normalize:

* hash
* trailing slash
* default port
* duplicated slash
* tracking params
* encoding

Kullanıcı isterse query parametrelerini koruyabilmeli.

---

# 59. TRACKING PARAM FILTER

Default örnekleri:

```text
utm_*
fbclid
gclid
ref
source
```

Custom pattern desteği ekle.

---

# 60. HARD LIMITS

Her crawler:

* max pages
* max depth
* max images
* max assets
* max bytes
* max runtime
* max concurrent tabs

ile korunmalı.

---

# 61. BROWSER COMPATIBILITY

Öncelik:

* Google Chrome
* Microsoft Edge

Browser adapter oluştur.

Chromium API farklarını abstraction ile yönet.

---

# 62. SERVICE WORKER

Service worker'ın kalıcı olmayacağını varsay.

Durum:

* IndexedDB
* chrome.storage
* persistent task state

üzerinden tutulmalı.

Restart sonrası mümkün olduğunca toparlanabilmeli.

---

# 63. TEST ENVIRONMENT

Eksik test araçlarını Agent kendisi kurmalı.

Gerektiğinde:

* Node.js
* npm
* Playwright
* Chromium
* Edge
* yardımcı npm packages

kurulabilir.

---

# 64. TEST FIXTURES

Local fixture server oluştur.

Sayfalar:

* Basic
* Table
* Product List
* Pagination
* Infinite Scroll
* Lazy Loading
* iframe
* CSS Background
* srcset
* Duplicate Images
* Malformed HTML
* Large Page
* SPA
* Error Page

---

# 65. UNIT TEST

Test:

* URL normalization
* link parser
* image parser
* srcset parser
* CSS extraction
* duplicate detection
* selector generation
* selector scoring
* table extraction
* list extraction
* regex
* text cleaning
* data transformation
* crawl rules
* database
* migration

---

# 66. INTEGRATION TEST

Test:

* popup
* sidepanel
* content script
* service worker
* messaging
* IndexedDB
* permissions
* context menus
* downloads

---

# 67. E2E TEST

Gerçek browser ile test et:

* extension loading
* current scan
* deep scan
* images
* links
* media
* tables
* selector
* crawl
* pagination
* infinite scroll
* gallery
* viewer
* slideshow
* delete
* restore
* tags
* favorites
* export
* import
* history
* recipes
* settings
* popup/sidepanel switch

---

# 68. PERFORMANCE TEST

En az:

* 1,000 image
* 10,000 links
* 10,000 records
* large DOM
* large crawl

test et.

UI freeze olmamalı.

---

# 69. SECURITY TEST

Kontrol et:

* XSS payload
* malicious HTML
* malicious SVG
* javascript URLs
* data URLs
* malformed JSON
* huge payload
* long URLs
* unsafe regex patterns

---

# 70. ACCESSIBILITY

Kontrol et:

* keyboard navigation
* focus
* ARIA
* dialog accessibility
* visible focus
* contrast
* screen reader semantics

---

# 71. DOCUMENTATION

Oluştur:

```text
README.md
ARCHITECTURE.md
DEVELOPMENT.md
TESTING.md
PERMISSIONS.md
TROUBLESHOOTING.md
LIMITATIONS.md
```

---

# 72. NO BUILD PIPELINE

Extension doğrudan source ile çalışabilmeli.

Temel kurulum:

```bash
npm install
```

Test:

```bash
npm test
```

ve gerekiyorsa:

```bash
npm run test:e2e
```

Production extension dosyaları doğrudan Chrome/Edge Developer Mode üzerinden yüklenebilmeli.

---

# 73. FEATURE FLAGS

Gerekirse:

* deep crawl
* resource discovery
* perceptual hashing
* graph
* advanced lazy loading

feature flag olarak geliştirilebilir.

Production'da yarım özellik gösterme.

---

# 74. EMPTY STATES

Her boş ekran:

* ne gösteriyor,
* neden boş,
* kullanıcı ne yapmalı

bilgisini göstermeli.

---

# 75. LOADING STATES

Uzun işlemlerde:

* progress
* percentage mümkünse
* current operation
* item count
* cancel

göster.

---

# 76. BULK OPERATIONS

Pages:

* select all
* delete
* tag
* favorite
* export

Images:

* select all
* download
* ZIP
* tag
* delete
* favorite

Links:

* select all
* copy
* export
* delete

Rows:

* select
* edit
* delete
* export

---

# 77. SOURCE RELATIONSHIPS

Her extracted entity mümkün olduğunca source ile ilişkilendirilmeli.

Örneğin:

```text
Image
 └── Source Page
       └── Source Element
```

Dataset row:

```text
Dataset Row
 └── Source Page
```

---

# 78. PAGE GRAPH + SOURCE GRAPH

Page → Page

Image → Page

Resource → Page

Dataset Row → Page

ilişkilerini takip et.

---

# 79. PREVIEW-FIRST UX

Gelişmiş extraction ve crawl işlemlerinde önce preview göster.

Örneğin:

```text
Found 128 candidate items

[Preview]
[Edit Rules]
[Start Extraction]
[Cancel]
```

---

# 80. CRAWL PREVIEW

Başlamadan:

```text
Estimated pages
Current depth
Potential images
Potential links
Domain
Rules
Limits
```

göster.

---

# 81. RECOVERY

Browser kapanması:

* tamamlanan veriler korunmalı,
* partial results korunmalı,
* failed nodes işaretlenmeli.

---

# 82. FINAL UX HEDEFİ

Kullanıcı:

1. Sayfaya girer.
2. Hiçbir otomatik tarama gerçekleşmez.
3. Extension'ı açar.
4. `Scan Current Page` seçer.
5. Text / Links / Images / Media / Tables görünür.
6. Images sekmesinden Gallery açar.
7. Görselleri indirime gerek olmadan inceler.
8. İstediğini seçer.
9. İstediğini siler.
10. İstediğini favoriler.
11. İstediğini tag'ler.
12. İstediğini düzenler.
13. İstediğini export eder.
14. İsterse Deep Crawl başlatır.
15. Crawler ilerler.
16. Kullanıcı istediği anda Stop der.
17. Partial results korunur.
18. History üzerinden sonucu tekrar inceler.
19. Recipe'i kaydeder.
20. Recipe'i daha sonra manuel çalıştırabilir.

---

# 83. KESİN OLARAK OLMAYACAK ÖZELLİKLER

Aşağıdakileri hiçbir fazda ekleme:

* AI
* AI Provider
* Local AI
* Ollama
* LM Studio
* OpenAI
* Gemini
* Anthropic
* API Key
* AI extraction
* AI page analysis
* AI image analysis
* Scheduled Tasks
* Cron
* Scheduled Crawl
* Automatic Crawl
* Automatic Page Scan
* Background Monitoring
* Periodic Polling

---

# 84. FAZLAR

## FAZ 1 — Extension Foundation

* Manifest V3
* popup
* sidepanel
* options
* dashboard
* service worker
* browser adapter
* IndexedDB
* settings
* theme
* messaging
* error handling
* test infrastructure

**FAZ 1 BİTTİĞİNDE ONAY BEKLEME, TESTLERİ ÇALIŞTIR VE FAZ 2'YE GEÇ.**

---

## FAZ 2 — Current Page Scraper

* DOM parser
* text
* links
* images
* media
* metadata
* iframe
* structured data
* scan state
* cancel
* errors

**FAZ 2 BİTTİĞİNDE ONAY BEKLEME, TESTLERİ ÇALIŞTIR VE FAZ 3'E GEÇ.**

---

## FAZ 3 — Media + Gallery

* image intelligence
* srcset
* lazy images
* CSS images
* original discovery
* metadata
* duplicate detection
* gallery
* viewer
* slideshow
* compare
* tagging
* favorites
* delete
* trash
* restore

**FAZ 3 BİTTİĞİNDE ONAY BEKLEME, TESTLERİ ÇALIŞTIR VE FAZ 4'E GEÇ.**

---

## FAZ 4 — Selector + Extraction

* visual selector
* CSS
* XPath
* similarity
* repeated blocks
* tables
* lists
* attributes
* regex
* transformations

**FAZ 4 BİTTİĞİNDE ONAY BEKLEME, TESTLERİ ÇALIŞTIR VE FAZ 5'E GEÇ.**

---

## FAZ 5 — Crawler

* linked pages
* pagination
* next button
* deep crawl
* crawl frontier
* rules
* limits
* concurrency
* tree
* graph
* stop
* recovery

**FAZ 5 BİTTİĞİNDE ONAY BEKLEME, TESTLERİ ÇALIŞTIR VE FAZ 6'YA GEÇ.**

---

## FAZ 6 — Dynamic Content

* lazy loading
* infinite scroll
* load more
* DOM stabilization
* SPA handling
* dynamic content waiting

**FAZ 6 BİTTİĞİNDE ONAY BEKLEME, TESTLERİ ÇALIŞTIR VE FAZ 7'YE GEÇ.**

---

## FAZ 7 — Dataset + Recipe + Export

* datasets
* schema
* rows
* edit
* recipes
* profiles
* CSV
* JSON
* TSV
* HTML
* Markdown
* ZIP
* downloads
* import/export projects

**FAZ 7 BİTTİĞİNDE ONAY BEKLEME, TESTLERİ ÇALIŞTIR VE FAZ 8'E GEÇ.**

---

## FAZ 8 — Dashboard + Collections

* collections
* tags
* favorites
* search
* global search
* history
* trash
* activity
* bulk actions
* keyboard shortcuts
* context menus

**FAZ 8 BİTTİĞİNDE ONAY BEKLEME, TESTLERİ ÇALIŞTIR VE FAZ 9'A GEÇ.**

---

## FAZ 9 — Advanced Resource Discovery

* resource inventory
* CSS resources
* background resources
* available network/resource information
* resource filters
* resource graph

Bu özellik yalnızca kullanıcı manuel olarak başlattığında çalışacak.

**FAZ 9 BİTTİĞİNDE ONAY BEKLEME, TESTLERİ ÇALIŞTIR VE FAZ 10'A GEÇ.**

---

## FAZ 10 — Performance / Security / Hardening

* memory optimization
* large datasets
* large galleries
* service worker recovery
* database optimization
* XSS protection
* unsafe URL handling
* error recovery
* race conditions
* browser compatibility

**FAZ 10 BİTTİĞİNDE ONAY BEKLEME, TESTLERİ ÇALIŞTIR VE FAZ 11'E GEÇ.**

---

## FAZ 11 — Full QA

Chrome ve Edge üzerinde:

* unit tests
* integration tests
* E2E tests
* performance tests
* security tests
* accessibility tests
* fixture tests
* regression tests

çalıştır.

Bulduğun bütün kritik ve yüksek öncelikli hataları düzelt.

**FAZ 11 BİTTİĞİNDE ONAY BEKLEME, TESTLERİ ÇALIŞTIR VE FAZ 12'YE GEÇ.**

---

## FAZ 12 — Release Candidate

Son kontrol:

* extension install
* popup
* sidepanel
* current scan
* gallery
* slideshow
* viewer
* delete/restore
* selectors
* tables
* crawler
* pagination
* infinite scroll
* dataset
* export
* import
* recipe
* history
* permissions
* performance
* security
* Chrome
* Edge

Ardından:

* README güncelle
* installation docs güncelle
* permissions docs güncelle
* limitations docs güncelle
* final test report oluştur
* release candidate hazırla

**FAZ 12 BİTTİĞİNDE ONAY BEKLEME, TÜM TESTLERİ SON KEZ ÇALIŞTIR VE PROJEYİ RELEASE CANDIDATE DURUMUNA GETİR.**

---

# 85. AGENT DAVRANIŞI

* Gereksiz soru sorma.
* Küçük teknik kararları kendin ver.
* Eksik ayrıntıları mantıklı şekilde tamamla.
* Test etmeden çalışıyor deme.
* Bir test başarısızsa düzelt.
* Sonra regression testlerini tekrar çalıştır.
* Kullanıcıdan faz onayı bekleme.
* Her fazın sonunda bir sonraki faza otomatik geç.
* Yarım özellik bırakma.
* Kritik TODO bırakma.
* Console error bırakma.
* Unhandled Promise rejection bırakma.
* Memory leak bırakma.
* UI freeze bırakma.
* Kod tekrarını azalt.
* Browser kısıtlarını dürüstçe ele al.
* Mümkün olan yerde fallback geliştir.
* Chrome ve Edge uyumluluğunu sürekli kontrol et.

---

# SON KURAL

**BU PROJEDE HİÇBİR AI SİSTEMİ YOKTUR.**

Bütün intelligence:

* DOM analysis
* heuristic detection
* CSS/XPath selector engine
* structural similarity
* content parsing
* metadata extraction
* URL analysis
* image analysis
* duplicate detection
* rule-based classification
* deterministic data processing

üzerinden gerçekleştirilecektir.

**ZAMANLANMIŞ GÖREV YOK.**

**OTOMATİK SAYFA TARAMASI YOK.**

**KULLANICI TETİKLEMEDEN CRAWL YOK.**

**KULLANICI TETİKLEMEDEN RESOURCE DISCOVERY YOK.**

**KULLANICI TETİKLEMEDEN UZUN SÜRELİ İŞLEM YOK.**

Uzun işlemler:

* kullanıcı tarafından başlatılmalı,
* progress göstermeli,
* iptal edilebilmeli,
* partial result saklayabilmeli,
* hata sonrası toparlanabilmeli.

Ürün hızlı, yerel, güvenilir ve profesyonel bir scraping/data management aracı olarak tamamlanmalıdır.
