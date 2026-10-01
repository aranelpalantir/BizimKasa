import { test, expect } from '@playwright/test';

test.describe('Dashboard / Ana Sayfa', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize past the spinner
    await expect(page.getByText('Bizim Kasa').first()).toBeVisible({ timeout: 10000 });
  });

  test('uygulama düzgünce yüklenir ve ana bileşenleri gösterir', async ({ page }) => {
    // Navbar
    await expect(page.getByText('Bizim Kasa').first()).toBeVisible();
    await expect(page.getByText('Ortak Bütçe & Varlık Portföyü')).toBeVisible();

    // Bottom Navigation tabs
    const bottomNav = page.locator('nav');
    await expect(bottomNav.getByRole('button', { name: 'Özet' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'Gelir & Gider' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'Varlıklar' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'Yatırım', exact: true })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'Ayarlar' })).toBeVisible();

    // Group filter bar
    await expect(page.getByRole('button', { name: /Tümü \(Konsolide\)/i })).toBeVisible();

    // Portfolio cards
    await expect(page.getByText('Toplam Portföy Değeri')).toBeVisible();
    await expect(page.getByText('Portföy Varlık Dağılımı')).toBeVisible();
  });

  test('gizlilik butonu (göz ikonu) değerleri gizler ve tekrar açar', async ({ page }) => {
    // Net worth should be visible initially
    await expect(page.getByText('Toplam Portföy Değeri')).toBeVisible();

    // Click the privacy eye toggle button
    const privacyBtn = page.getByTitle('Değerleri Gizle');
    await expect(privacyBtn).toBeVisible();
    await privacyBtn.click();

    // Now values should be hidden (showing •••••• ₺)
    await expect(page.getByText('•••••• ₺').first()).toBeVisible();

    // The button title should have updated to 'Değerleri Göster'
    const showValuesBtn = page.getByTitle('Değerleri Göster');
    await expect(showValuesBtn).toBeVisible();
    await showValuesBtn.click();

    // Values should be visible again
    await expect(page.getByTitle('Değerleri Gizle')).toBeVisible();
  });

  test('hesap filtreleri arasında geçiş yapılabilir', async ({ page }) => {
    // Click on 'Ana Hesap'
    const anaHesapBtn = page.getByRole('button', { name: /Ana Hesap/i });
    if (await anaHesapBtn.isVisible()) {
      await anaHesapBtn.click();
      // Should show that Ana Hesap is selected
      await expect(page.getByText('Ana Hesap Varlıkları Görüntüleniyor')).toBeVisible();

      // Switch back to 'Tümü (Konsolide)'
      await page.getByRole('button', { name: /Tümü \(Konsolide\)/i }).click();
      await expect(page.getByText('Ana Hesap Varlıkları Görüntüleniyor')).not.toBeVisible();
    }
  });

  test('hızlı erişim kartları ilgili sekmelere yönlendirir', async ({ page }) => {
    const bottomNav = page.locator('nav');

    // "Matrise Git" navigates to budget tab
    await page.getByRole('button', { name: 'Matrise Git' }).click();
    await expect(bottomNav.getByRole('button', { name: 'Gelir & Gider' })).toHaveClass(/text-amber-400/);

    // Go back to dashboard by clicking logo or bottom nav
    await bottomNav.getByRole('button', { name: 'Özet' }).click();

    // "Tümünü Yönet" navigates to assets tab
    await page.getByRole('button', { name: 'Tümünü Yönet' }).click();
    await expect(bottomNav.getByRole('button', { name: 'Varlıklar' })).toHaveClass(/text-amber-400/);
  });
});
