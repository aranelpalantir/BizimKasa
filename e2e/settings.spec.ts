import { test, expect } from '@playwright/test';

test.describe('Ayarlar ve Güvenlik (Settings & PIN Security)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Bizim Kasa').first()).toBeVisible({ timeout: 10000 });
    // Navigate to Settings tab
    await page.locator('nav').getByRole('button', { name: 'Ayarlar' }).click();
  });

  test('ayarlar sayfası temel bölümleri listeler', async ({ page }) => {
    await expect(page.getByText('Güvenlik & Giriş Kilidi')).toBeVisible();
    await expect(page.getByText('Yedekleme & Geri Yükleme')).toBeVisible();
    await expect(page.getByText('Bu Cihazdaki Son Veri Değişikliği')).toBeVisible();
    await expect(page.getByText('%100 Local-First Gizlilik Güvencesi')).toBeVisible();
    await expect(page.getByText(/v1\.\d+\.\d+/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Sürümü Yenile/ })).toBeVisible();
  });

  test('PIN belirleme, kilitleme, hatalı ve doğru PIN ile kilit açma, ardından PIN kaldırma akışı', async ({ page }) => {
    // 1. PIN Belirle
    await page.getByRole('button', { name: 'PIN Belirle' }).click();

    const pinModal = page.locator('div[role="dialog"]');
    await expect(pinModal).toBeVisible();
    await expect(pinModal.getByText('Uygulama PIN Kodu Belirle')).toBeVisible();

    const inputs = pinModal.locator('input[type="password"]');
    await inputs.nth(0).fill('1234');
    await inputs.nth(1).fill('1234');

    await pinModal.getByRole('button', { name: 'PIN Kodunu Kaydet' }).click();
    await expect(pinModal).not.toBeVisible();

    // Verify success feedback
    await expect(page.getByText('PIN kodu başarıyla kaydedildi!')).toBeVisible();

    // 2. Şimdi Kilitle
    await page.getByRole('button', { name: 'Şimdi Kilitle' }).click();

    // Lock screen is displayed
    await expect(page.getByText('Lütfen devam etmek için kilidi açın')).toBeVisible();

    // 3. Hatalı PIN dene: 9, 9, 9, 9
    const keypad = page.locator('div.grid-cols-3');
    await keypad.getByRole('button', { name: '9', exact: true }).click();
    await keypad.getByRole('button', { name: '9', exact: true }).click();
    await keypad.getByRole('button', { name: '9', exact: true }).click();
    await keypad.getByRole('button', { name: '9', exact: true }).click();

    // Should show error message
    await expect(page.getByText('Hatalı PIN kodu!')).toBeVisible();

    // 4. Doğru PIN gir: 1, 2, 3, 4
    await keypad.getByRole('button', { name: '1', exact: true }).click();
    await keypad.getByRole('button', { name: '2', exact: true }).click();
    await keypad.getByRole('button', { name: '3', exact: true }).click();
    await keypad.getByRole('button', { name: '4', exact: true }).click();

    // Lock screen should disappear and return to app
    await expect(page.getByText('Lütfen devam etmek için kilidi açın')).not.toBeVisible();

    // 5. PIN Korumasını Kaldır (Mevcut PIN doğrulaması gerektirir)
    // Navigate back to Settings
    await page.locator('nav').getByRole('button', { name: 'Ayarlar' }).click();
    await page.getByRole('button', { name: 'Kaldır' }).click();

    const confirmModal = page.locator('div[role="dialog"]');
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal.getByText('PIN Korumasını Kaldır')).toBeVisible();

    // Hatalı PIN dene: 9999
    const pinAuthInput = confirmModal.locator('input[type="password"]');
    await pinAuthInput.fill('9999');
    await confirmModal.getByRole('button', { name: 'Kaldır' }).click();
    await expect(confirmModal.getByText('Hatalı PIN kodu!')).toBeVisible();

    // Doğru PIN gir: 1234 ve kaldır
    await pinAuthInput.fill('1234');
    await confirmModal.getByRole('button', { name: 'Kaldır' }).click();
    await expect(confirmModal).not.toBeVisible();

    // Verify PIN Belirle button is back
    await expect(page.getByRole('button', { name: 'PIN Belirle' })).toBeVisible();
  });

  test('JSON yedeği indirme çalışır', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Yedeği İndir (JSON)' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('şifreli yedek oluşturma, indirme ve şifreli geri yükleme akışı', async ({ page }) => {
    // 1. Şifreli Yedek İndir modalını aç
    await page.getByRole('button', { name: 'Şifreli Yedek İndir (Korumalı)' }).click();
    const exportModal = page.locator('div[role="dialog"]');
    await expect(exportModal).toBeVisible();
    await expect(exportModal.getByText('Şifreli Yedek Oluştur (AES-256)')).toBeVisible();

    // 2. Uyuşmayan şifreleri test et
    const passwordInputs = exportModal.locator('input');
    await passwordInputs.nth(0).fill('gizli123');
    await passwordInputs.nth(1).fill('farkli123');
    await exportModal.getByRole('button', { name: 'Şifrele ve İndir' }).click();
    await expect(exportModal.getByText('Girdiğiniz şifreler birbiriyle uyuşmuyor.')).toBeVisible();

    // 3. Doğru şifre ile indir
    await passwordInputs.nth(1).fill('gizli123');
    const downloadPromise = page.waitForEvent('download');
    await exportModal.getByRole('button', { name: 'Şifrele ve İndir' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/bizimkasa-sifreli-yedek-.*\.json$/);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // 4. Şifreli dosyayı yükle
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(downloadPath!);

    // 5. Şifreli yedek açma modalı belirmeli
    const decryptModal = page.locator('div[role="dialog"]');
    await expect(decryptModal).toBeVisible();
    await expect(decryptModal.getByText('Şifreli Yedeği Aç & Geri Yükle')).toBeVisible();

    // 6. Yanlış şifre dene
    await decryptModal.locator('input').fill('yanlis_sifre');
    await decryptModal.getByRole('button', { name: 'Şifreyi Çöz ve Yükle' }).click();
    await expect(decryptModal.getByText('Yedek şifresi hatalı veya dosya bozuk!')).toBeVisible();

    // 7. Doğru şifre gir
    await decryptModal.locator('input').fill('gizli123');
    await decryptModal.getByRole('button', { name: 'Şifreyi Çöz ve Yükle' }).click();

    // Modal kapanmalı ve geri yükleme gerçekleşmeli
    await expect(decryptModal).not.toBeVisible();
  });
});
