import { db, setSuppressModificationTracking, touchLastModified, getLastModifiedTimestamp } from '../db/db';
import { forceResetWithDummyData } from '../db/seed';
import { encryptData, decryptData } from './cryptoService';

export interface BizimKasaBackup {
  version: number;
  exportDate: string;
  lastModifiedAt?: string;
  app: 'BizimKasa';
  encrypted?: false;
  groups: any[];
  accounts: any[];
  cashFlowEntries: any[];
  transactions: any[];
  marketRates: any[];
  investmentPlans: any[];
  settings: any[];
}

export interface EncryptedBackupFile {
  version: number;
  exportDate: string;
  lastModifiedAt?: string;
  app: 'BizimKasa';
  encrypted: true;
  crypto: {
    algorithm: 'AES-GCM-256';
    keyDerivation: 'PBKDF2-SHA256';
    iterations: number;
    salt: string;
    iv: string;
  };
  ciphertext: string;
}

export interface InspectBackupResult {
  valid: boolean;
  isEncrypted: boolean;
  data?: any;
  error?: string;
  exportDate?: string;
  lastModifiedAt?: string;
}

async function getDatabaseBackupData(): Promise<BizimKasaBackup> {
  const groups = await db.groups.toArray();
  const accounts = await db.accounts.toArray();
  const cashFlowEntries = await db.cashFlowEntries.toArray();
  const transactions = await db.transactions.toArray();
  const marketRates = await db.marketRates.toArray();
  const investmentPlans = await db.investmentPlans.toArray();
  const settings = await db.settings.toArray();

  const lastModRecord = settings.find(s => s.key === 'lastModifiedAt');
  const lastModifiedAt = (lastModRecord?.value as string) || await getLastModifiedTimestamp();

  return {
    version: 1,
    exportDate: new Date().toISOString(),
    lastModifiedAt,
    app: 'BizimKasa',
    groups,
    accounts,
    cashFlowEntries,
    transactions,
    marketRates,
    investmentPlans,
    settings
  };
}

async function applyBackupToDatabase(data: BizimKasaBackup): Promise<void> {
  if (data.app !== 'BizimKasa' || !Array.isArray(data.groups) || !Array.isArray(data.accounts)) {
    throw new Error('Geçersiz yedek dosyası formatı! BizimKasa yedeği seçiniz.');
  }

  setSuppressModificationTracking(true);
  try {
    await db.transaction('rw', [
      db.groups,
      db.accounts,
      db.cashFlowEntries,
      db.transactions,
      db.marketRates,
      db.investmentPlans,
      db.settings
    ], async () => {
      await db.groups.clear();
      await db.accounts.clear();
      await db.cashFlowEntries.clear();
      await db.transactions.clear();
      await db.marketRates.clear();
      await db.investmentPlans.clear();
      await db.settings.clear();

      if (data.groups.length > 0) await db.groups.bulkAdd(data.groups);
      if (data.accounts.length > 0) await db.accounts.bulkAdd(data.accounts);
      if (data.cashFlowEntries?.length > 0) await db.cashFlowEntries.bulkAdd(data.cashFlowEntries);
      if (data.transactions?.length > 0) await db.transactions.bulkAdd(data.transactions);
      if (data.marketRates?.length > 0) await db.marketRates.bulkAdd(data.marketRates);
      if (data.investmentPlans?.length > 0) await db.investmentPlans.bulkAdd(data.investmentPlans);
      if (data.settings?.length > 0) await db.settings.bulkAdd(data.settings);
      await db.settings.delete('userClearedData');

      // Yedekten gelen son değişiklik zamanını doğrudan koru
      const restoredLastModified = 
        data.lastModifiedAt || 
        (data.settings?.find((s: any) => s.key === 'lastModifiedAt')?.value) || 
        data.exportDate || 
        new Date().toISOString();

      await db.settings.put({ key: 'lastModifiedAt', value: restoredLastModified });
      await db.settings.put({ key: 'lastImportedAt', value: new Date().toISOString() });
    });
  } finally {
    setSuppressModificationTracking(false);
  }
}

