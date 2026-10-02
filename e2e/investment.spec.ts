import { test, expect } from '@playwright/test';

test.describe('Yatırım Planlama (Investment Planner)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Bizim Kasa').first()).toBeVisible({ timeout: 10000 });
    // Navigate to Investment tab
    await page.locator('nav').getByRole('button', { name: 'Yatırım', exact: true }).click();
  });

  test('planlama sayfası ve ay seçici düzgünce yüklenir', async ({ page }) => {
    // Title
    await expect(page.getByText('Aylık Yatırım Tahsis Planlayıcı')).toBeVisible();

    // Month navigator
    await expect(page.getByTitle('Önceki Ay')).toBeVisible();
    await expect(page.getByTitle(/Sonraki Ay/i)).toBeVisible();

    // Group filter bar
    await expect(page.getByRole('button', { name: /Tümü \(Konsolide\)/i })).toBeVisible();
  });

  test('belirli bir hesap seçilip yeni yatırım hedefi eklenebilir', async ({ page }) => {
    // Select 'Ana Hesap'
    const anaHesapBtn = page.getByRole('button', { name: 'Ana Hesap', exact: true });
    await expect(anaHesapBtn).toBeVisible();
    await anaHesapBtn.click();

    // Look for "Hedef Kalem Ekle"
    const addTargetBtn = page.getByRole('button', { name: 'Hedef Kalem Ekle' });
    await expect(addTargetBtn).toBeVisible();
    await addTargetBtn.click();

    // Modal opens
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Yeni Yatırım Hedefi Ekle')).toBeVisible();

    // Enter target amount
    const amountInput = modal.locator('input[placeholder*="Örn: 15.000"]');
    await amountInput.fill('7500');

    // Submit button
    await modal.getByRole('button', { name: 'Hedefe Ekle' }).click();

    // Modal closes
    await expect(modal).not.toBeVisible();

    // Verify target amount is shown
    await expect(page.getByText(/7\.500/).first()).toBeVisible();
  });
});
