import { test, expect } from '@playwright/test';

test.describe('Gelir & Gider (Bütçe & Nakit Akışı)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize past the spinner
    await expect(page.getByText('Bizim Kasa').first()).toBeVisible({ timeout: 10000 });
    // Navigate to Budget tab
    await page.locator('nav').getByRole('button', { name: 'Gelir & Gider' }).click();
  });

  test('matris görünümü başlıkları ve tabloları yüklenir', async ({ page }) => {
    await expect(page.getByText('Gelir & Gider (Aylık Nakit Akışı)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Yıllık Matris' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aylık Görünüm' })).toBeVisible();

    // Verify presence of table headers
    await expect(page.locator('table th', { hasText: 'Kalem / Hesap' })).toBeVisible();
    await expect(page.locator('table th', { hasText: 'Ocak' })).toBeVisible();
    await expect(page.locator('table th', { hasText: 'Aralık' })).toBeVisible();
  });

  test('yıllık matris ve aylık görünüm modları arasında geçiş yapılabilir', async ({ page }) => {
    // Switch to single month view
    await page.getByRole('button', { name: 'Aylık Görünüm' }).click();
    await expect(page.getByTitle('Önceki Ay')).toBeVisible();
    await expect(page.getByTitle('Sonraki Ay')).toBeVisible();

    // Switch back to matrix view
    await page.getByRole('button', { name: 'Yıllık Matris' }).click();
    await expect(page.locator('table')).toBeVisible();
  });

  test('matriste hücreye tıklanıp tutar güncellenebilir', async ({ page }) => {
    // Find the row for Bonus Kredi Kartı or first expense row
    const row = page.locator('tr', { hasText: 'Bonus Kredi Kartı' });
    await expect(row).toBeVisible();

    // Click on the first month cell in this row
    const cell = row.locator('td.cursor-pointer').first();
    await cell.click();

    // Modal opens
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Bonus Kredi Kartı/)).toBeVisible();

    // Type new amount
    const input = modal.locator('input[type="text"]');
    await input.fill('18500');

    // Click Kaydet
    await modal.getByRole('button', { name: 'Kaydet' }).click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // The cell or table should now reflect the updated value
    await expect(row).toContainText('18.500');
  });

  test('yeni bir bütçe kalemi eklenebilir', async ({ page }) => {
    // Click "Kalem Ekle"
    await page.getByRole('button', { name: 'Kalem Ekle' }).click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Yeni Gelir / Gider Kalemi Ekle')).toBeVisible();

    // Fill account name
    await modal.locator('input[type="text"]').fill('Spor Salonu Üyeliği');

    // Submit
    await modal.getByRole('button', { name: 'Kalemi Ekle' }).click();

    // Modal closes and new account appears in table
    await expect(modal).not.toBeVisible();
    await expect(page.getByText('Spor Salonu Üyeliği')).toBeVisible();
  });

  test('yıl değiştirildiğinde tablo güncellenir', async ({ page }) => {
    const yearSelect = page.locator('select').first();
    await expect(yearSelect).toBeVisible();

    // Switch to year 2025
    await yearSelect.selectOption('2025');
    await expect(page.locator('table th', { hasText: 'Kalem / Hesap (2025)' })).toBeVisible();

    // Switch back to 2026
    await yearSelect.selectOption('2026');
    await expect(page.locator('table th', { hasText: 'Kalem / Hesap (2026)' })).toBeVisible();
  });
});
