import { test, expect } from '@playwright/test';

test.describe('Hesap ve Kasa Yönetimi (Account & Group Management)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Bizim Kasa').first()).toBeVisible({ timeout: 10000 });
  });

  test('boş hesap adı girildiğinde hata mesajı gösterir', async ({ page }) => {
    // Click "Yeni Hesap" button in the group filter bar
    await page.getByRole('button', { name: 'Yeni Hesap' }).first().click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Yeni Hesap / Kasa Ekle')).toBeVisible();

    // Submit with empty name
    await modal.getByRole('button', { name: 'Hesabı Oluştur' }).click();

    // Verify error message
    await expect(modal.getByText('Lütfen bir hesap adı girin.')).toBeVisible();

    // Close modal
    await modal.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(modal).not.toBeVisible();
  });

  test('yeni hesap başarıyla oluşturulur ve filtre çubuğunda görünür', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: 'Yeni Hesap' }).first().click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Fill name
    const input = modal.locator('input[placeholder*="Örn: Ana Hesap"]');
    await input.fill('Özel Birikim Kasası');

    // Click "Hesabı Oluştur"
    await modal.getByRole('button', { name: 'Hesabı Oluştur' }).click();

    // Modal closes
    await expect(modal).not.toBeVisible();

    // Verify new account appears in group filter bar
    await expect(page.getByRole('button', { name: 'Özel Birikim Kasası' })).toBeVisible();

    // Clicking it activates it
    await page.getByRole('button', { name: 'Özel Birikim Kasası' }).click();
    await expect(page.getByText('Özel Birikim Kasası Varlıkları Görüntüleniyor')).toBeVisible();
  });
});
