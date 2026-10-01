# BizimKasa 🪙

> **Local-First PWA (Progressive Web App)** — Aile ve çift bütçesi, kredi kartı ekstreleri, fiziki ve banka altınları (gram & çeyrek), döviz (EUR/USD), TEFAS yatırım fonları ve portföy kâr/zarar takip uygulaması.

---

## 🌟 Öne Çıkan Özellikler

### 1. 📊 Aylık Bütçe & Nakit Akışı Matrisi (Google Sheets Birebir Karşılığı)
- **Kişi / Grup Bazlı Hiyerarşi:** Mert, Aylin, Çocuk veya Ortak Ev gibi dilediğiniz sayıda ana grup ve bu gruplara bağlı kredi kartları, maaşlar ve sabit giderler.
- **Yıllık & Aylık Görünüm:** Aylara yayılan nakit akışı tablosu (Şubat, Mart, Nisan, Mayıs...).
- **Otomatik Toplamlar:** Grup bazında `Grup Gider`, `Grup Gelir` ve `Grup Kalan (Gelir - Gider)`.
- **Konsolide Hane Raporu:** En altta tüm hanenin `Genel Gider`, `Genel Gelir` ve `Genel Kalan` tutarları.
- **Hızlı Hücre Düzenleme:** Herhangi bir hücreye dokunarak tutarı anında güncelleme.

### 2. 🪙 Altın & Emtia Takibi
- **Gram Altın:** Aylık alımlar (gram & TL), ortalama birim maliyet (`Ort. Brm. Mlyt.`), güncel piyasa değeri ve net kâr/zarar (₺ ve %).
- **Çeyrek Altın:** Adet bazlı fiziki birikim, alımlar, maliyet ve kâr/zarar hesabı.
- **Geçmiş Hareketler:** Tüm alım/satım işlemlerinin tarihçesi.

### 3. 💶 Çok Yıllı Döviz Matrisi (Euro & Dolar)
- Yıllara (2023, 2024, 2025, 2026) ve aylara yayılan döviz hareket matrisi.
- Pozitif değerler döviz alımını, negatif değerler bozdurulan/harcanan dövizi temsil eder.
- Kümülatif net bakiye ve anlık TL karşılığı.

### 4. 📈 TEFAS Fonları & Borsa Portföyü
- `TTE` (İş Portföy BIST Teknoloji), `GSP` (Garanti Portföy S&P 500), `DVT` (Deniz Portföy Dijital Teknolojiler) vb. fonlar.
- Fon bazında **Maliyet**, **Güncel Değer**, **Kâr/Zarar (TL)**, **Kâr/Zarar Oranı (%)** ve **Portföy Ağırlığı (%)**.
- Görsel karşılaştırma çubuk grafikleri.

### 5. 🎯 Reel Getiri Analizi (Çoklu Para Birimi)
- *\"TL olarak kârdayım ama enflasyona karşı gerçekten kaç dolar veya gram altın kazandım?\"*
  - **₺ Kâr/Zarar**
  - **$ Kâr/Zarar** (USD bazında)
  - **€ Kâr/Zarar** (EUR bazında)
  - **Altın (Gram) Kâr/Zarar** (Gram bazında)

### 6. ⚡ Canlı Piyasa Kurları & Serbest Piyasa Makası
- USD, EUR, Gram Altın, Çeyrek Altın, Ons ($), Gümüş, BIST 100, Nasdaq-100 ve TEFAS fonları.
- Kur kartına dokunarak Kapalıçarşı veya banka makas kurunu manuel girme / canlı kura geri alma opsiyonu.

### 7. 🔒 Güvenlik & Gizlilik
- **Biyometrik Kilit:** WebAuthn desteğiyle iPhone'da **FaceID / TouchID**, Android'de **Parmak İzi**, Windows'ta **Windows Hello**.
- **Sayısal PIN:** 4-6 haneli güvenli PIN klavyesi.
- **Otomatik Kilit:** Uygulama arka plana atıldığında veya boşta kaldığında otomatik kilitlenme.
- **Göz İkonu (Gizlilik Modu):** Ekranda rakamları tek tıkla yıldızlama (`•••• ₺`).

### 8. 💾 %100 Local-First & Tek Tıkla Yedekleme
- Verileriniz **asla hiçbir uzak sunucuya gönderilmez**. Tarayıcınızın kalıcı veritabanında (**IndexedDB / Dexie.js**) saklanır.
- **Yedeği İndir (JSON):** Tek tıkla `bizimkasa-yedek-YYYY-MM-DD.json` dosyasını telefonunuza indirin.
- **Yedekten Geri Yükle:** Telefon değiştirseniz bile dosyanızı seçip saniyeler içinde tüm verileri geri yükleyin.

---

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler
- Node.js 18+ (Node.js 24 önerilir)
- npm veya pnpm

### Yerel Geliştirme Sunucusunu Başlatma
```bash
# Bağımlılıkları yükleyin (ilk seferde)
npm install

# Geliştirme sunucusunu başlatın
npm run dev
```

Tarayıcınızda açılan adrese (örn: `http://localhost:5173`) gidin.

### Üretim Derlemesi (Production Build)
```bash
npm run build
npm run preview
```

---

## ☁️ Cloudflare Pages Üzerinde Yayınlama

Cloudflare Pages, **ücretsiz planda gizli (private) repoları tam olarak destekler**:

1. Reponuzu GitHub'a push edin (`git push origin main`).
2. [Cloudflare Dashboard](https://dash.cloudflare.com)'a girin.
3. **Workers & Pages > Create application > Pages > Connect to Git** adımlarını izleyin.
4. Reponuzu seçin:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. **Save and Deploy** butonuna tıklayın.

Cloudflare sitenizi otomatik olarak derleyecek ve size özel bir `https://bizimkasa.pages.dev` adresi verecektir. Telefonunuzdan bu adrese girip tarayıcı menüsünden **\"Ana Ekrana Ekle\"** diyerek tam ekran PWA olarak kullanabilirsiniz!
