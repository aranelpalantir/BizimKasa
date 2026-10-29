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
  deletedRecords?: any[];
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
  const deletedRecords = await db.deletedRecords.toArray().catch(() => []);

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
    settings,
    deletedRecords
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
      db.settings,
      db.deletedRecords
    ], async () => {
      await db.groups.clear();
      await db.accounts.clear();
      await db.cashFlowEntries.clear();
      await db.transactions.clear();
      await db.marketRates.clear();
      await db.investmentPlans.clear();
      await db.settings.clear();
      await db.deletedRecords.clear();

      if (data.groups.length > 0) await db.groups.bulkAdd(data.groups);
      if (data.accounts.length > 0) await db.accounts.bulkAdd(data.accounts);
      if (data.cashFlowEntries?.length > 0) await db.cashFlowEntries.bulkAdd(data.cashFlowEntries);
      if (data.transactions?.length > 0) await db.transactions.bulkAdd(data.transactions);
      if (data.marketRates?.length > 0) await db.marketRates.bulkAdd(data.marketRates);
      if (data.investmentPlans?.length > 0) await db.investmentPlans.bulkAdd(data.investmentPlans);
      if (data.settings?.length > 0) await db.settings.bulkAdd(data.settings);
      if (data.deletedRecords && data.deletedRecords.length > 0) {
        await db.deletedRecords.bulkAdd(data.deletedRecords);
      }
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

/**
 * Akıllı Kayıt Birleştirme (Smart Merge):
 * Veritabanını körü körüne ezmek yerine; gelen yedek ile bu cihazdaki verileri
 * benzersiz kimlik (ID), silinme kayıtları (Tombstones) ve en son güncellenme tarihine göre birleştirir.
 */
export async function smartMergeBackupToDatabase(
  remoteData: BizimKasaBackup
): Promise<{ success: boolean; message: string; mergedLastModified: string }> {
  if (remoteData.app !== 'BizimKasa' || !Array.isArray(remoteData.groups) || !Array.isArray(remoteData.accounts)) {
    throw new Error('Geçersiz yedek dosyası formatı! BizimKasa yedeği seçiniz.');
  }

  setSuppressModificationTracking(true);
  try {
    const mergedLastModified = new Date().toISOString();

    await db.transaction('rw', [
      db.groups,
      db.accounts,
      db.cashFlowEntries,
      db.transactions,
      db.marketRates,
      db.investmentPlans,
      db.settings,
      db.deletedRecords
    ], async () => {
      // 1. Mevcut yerel tabloları çek
      const localGroups = await db.groups.toArray();
      const localAccounts = await db.accounts.toArray();
      const localEntries = await db.cashFlowEntries.toArray();
      const localTxs = await db.transactions.toArray();
      const localPlans = await db.investmentPlans.toArray();
      const localRates = await db.marketRates.toArray();
      const localSettings = await db.settings.toArray();
      const localDeletions = await db.deletedRecords.toArray();

      // 2. Silinme Damgalarını (Tombstones) Birleştir
      const tombstoneMap = new Map<string, { id: string; recordId: string; tableName: string; deletedAt: string }>();
      for (const d of localDeletions) {
        tombstoneMap.set(d.id, d);
      }
      for (const d of (remoteData.deletedRecords || [])) {
        const existing = tombstoneMap.get(d.id);
        if (!existing || new Date(d.deletedAt).getTime() > new Date(existing.deletedAt).getTime()) {
          tombstoneMap.set(d.id, d);
        }
      }

      const mergedTombstones = Array.from(tombstoneMap.values());
      await db.deletedRecords.clear();
      if (mergedTombstones.length > 0) {
        await db.deletedRecords.bulkAdd(mergedTombstones);
      }

      function isDeleted(tableName: string, id: string, itemTimestamp?: string): boolean {
        const t = tombstoneMap.get(`${tableName}:${id}`);
        if (!t) return false;
        if (!itemTimestamp) return true;
        const itemMs = new Date(itemTimestamp).getTime();
        const tombMs = new Date(t.deletedAt).getTime();
        return tombMs >= itemMs;
      }

      function mergeEntities<T extends { id: string }>(
        tableName: string,
        localList: T[],
        remoteList: T[],
        getTimestamp: (item: T) => string | undefined
      ): T[] {
        const map = new Map<string, T>();

        for (const item of localList) {
          const ts = getTimestamp(item);
          if (!isDeleted(tableName, item.id, ts)) {
            map.set(item.id, item);
          }
        }

        for (const item of remoteList) {
          const ts = getTimestamp(item);
          if (isDeleted(tableName, item.id, ts)) {
            map.delete(item.id);
            continue;
          }

          const existing = map.get(item.id);
          if (!existing) {
            map.set(item.id, item);
          } else {
            const localTs = getTimestamp(existing);
            const remoteTs = ts;
            if (!localTs && remoteTs) {
              map.set(item.id, item);
            } else if (localTs && remoteTs) {
              const localMs = new Date(localTs).getTime();
              const remoteMs = new Date(remoteTs).getTime();
              if (remoteMs > localMs) {
                map.set(item.id, item);
              }
            } else {
              map.set(item.id, item);
            }
          }
        }

        return Array.from(map.values());
      }

      // Varlıkları birleştir
      const mergedGroups = mergeEntities(
        'groups',
        localGroups,
        remoteData.groups || [],
        (g: any) => g.updatedAt || g.createdAt
      );

      const mergedAccounts = mergeEntities(
        'accounts',
        localAccounts,
        remoteData.accounts || [],
        (a: any) => a.updatedAt || a.createdAt
      );

      const mergedTxs = mergeEntities(
        'transactions',
        localTxs,
        remoteData.transactions || [],
        (t: any) => t.updatedAt || t.createdAt || t.date
      );

      const mergedEntries = mergeEntities(
        'cashFlowEntries',
        localEntries,
        remoteData.cashFlowEntries || [],
        (e: any) => e.updatedAt || e.createdAt
      );

      const mergedPlans = mergeEntities(
        'investmentPlans',
        localPlans,
        remoteData.investmentPlans || [],
        (p: any) => p.updatedAt || p.createdAt
      );

      // Kurları birleştir
      const rateMap = new Map<string, any>();
      for (const r of localRates) rateMap.set(r.symbol, r);
      for (const r of (remoteData.marketRates || [])) {
        const existing = rateMap.get(r.symbol);
        if (!existing) {
          rateMap.set(r.symbol, r);
        } else {
          const localDateStr = existing.updatedAt || existing.lastUpdated;
          const remoteDateStr = r.updatedAt || r.lastUpdated;
          const localMs = localDateStr ? new Date(localDateStr).getTime() : 0;
          const remoteMs = remoteDateStr ? new Date(remoteDateStr).getTime() : 0;
          if (remoteMs > localMs) {
            rateMap.set(r.symbol, r);
          } else if (remoteMs === localMs) {
            // Zaman damgaları eşitse, manuel girişi veya tanımlı fiyatı tercih et
            const remoteHasValue = (r.isManualOverride || r.category === 'FUND') && (r.rateTRY > 0);
            const localHasValue = (existing.isManualOverride || existing.category === 'FUND') && (existing.rateTRY > 0);
            if (remoteHasValue && !localHasValue) {
              rateMap.set(r.symbol, r);
            }
          }
        }
      }
      const mergedRates = Array.from(rateMap.values());

      // Ayarları birleştir
      const settingsMap = new Map<string, any>();
      for (const s of localSettings) settingsMap.set(s.key, s.value);
      for (const s of (remoteData.settings || [])) {
        if (s.key === 'appSettings') {
          const localApp = settingsMap.get('appSettings') || {};
          const remoteApp = s.value || {};
          // Biyometrik sensör ve geçiş anahtarı donanım bazlı olduğu için yerel cihazın ayarını koru
          settingsMap.set('appSettings', { 
            ...localApp, 
            ...remoteApp,
            biometricsEnabled: localApp.biometricsEnabled ?? false,
            biometricCredentialId: localApp.biometricCredentialId
          });
        } else if (s.key !== 'lastModifiedAt' && s.key !== 'lastImportedAt') {
          if (!settingsMap.has(s.key)) settingsMap.set(s.key, s.value);
        }
      }

      // Veritabanına temiz ve atomik olarak yaz
      await db.groups.clear();
      if (mergedGroups.length > 0) await db.groups.bulkAdd(mergedGroups);

      await db.accounts.clear();
      if (mergedAccounts.length > 0) await db.accounts.bulkAdd(mergedAccounts);

      await db.transactions.clear();
      if (mergedTxs.length > 0) await db.transactions.bulkAdd(mergedTxs);

      await db.cashFlowEntries.clear();
      if (mergedEntries.length > 0) await db.cashFlowEntries.bulkAdd(mergedEntries);

      await db.investmentPlans.clear();
      if (mergedPlans.length > 0) await db.investmentPlans.bulkAdd(mergedPlans);

      await db.marketRates.clear();
      if (mergedRates.length > 0) await db.marketRates.bulkAdd(mergedRates);

      await db.settings.clear();
      const settingsRecords = Array.from(settingsMap.entries()).map(([key, value]) => ({ key, value }));
      if (settingsRecords.length > 0) await db.settings.bulkAdd(settingsRecords);

      await db.settings.delete('userClearedData');
      await db.settings.put({ key: 'lastModifiedAt', value: mergedLastModified });
      await db.settings.put({ key: 'lastImportedAt', value: new Date().toISOString() });
    });

    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('bizimkasa_bypass_lock_once', 'true');
    }

    return {
      success: true,
      message: 'Veriler akıllı birleştirme ile başarıyla eşitlendi!',
      mergedLastModified
    };
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

export async function decryptBackupPayload(fileData: any, password: string): Promise<BizimKasaBackup> {
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
  if (!decryptedData.lastModifiedAt && fileData.lastModifiedAt) {
    decryptedData.lastModifiedAt = fileData.lastModifiedAt;
  }
  return decryptedData;
}

export async function restoreEncryptedBackup(fileData: any, password: string): Promise<{ success: boolean; message: string }> {
  try {
    const decryptedData = await decryptBackupPayload(fileData, password);
    await applyBackupToDatabase(decryptedData);
    return { success: true, message: 'Şifreli yedek başarıyla çözüldü ve tüm veriler geri yüklendi!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Şifre çözme veya geri yükleme başarısız oldu.' };
  }
}

export async function restorePlainBackup(backupData: BizimKasaBackup): Promise<{ success: boolean; message: string }> {
  try {
    await applyBackupToDatabase(backupData);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('bizimkasa_bypass_lock_once', 'true');
    }
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
