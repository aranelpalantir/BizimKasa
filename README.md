# 🪙 BizimKasa

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version: v1.2.0](https://img.shields.io/badge/Version-v1.2.0-blue.svg)](#)
[![PWA: Offline Ready](https://img.shields.io/badge/PWA-Offline%20Ready-00d2ff.svg?logo=pwa&logoColor=white)](#)
[![Cloudflare Pages](https://img.shields.io/badge/Deployed%20with-Cloudflare%20Pages-F38020.svg?logo=cloudflare)](https://bizimkasa.pages.dev/)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-bizimkasa.pages.dev-success.svg)](https://bizimkasa.pages.dev/)
[![GitHub Repository](https://img.shields.io/badge/GitHub-BizimKasa-181717.svg?logo=github&logoColor=white)](https://github.com/aranelpalantir/BizimKasa)
[![Mobile: iOS & Android](https://img.shields.io/badge/Mobile-iOS%20%7C%20Android-black.svg?logo=apple&logoColor=white)](#)
[![E2E Tests: 26 Passing](https://img.shields.io/badge/Playwright%20E2E-26%20Passing-success.svg?logo=playwright&logoColor=white)](#)
[![AI-Assisted](https://img.shields.io/badge/Developed%20with-AI%20Pair%20Programming-8A2BE2.svg)](#)

> *"Finansal verileriniz yalnızca size aittir — Sıfır sunucu bağımlılığı, tam veri gizliliği, sınırsız kontrol ve cebinizdeki yerel güç."*

**BizimKasa**, kişisel ve ortak bütçe yönetimi, nakit akışı matrisi, kredi kartı ekstreleri, fiziki ve banka altınları (gram & çeyrek), döviz birikimleri (EUR/USD), TEFAS yatırım fonları ve portföy kâr/zarar takibini tek bir modern çatı altında toplayan, **%100 Local-First** (yerel öncelikli) ve çevrimdışı (offline) çalışan ilerici bir web uygulamasıdır (**PWA**).

---

## 🌐 Canlı Kullanım (Web & Mobil)

Uygulamaya tarayıcınızdan veya telefonunuzdan doğrudan erişebilirsiniz:
- 🚀 **Cloudflare Pages (Canlı Uygulama):** **[https://bizimkasa.pages.dev/](https://bizimkasa.pages.dev/)**
- 🐙 **GitHub Repository:** **[https://github.com/aranelpalantir/BizimKasa](https://github.com/aranelpalantir/BizimKasa)**

*(iPhone Safari veya Android Chrome'da **"Ana Ekrana Ekle"** diyerek tam ekran, FaceID / TouchID / PIN kilit korumalı ve kapalı otoparkta veya uçak modunda bile anında açılan yerel mobil uygulama olarak kullanabilirsiniz.)*

---

## ✨ Öne Çıkan Özellikler

### 1. 📊 Dinamik Aylık Bütçe & Nakit Akışı Matrisi (Yıllık & Aylık Görünüm)
- **Çoklu Hesap / Portföy Hiyerarşisi:** Ana Hesap, Yatırım Portföyü, Tasarruf Fonu veya Ortak Kasa gibi dilediğiniz sayıda bağımsız hesap tanımlama.
- **Kartlar, Gelirler ve Giderler:** Her hesaba bağlı kredi kartları, maaş kalemleri, kira/faturalar ve dinamik nakit akışları.
- **Esnek Dönem Görünümü:** İster yakın döneme (geçen ay ve sonraki 3 ay) odaklanın, ister 12 aylık tam yıl tablosunu izleyin.
- **Konsolide Nakit Raporu:** Hesap bazında ve tüm kasaların toplamında birleşik Genel Gelir, Genel Gider ve Genel Kalan net nakit durumu.
- **Hızlı Hücre Düzenleme:** Herhangi bir hücreye dokunarak tutarı doğrudan yerinde güncelleme.
- **Dinamik Grup Filtresi:** Tek tıkla sadece ortak kasayı veya şahsi hesapları filtreleyebilme.

### 2. 🎨 Hesap Renk Temaları & Bütünsel Kişiselleştirme
- **18 Canlı Renk Paleti:** Her hesaba veya kasaya özgü 18 modern tema rengi (veya özel HEX kodu) belirleyebilme.
- **Hızlı Değiştirme:** Filtre çubuğundaki palet (`🎨`) ikonuyla veya Ayarlar menüsünden dilediğiniz an tek tıkla hesap temasını güncelleme.
- **Dinamik Ambiyans (Neon Glow):** Seçili hesabın rengine göre filtre çubuğunda neon glow ışıltısı, Dashboard'da dinamik net varlık kartı aurası ve bütçe matrisinde belirgin renk hiyerarşisi.

### 3. 🪙 Altın, Döviz & TEFAS Fon Portföyü
- **Altın (Gram & Çeyrek):** Ağırlıklı ortalama birim maliyet (`Ort. Brm. Mlyt.`), güncel piyasa değeri, net kâr/zarar (₺ ve %) ve çeyrek altın çeşitleri (Çeyrek, Yarım, Tam, Cumhuriyet).
- **Çok Yıllı Döviz Matrisi:** USD ve EUR birikimleri, yıllara yayılan nakit akışı, ortalama kur maliyeti ve anlık TL karşılığı.
- **1.875+ TEFAS Fon Kütüphanesi:** Türkiye'deki tüm açık ve kapalı TEFAS fonlarını içeren yerleşik sözlük (`tefasFunds.ts`), akıllı kod/isim araması ve anında otomatik tamamlama.
- **Maliyet Esaslı Hatasız Değerleme:** Fonların piyasa fiyatı kullanıcı tarafından girilene kadar kod içerisinden sahte fiyat dayatılmaz; değerleme motoru otomatik olarak alış maliyetini (`avgCost`) kullanarak sanal kâr/zarar oluşturmaz ve net varlığı tam korur.
- **Toplu Hareket Yönetimi & CSV İçe Aktarma:** Alım/satım işlemlerini onay kutularıyla çoklu seçip tek seferde silebilme (`bulkDelete`); geçmiş verileri CSV ve metin yapıştırarak içeri aktarma.

### 4. 🎯 Aylık Yatırım & Birikim Hedef Planlayıcısı (Target & Budget Planner)
- **Aylık Birikim Hedefleri:** Ay bazında altın, döviz, TEFAS fonu veya nakit tasarruf hedefleri belirleme.
- **Gerçekleşenlerle Otomatik Eşleştirme:** Kayıtlı varlık işlemlerini hedef kartlarına bağlama ve hedefin gerçekleşme yüzdesini canlı izleme.
- **🎉 Konfeti Kutlaması:** Ayın yatırım hedefleri tamamlandığında motive edici görsel konfeti kutlaması (`canvas-confetti`).
- **Disiplinli Birikim Takibi:** Hedeflenen bütçe ile gerçekleşen birikim tutarını anlık kıyaslama.

### 5. ⚖️ Reel Kâr / Zarar & Satın Alma Gücü Karşılığı
- *"TL olarak kârdayım ama enflasyona ve kurlara karşı reel durumum ne?"* sorusuna net yanıt:
  - **₺ Nominal Kâr/Zarar**
  - **$ Karşılığı** (USD bazında reel değer)
  - **€ Karşılığı** (EUR bazında reel değer)
  - **Altın Karşılığı** (Gram altın bazında reel getiri)

### 6. ⚡ Canlı Piyasa Kurları & Serbest Piyasa Makası
- **Kapsamlı Takip:** USD, EUR, Gram Altın, Çeyrek Altın, Ons ($), BIST 100, Nasdaq-100 ve TEFAS fonları.
- **Serbest Piyasa Makası:** Kur kartına dokunarak Kapalıçarşı veya banka makas kurunu manuel girebilme veya tek tıkla canlı kura geri dönebilme.
- **Kesintisiz & Çok Kaynaklı:** Ağ hatası durumunda alternatif API kaynaklarına düşen dayanıklı kur motoru.

### 7. 🔒 Güvenlik, Gizlilik & Biyometrik Kilit
- **Biyometrik Kilit (WebAuthn):** iPhone'da **FaceID / TouchID**, Android'de **Parmak İzi / Yüz Tanıma**, Windows'ta **Windows Hello**.
- **Sayısal PIN Koruması:** 4-6 haneli güvenli PIN klavyesi ve hassas işlemler öncesi adım yükseltme (step-up) PIN doğrulaması.
- **Otomatik Kilit:** Uygulama arka plana atıldığında veya ekran kapandığında belirlenen sürede otomatik kilitlenme (Anında, 1 dk, 5 dk, 15 dk).
- **Gizlilik Maskesi (Göz İkonu):** Toplu taşımada veya kalabalık ortamlarda bakiyeleri tek tıkla gizleme/maskeleme (`•••• ₺`).

### 8. 💾 %100 Local-First & Askeri Düzeyde Şifreli Yedekleme (AES-256-GCM)
- **Tam Veri Sahipliği:** Verileriniz **asla hiçbir uzak sunucuya gönderilmez**. Tamamen tarayıcınızın kalıcı yerel veritabanında (**IndexedDB / Dexie.js**) saklanır.
- **🛡️ Şifreli Yedek İndir (AES-256-GCM):** Belirleyeceğiniz parola ile Web Crypto API standartlarında şifrelenmiş `.json` yedek dosyası oluşturun (`bizimkasa-sifreli-yedek-YYYY-MM-DD.json`).
  - **PBKDF2-SHA256 (100.000 İterasyon):** Kaba kuvvet (brute-force) saldırılarına karşı tuzlanmış (salted) 256-bit AES anahtar türetimi.
  - **AES-256-GCM Bütünlük Zırhı:** 12-byte rastgele başlatma vektörü (*IV*) ve dahili bütünlük doğrulama etiketi (*Auth Tag*) ile sıfır veri manipülasyonu.
  - **Bulut & Mobil Uyumluluğu:** Google Drive, iCloud veya yerel dosya yöneticilerinde sıfır riskle saklayıp mobil cihazlardan doğrudan geri yükleyebilme.
- **Standart Yedek İndir (JSON):** Hızlı kullanım ve açık metin arşivleme için standart JSON yedeği.
- **Akıllı Geri Yükleme:** Seçilen dosyanın şifreli olup olmadığını anında algılama ve parola doğrulama ekranıyla tek tıkla geri yükleme.

> [!NOTE]
> **Güvenli Bağlantı (HTTPS / Secure Context) Kuralı:** Apple (iOS Safari) ve W3C güvenlik standartları gereği Web Crypto API (`crypto.subtle`) ve Biyometrik sensörler (FaceID/TouchID) yalnızca güvenli bağlantılarda (**HTTPS** veya yerel `localhost`) çalışır. Telefonunuzdan yerel ağ IP'si (`http://192.168.x.x`) üzerinden girildiğinde mobil tarayıcılar bu API'leri güvenlik amacıyla engeller. **Cloudflare Pages (`https://...`)** üzerinde canlıya alındığında hem FaceID hem de AES-256 şifreleme telefonunuzda sorunsuz ve tam performansla çalışır.

---

## 🛠️ Teknoloji Yığını

| Katman | Teknoloji | Açıklama |
|---|---|---|
| **Çekirdek** | React 19 + TypeScript | Modern bileşen mimarisi ve tam tip güvenliği |
| **Derleyici / Araç** | Vite 8 | Ultra hızlı HMR ve optimize üretim derlemesi |
| **Stil & Arayüz** | Tailwind CSS v4 | Cam-morfik (glassmorphism) karanlık tema & tam duyarlı tasarım |
| **Kalıcı Depolama** | Dexie.js (IndexedDB) | İstemci tarafında çalışan yüksek performanslı yerel veritabanı |
| **Kriptografi & Güvenlik** | Web Crypto API (SubtleCrypto) | AES-256-GCM, PBKDF2-SHA256 (100k döngü), WebAuthn (FaceID/TouchID) |
| **Grafik & Görsel** | Recharts | Varlık dağılımı ve portföy pasta grafikleri |
| **İkonlar** | Lucide React | Modern ve tutarlı arayüz ikon seti |
| **Efektler** | Canvas-Confetti | Hedef tamamlandığında motive edici konfeti kutlaması |
| **Test & Kalite** | Playwright E2E | Uçtan uca otomatik test senaryoları (26 test) |
| **PWA & Offline** | Vite Plugin PWA (Workbox) | Çevrimdışı önbellekleme, Service Worker ve mobil kurulum |

---

## 📁 Proje Mimarisi

```text
BizimKasa/
├── src/
│   ├── components/
│   │   ├── assets/           # Altın, Döviz, Fon takip, Toplu Silme ve İçe Aktarım panelleri
│   │   ├── auth/             # Biyometrik (WebAuthn) ve PIN Kilit Ekranı
│   │   ├── budget/           # Yıllık ve aylık bütçe & nakit akışı matris bileşenleri
│   │   ├── common/           # Navbar, BottomNav, Hesap Düzenleme & Renk Modalı, Filtreler
│   │   ├── dashboard/        # Konsolide Net Varlık Kartı, Varlık Dağılım Grafiği, Kurlar
│   │   ├── investment/       # Aylık Yatırım & Birikim Hedef Planlayıcısı (Konfeti kutlamalı)
│   │   └── settings/         # Şifreli/Standart Yedekleme, Geri Yükleme ve Güvenlik Ayarları
│   ├── constants/            # 18 renk seçeneği (themeColors.ts) ve 1.875 fonluk TEFAS sözlüğü (tefasFunds.ts)
│   ├── db/                   # Dexie.js IndexedDB v3 şeması ve başlangıç tohum verileri
│   ├── services/             # Portföy motoru, canlı kurlar, Web Crypto API ve güvenlik servisleri
│   │   ├── cryptoService.ts  # AES-256-GCM ve PBKDF2 Web Crypto API motoru
│   │   ├── exportService.ts  # Şifreli & düz JSON dışa/içe aktarım servisi
│   │   ├── securityService.ts# PIN hashing, WebAuthn FaceID/TouchID doğrulama
│   │   ├── ratesService.ts   # Canlı serbest piyasa kurları ve TEFAS senkronizasyonu
│   │   └── portfolioService.ts# Konsolide portföy ve kâr/zarar hesaplama motoru
│   ├── types/                # Finansal veri modelleri ve TypeScript tip tanımları
│   └── version.ts            # Uygulama sürümü ve derleme meta verileri (v1.2.0)
├── public/                   # PWA ikonları, web manifest ve statik varlıklar
├── e2e/                      # Playwright uçtan uca test senaryoları (26 test)
├── index.html                # PWA başlangıç HTML şablonu
├── vite.config.ts            # Vite & VitePWA servis çalıştırıcı yapılandırması
└── package.json              # Bağımlılıklar ve npm scriptleri
```

---

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler
- **Node.js** 18+ (Node.js 20 veya 24 önerilir)
- **npm** veya **pnpm**

### Yerel Geliştirme Sunucusunu Başlatma
```bash
# Depoyu klonlayın
git clone https://github.com/aranelpalantir/BizimKasa.git
cd BizimKasa

# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev
```

Tarayıcınızda açılan yerel adrese (örn: `http://localhost:5173`) giderek uygulamayı anında deneyimleyebilirsiniz.

### Üretim Derlemesi (Production Build)
```bash
# Tip kontrolü ve optimize üretim çıktısı
npm run build

# Üretim paketini yerelde test edin
npm run preview
```

---

## ☁️ Dağıtım ve Yayınlama (Cloudflare Pages / Self-Hosting)

Uygulamanın resmi ve kullanıma hazır canlı sürümü **[https://bizimkasa.pages.dev](https://bizimkasa.pages.dev)** adresinde barındırılmaktadır.

Eğer projeyi çatallayıp (fork) kendi GitHub deponuz ve kendi Cloudflare Pages hesabınız üzerinden barındırmak isterseniz:

Cloudflare Pages, **ücretsiz planda otomatik CI/CD dağıtımını ve sınırsız bant genişliğini tam olarak destekler**:

1. Değişikliklerinizi kendi GitHub reponuza push edin:
   ```bash
   git push origin main
   ```
2. [Cloudflare Dashboard](https://dash.cloudflare.com)'a giriş yapın.
3. **Workers & Pages > Create application > Pages > Connect to Git** adımlarını izleyin.
4. Bağladığınız GitHub reponuzu seçin ve derleme ayarlarını yapılandırın:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. **Save and Deploy** butonuna tıklayın.

Cloudflare sitenizi her kod güncellemesinde otomatik olarak derleyecek ve size özel bir adres (`https://<proje-adiniz>.pages.dev`) veya tanımlayacağınız özel alan adı (custom domain) üzerinde anında yayına alacaktır. Telefonunuzdan bu adrese girip tarayıcı menüsünden **"Ana Ekrana Ekle"** diyerek kendi kasanızı tam ekran PWA olarak kullanabilirsiniz!

---

## 🤖 Geliştirme Süreci (AI-Assisted Engineering)

Bu proje; kişisel ve ortak bütçeleri, nakit akışını, döviz/altın birikimlerini ve TEFAS fon portföylerini sıfır sunucu maliyeti, üst düzey veri güvenliği ve tam gizlilikle tek bir çatı altında yönetebilmek amacıyla **AI Pair Programming (Yapay Zeka Destekli Eşli Geliştirme)** yaklaşımıyla sıfırdan tasarlanıp hayata geçirilmiştir.

- **Mimari:** %100 İstemci Taraflı Local-First (React 19 + TypeScript + Dexie.js IndexedDB).
- **Gizlilik:** Hiçbir kullanıcı veya finansal işlem verisi harici sunucuya iletilmez; tüm veriler tamamen kullanıcının cihazında saklanır ve işlenir.
- **Performans & Çevrimdışı:** Service Worker ve PWA altyapısı sayesinde kapalı ortamlarda veya internetsizken dahi tam performansla anında açılır.
- **Modern Arayüz:** Tailwind CSS v4 ile geliştirilmiş şık karanlık tema (dark mode) ve duyarlı (responsive) mobil öncelikli arayüz.

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) kapsamında açık kaynak olarak lisanslanmıştır.
