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
    await expect(page.getByRole('button', { name: 'Özel Birikim Kasası', exact: true })).toBeVisible();

    // Clicking it activates it
    await page.getByRole('button', { name: 'Özel Birikim Kasası', exact: true }).click();
    await expect(page.getByText('Özel Birikim Kasası Varlıkları Görüntüleniyor')).toBeVisible();
  });

  test('hesap renk teması filtre çubuğundaki palet düğmesinden değiştirilebilir', async ({ page }) => {
    // Click "Ana Hesap" in the filter bar
    await page.getByRole('button', { name: 'Ana Hesap', exact: true }).click();
    await expect(page.getByText('Ana Hesap Varlıkları Görüntüleniyor')).toBeVisible();

    // Palette button appears next to the active account
    const paletteBtn = page.getByRole('button', { name: 'Ana Hesap renk temasını değiştir' }).first();
    await expect(paletteBtn).toBeVisible();
    await paletteBtn.click();

    // Modal should be visible
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Hesap Renk Temasını Değiştir')).toBeVisible();
    await expect(modal.getByText('Canlı Önizleme')).toBeVisible();

    // Choose "Gül Pembesi (#f43f5e)" preset color button
    const roseColorBtn = modal.locator('button[title*="#f43f5e"]');
    await expect(roseColorBtn).toBeVisible();
    await roseColorBtn.click();

    // Save theme
    await modal.getByRole('button', { name: 'Temayı Kaydet' }).click();
    await expect(modal).not.toBeVisible();

    // Check that Ana Hesap button border/background now contains rose color rgb(244, 63, 94)
    const anaHesapBtn = page.getByRole('button', { name: 'Ana Hesap', exact: true });
    await expect(anaHesapBtn).toBeVisible();
    const styleAttr = await anaHesapBtn.getAttribute('style');
    expect(styleAttr).toContain('244, 63, 94');
  });

  test('ayarlar sayfasından hesap renk teması değiştirilebilir', async ({ page }) => {
    // Navigate to Ayarlar tab via bottom nav
    const settingsTabBtn = page.getByRole('button', { name: /Ayarlar/i });
    await settingsTabBtn.click();

    // Verify "Hesaplar ve Renk Temaları" section is visible
    await expect(page.getByText('Hesaplar ve Renk Temaları')).toBeVisible();

    // Click "Rengi Değiştir" on Ana Hesap row
    const editColorBtn = page.getByRole('button', { name: 'Ana Hesap rengini değiştir' });
    await expect(editColorBtn).toBeVisible();
    await editColorBtn.click();

    // Modal opens
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Hesap Renk Temasını Değiştir')).toBeVisible();

    // Pick "Fuşya (#d946ef)"
    const fuchsiaBtn = modal.locator('button[title*="#d946ef"]');
    await fuchsiaBtn.click();

    // Click "Temayı Kaydet"
    await modal.getByRole('button', { name: 'Temayı Kaydet' }).click();
    await expect(modal).not.toBeVisible();

    // Verify Ana Hesap now has Fuşya badge in Settings
    await expect(page.getByText('Fuşya')).toBeVisible();
  });
});
