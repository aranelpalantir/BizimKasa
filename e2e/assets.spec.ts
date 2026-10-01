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
});
