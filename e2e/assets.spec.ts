import { test, expect } from '@playwright/test';

test.describe('Varlıklar (Altın, Döviz ve Fon Takibi)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Bizim Kasa').first()).toBeVisible({ timeout: 10000 });
    // Navigate to Assets tab
    await page.locator('nav').getByRole('button', { name: 'Varlıklar' }).click();
  });

  test('altın sekmesi ve alt türler arasında geçiş yapılabilir', async ({ page }) => {
    // Top category tabs
    await expect(page.getByRole('button', { name: 'Altın', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Döviz (EUR & USD)', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Yatırım Fonları & Borsa', exact: true })).toBeVisible();

    // Default is gold: check subcategory buttons
    await expect(page.getByRole('button', { name: 'Fiziki Gram Altın' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Banka Gram Altın' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Çeyrek Altın' })).toBeVisible();

    // Switch to Banka Gram Altın
    await page.getByRole('button', { name: 'Banka Gram Altın' }).click();
    await expect(page.getByRole('button', { name: 'Banka Gram Altın' })).toHaveClass(/bg-amber-500/);

    // Switch to Çeyrek Altın
    await page.getByRole('button', { name: 'Çeyrek Altın' }).click();
    await expect(page.getByRole('button', { name: 'Çeyrek Altın' })).toHaveClass(/bg-amber-500/);
  });

  test('yeni altın alım işlemi eklenebilir', async ({ page }) => {
    // Click "Altın Al / Bozdur"
    await page.getByRole('button', { name: 'Altın Al / Bozdur' }).click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Altın İşlemi/)).toBeVisible();

    // Quantity input
    const qtyInput = modal.locator('div:has(> label:has-text("Miktar")) > input');
    await qtyInput.fill('3');

    // Unit price is auto-filled or can be set
    const unitPriceInput = modal.locator('div:has(> label:has-text("Birim Fiyat")) > input');
    await unitPriceInput.fill('6800');

    // Total TRY should be auto computed or can be filled
    const totalInput = modal.locator('div:has(> label:has-text("Toplam Tutar")) > input');
    await totalInput.fill('20400');

    // Note
    const noteInput = modal.locator('div:has(> label:has-text("Açıklama")) > input');
    await noteInput.fill('E2E Test Altın Alımı');

    // Save
    await modal.getByRole('button', { name: 'İşlemi Kaydet' }).click();

    // Modal closes
    await expect(modal).not.toBeVisible();

    // Verify transaction appears in table
    await expect(page.getByText('E2E Test Altın Alımı').first()).toBeVisible();
  });

  test('döviz sekmesine geçilip döviz alım işlemi kaydedilebilir', async ({ page }) => {
    // Switch to Currency tab
    await page.getByRole('button', { name: 'Döviz (EUR & USD)', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Döviz Al / Bozdur' })).toBeVisible();

    // Currency selector buttons (Dolar (USD) / Euro (EUR))
    await expect(page.getByRole('button', { name: 'Dolar (USD)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Euro (EUR)' })).toBeVisible();

    // Select Dolar (USD)
    await page.getByRole('button', { name: 'Dolar (USD)' }).click();

    // Click "Döviz Al / Bozdur"
    await page.getByRole('button', { name: 'Döviz Al / Bozdur' }).click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Fill quantity
    const qtyInput = modal.locator('div:has(> label:has-text("Miktar")) > input');
    await qtyInput.fill('150');

    // Unit rate
    const rateInput = modal.locator('div:has(> label:has-text("Kur")) > input');
    await rateInput.fill('49');

    // Note
    const noteInput = modal.locator('div:has(> label:has-text("Açıklama")) > input');
    await noteInput.fill('E2E Test Dolar Alımı');

    // Save
    await modal.getByRole('button', { name: 'İşlemi Kaydet' }).click();

    // Modal closes
    await expect(modal).not.toBeVisible();

    // Verify transaction appears in history
    await expect(page.getByText('E2E Test Dolar Alımı').first()).toBeVisible();
  });

  test('yatırım fonları sekmesinde yeni fon alım işlemi yapılabilir', async ({ page }) => {
    // Switch to Funds tab
    await page.getByRole('button', { name: 'Yatırım Fonları & Borsa', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fon Al / Bozdur' })).toBeVisible();

    // Click "Fon Al / Bozdur"
    await page.getByRole('button', { name: 'Fon Al / Bozdur' }).click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Fill quantity and price
    const qtyInput = modal.locator('div:has(> label:has-text("Alınan Adet")) > input');
    await qtyInput.fill('50');

    const priceInput = modal.locator('div:has(> label:has-text("Birim Alış Fiyatı")) > input');
    await priceInput.fill('20');

    const totalInput = modal.locator('div:has(> label:has-text("Toplam Ödenen Tutar")) > input');
    await totalInput.fill('1000');

    const noteInput = modal.locator('div:has(> label:has-text("Açıklama")) > input');
    await noteInput.fill('E2E Test Fon Alımı');

    // Save with 'Alışı Kaydet'
    await modal.getByRole('button', { name: 'Alışı Kaydet' }).click();
    await expect(modal).not.toBeVisible();

    // Verify transaction appears in table
    await expect(page.getByText('E2E Test Fon Alımı').first()).toBeVisible();
  });

  test('dolar ve euro içeri aktarıldığında hesaplar birbirine karışmaz', async ({ page }) => {
    // 1. Dolar İçe Aktar
    await page.getByRole('button', { name: 'Excel / CSV İçe Aktar' }).click();
    let importModal = page.locator('div[role="dialog"]');
    await expect(importModal).toBeVisible();

    // Select Dolar asset
    const assetSelect = importModal.locator('select').nth(1);
    await assetSelect.selectOption('CURRENCY_USD');

    // Fill paste text
    const textarea = importModal.locator('textarea');
    await textarea.fill('15.01.2025; 200; 49.00; Ozel Dolar Ice Aktarimi');

    // Submit import
    const submitBtn = importModal.getByRole('button', { name: /İçin Aktar/ });
    await submitBtn.click();
    await expect(importModal).not.toBeVisible({ timeout: 5000 });

    // 2. Euro İçe Aktar
    await page.getByRole('button', { name: 'Excel / CSV İçe Aktar' }).click();
    importModal = page.locator('div[role="dialog"]');
    await expect(importModal).toBeVisible();

    const assetSelectEur = importModal.locator('select').nth(1);
    await assetSelectEur.selectOption('CURRENCY_EUR');

    const textareaEur = importModal.locator('textarea');
    await textareaEur.fill('16.01.2025; 300; 55.00; Ozel Euro Ice Aktarimi');

    const submitBtnEur = importModal.getByRole('button', { name: /İçin Aktar/ });
    await submitBtnEur.click();
    await expect(importModal).not.toBeVisible({ timeout: 5000 });

    // 3. Döviz sekmesine git ve Dolar / Euro ayrımını doğrula
    await page.getByRole('button', { name: 'Döviz (EUR & USD)', exact: true }).click();

    // Dolar kontrolü
    await page.getByRole('button', { name: 'Dolar (USD)' }).click();
    await expect(page.getByText('Ozel Dolar Ice Aktarimi').first()).toBeVisible();
    await expect(page.getByText('Ozel Euro Ice Aktarimi')).toHaveCount(0);

    // Euro kontrolü
    await page.getByRole('button', { name: 'Euro (EUR)' }).click();
    await expect(page.getByText('Ozel Euro Ice Aktarimi').first()).toBeVisible();
    await expect(page.getByText('Ozel Dolar Ice Aktarimi')).toHaveCount(0);
  });

  test('hareketler çoklu seçilip toplu olarak silinebilir', async ({ page }) => {
    // Döviz sekmesine git
    await page.getByRole('button', { name: 'Döviz (EUR & USD)', exact: true }).click();
    await page.getByRole('button', { name: 'Dolar (USD)' }).click();

    // İki yeni işlem ekle
    for (const note of ['Silinecek İslem 1', 'Silinecek İslem 2']) {
      await page.getByRole('button', { name: 'Döviz Al / Bozdur' }).click();
      const modal = page.locator('div[role="dialog"]');
      await expect(modal).toBeVisible();

      await modal.locator('div:has(> label:has-text("Miktar")) > input').fill('50');
      await modal.locator('div:has(> label:has-text("Kur")) > input').fill('49');
      await modal.locator('div:has(> label:has-text("Açıklama")) > input').fill(note);
      await modal.getByRole('button', { name: 'İşlemi Kaydet' }).click();
      await expect(modal).not.toBeVisible();
      await expect(page.getByText(note).first()).toBeVisible();
    }

    // Seçim kutularını işaretle
    const row1 = page.locator('div:has-text("Silinecek İslem 1")').filter({ has: page.locator('input[type="checkbox"]') }).last();
    const row2 = page.locator('div:has-text("Silinecek İslem 2")').filter({ has: page.locator('input[type="checkbox"]') }).last();

    await row1.locator('input[type="checkbox"]').check();
    await row2.locator('input[type="checkbox"]').check();

    // Toplu silme çubuğu ve butonu görünür olmalı
    await expect(page.getByText(/2 işlem seçildi/)).toBeVisible();
    const batchDeleteBtn = page.getByRole('button', { name: /Seçilenleri Sil \(2\)/ });
    await expect(batchDeleteBtn).toBeVisible();

    // Toplu silmeye tıkla
    await batchDeleteBtn.click();

    // Onay modalı
    const confirmModal = page.locator('div[role="dialog"]:has-text("Seçilen İşlemleri Sil")');
    await expect(confirmModal).toBeVisible();
    await confirmModal.getByRole('button', { name: 'Sil' }).click();

    // Onay modalı kapanır ve işlemler silinir
    await expect(confirmModal).not.toBeVisible();
    await expect(page.getByText('Silinecek İslem 1')).toHaveCount(0);
    await expect(page.getByText('Silinecek İslem 2')).toHaveCount(0);
  });

  test('içeri aktar modalı açılırken aktif seçili varlık (çeyrek altın, döviz, fon) otomatik seçili gelir', async ({ page }) => {
    // 1. Altın sekmesinde Çeyrek Altın seç
    await page.getByRole('button', { name: 'Altın', exact: true }).click();
    await page.getByRole('button', { name: 'Çeyrek Altın' }).click();

    // Excel / CSV İçe Aktar modalını aç
    await page.getByRole('button', { name: 'Excel / CSV İçe Aktar' }).click();
    let importModal = page.locator('div[role="dialog"]');
    await expect(importModal).toBeVisible();

    // 2. Aktarılacak Varlık Türü select değerini kontrol et -> GOLD_CEYREK olmalı
    let assetSelect = importModal.locator('select').nth(1);
    await expect(assetSelect).toHaveValue('GOLD_CEYREK');

    // Modalı kapat
    await importModal.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(importModal).not.toBeVisible();

    // 2. Cumhuriyet Altını seç
    await page.getByRole('button', { name: 'Cumhuriyet Altını' }).click();
    await page.getByRole('button', { name: 'Excel / CSV İçe Aktar' }).click();
    importModal = page.locator('div[role="dialog"]');
    await expect(importModal).toBeVisible();
    assetSelect = importModal.locator('select').nth(1);
    await expect(assetSelect).toHaveValue('GOLD_CUMHURIYET');

    await importModal.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(importModal).not.toBeVisible();

    // 3. Döviz sekmesine geç ve Dolar seç
    await page.getByRole('button', { name: 'Döviz (EUR & USD)', exact: true }).click();
    await page.getByRole('button', { name: 'Dolar (USD)' }).click();
    await page.getByRole('button', { name: 'Excel / CSV İçe Aktar' }).click();
    importModal = page.locator('div[role="dialog"]');
    await expect(importModal).toBeVisible();
    assetSelect = importModal.locator('select').nth(1);
    await expect(assetSelect).toHaveValue('CURRENCY_USD');

    await importModal.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(importModal).not.toBeVisible();

    // 4. Dövizde Euro seç
    await page.getByRole('button', { name: 'Euro (EUR)' }).click();
    await page.getByRole('button', { name: 'Excel / CSV İçe Aktar' }).click();
    importModal = page.locator('div[role="dialog"]');
    await expect(importModal).toBeVisible();
    assetSelect = importModal.locator('select').nth(1);
    await expect(assetSelect).toHaveValue('CURRENCY_EUR');

    await importModal.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(importModal).not.toBeVisible();

    // 5. Yatırım fonları sekmesine geç
    await page.getByRole('button', { name: 'Yatırım Fonları & Borsa', exact: true }).click();
    const ti2Row = page.locator('tr:has-text("TI2")');
    if (await ti2Row.count() > 0) {
      await ti2Row.first().click();
    }
    await page.getByRole('button', { name: 'Excel / CSV İçe Aktar' }).click();
    importModal = page.locator('div[role="dialog"]');
    await expect(importModal).toBeVisible();
    assetSelect = importModal.locator('select').nth(1);
    const selectedVal = await assetSelect.inputValue();
    expect(selectedVal === 'FUND_TI2' || selectedVal.startsWith('FUND_') || selectedVal === 'CUSTOM_FUND').toBeTruthy();

    await importModal.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(importModal).not.toBeVisible();
  });
});