export async function exportDatabaseToJSON(): Promise<void> {
  const backupData = await getDatabaseBackupData();
  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const dateStr = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `bizimkasa-yedek-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportEncryptedBackup(password: string): Promise<void> {
  if (!password || password.trim().length === 0) {
    throw new Error('Lütfen geçerli bir şifreleme parolası girin.');
  }

  const backupData = await getDatabaseBackupData();
  const jsonStr = JSON.stringify(backupData);
  const payload = await encryptData(jsonStr, password);

  const fileData: EncryptedBackupFile = {
    version: 1,
    exportDate: new Date().toISOString(),
    lastModifiedAt: backupData.lastModifiedAt,
    app: 'BizimKasa',
    encrypted: true,
    crypto: {
      algorithm: payload.algorithm,
      keyDerivation: payload.keyDerivation,
      iterations: payload.iterations,
      salt: payload.salt,
      iv: payload.iv
    },
    ciphertext: payload.ciphertext
  };

  const fileContent = JSON.stringify(fileData, null, 2);
  const blob = new Blob([fileContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `bizimkasa-sifreli-yedek-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function inspectBackupFile(file: File): Promise<InspectBackupResult> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (data.app !== 'BizimKasa') {
      return { valid: false, isEncrypted: false, error: 'Seçilen dosya BizimKasa yedek dosyası değil!' };
    }

    if (data.encrypted === true) {
      if (!data.crypto || !data.ciphertext) {
        return { valid: false, isEncrypted: true, error: 'Şifreli yedek dosyası içeriği bozuk veya eksik!' };
      }
      return {
        valid: true,
        isEncrypted: true,
        data,
        exportDate: data.exportDate,
        lastModifiedAt: data.lastModifiedAt || data.exportDate
      };
    }

    if (!Array.isArray(data.groups) || !Array.isArray(data.accounts)) {
      return { valid: false, isEncrypted: false, error: 'Yedek dosyası içeriği eksik veya geçersiz formatta.' };
    }

    const fileLastModified = 
      data.lastModifiedAt || 
      (data.settings?.find((s: any) => s.key === 'lastModifiedAt')?.value) || 
      data.exportDate;

    return {
      valid: true,
      isEncrypted: false,
      data,
      exportDate: data.exportDate,
      lastModifiedAt: fileLastModified
    };
  } catch {
    return { valid: false, isEncrypted: false, error: 'Dosya okunamadı veya geçerli bir JSON formatında değil.' };
  }
}

export async function restoreEncryptedBackup(fileData: any, password: string): Promise<{ success: boolean; message: string }> {
  try {
    const decryptedJsonStr = await decryptData(
      {
        algorithm: fileData.crypto.algorithm,
        keyDerivation: fileData.crypto.keyDerivation,
        iterations: fileData.crypto.iterations,
        salt: fileData.crypto.salt,
        iv: fileData.crypto.iv,
        ciphertext: fileData.ciphertext
      },
      password
    );

    const decryptedData: BizimKasaBackup = JSON.parse(decryptedJsonStr);
    // If outer file had lastModifiedAt, attach it if missing in decryptedData
    if (!decryptedData.lastModifiedAt && fileData.lastModifiedAt) {
      decryptedData.lastModifiedAt = fileData.lastModifiedAt;
    }
    await applyBackupToDatabase(decryptedData);
    return { success: true, message: 'Şifreli yedek başarıyla çözüldü ve tüm veriler geri yüklendi!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Şifre çözme veya geri yükleme başarısız oldu.' };
  }
}

export async function restorePlainBackup(backupData: BizimKasaBackup): Promise<{ success: boolean; message: string }> {
  try {
    await applyBackupToDatabase(backupData);
    return { success: true, message: 'Yedek başarıyla geri yüklendi!' };
  } catch (err: any) {
    return { success: false, message: `Geri yükleme başarısız: ${err?.message || 'Bilinmeyen hata'}` };
  }
}

export async function importDatabaseFromJSON(file: File, password?: string): Promise<{ success: boolean; message: string }> {
  const check = await inspectBackupFile(file);
  if (!check.valid || !check.data) {
    return { success: false, message: check.error || 'Geçersiz yedek dosyası!' };
  }

  if (check.isEncrypted) {
    if (!password) {
      return { success: false, message: 'Bu dosya şifrelenmiştir. Lütfen şifrenizi girin.' };
    }
    return restoreEncryptedBackup(check.data, password);
  }

  return restorePlainBackup(check.data);
}

export async function resetToSampleData(): Promise<void> {
  await db.settings.delete('userClearedData');
  await forceResetWithDummyData();
  await db.settings.put({ key: 'dummyDataVersion', value: 6 });
  touchLastModified();
}

export async function clearAllDatabaseData(): Promise<void> {
  await db.transaction('rw', [
    db.groups,
    db.accounts,
    db.cashFlowEntries,
    db.transactions,
    db.investmentPlans,
    db.marketRates,
    db.settings
  ], async () => {
    await db.groups.clear();
    await db.accounts.clear();
    await db.cashFlowEntries.clear();
    await db.transactions.clear();
    await db.investmentPlans.clear();
    await db.marketRates.where('category').equals('FUND').delete();

    const pinHash = await db.settings.get('pinHash');
    const pinLength = await db.settings.get('pinLength');
    const biometricsEnabled = await db.settings.get('biometricsEnabled');
    const autoLockMinutes = await db.settings.get('autoLockMinutes');

    await db.settings.clear();

    if (pinHash) await db.settings.put(pinHash);
    if (pinLength) await db.settings.put(pinLength);
    if (biometricsEnabled) await db.settings.put(biometricsEnabled);
    if (autoLockMinutes) await db.settings.put(autoLockMinutes);

    await db.settings.put({ key: 'userClearedData', value: true });
    await db.settings.put({ key: 'dummyDataVersion', value: 6 });
  });
  touchLastModified();
}
