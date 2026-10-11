import { db, getLastModifiedTimestamp } from '../db/db';
import { 
  restorePlainBackup, 
  restoreEncryptedBackup,
  decryptBackupPayload,
  smartMergeBackupToDatabase
} from './exportService';
import { encryptData } from './cryptoService';
import { getSessionPin } from './securityService';
import { compareTimestamps } from '../utils/dateUtils';

declare global {
  interface Window {
    google?: any;
  }
}

const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const SYNC_FILE_NAME = 'bizimkasa-sync.json';
const STORAGE_KEY_TOKEN = 'bizimkasa_gdrive_token';
const STORAGE_KEY_TOKEN_EXP = 'bizimkasa_gdrive_token_exp';
const STORAGE_KEY_CLIENT_ID = 'bizimkasa_gdrive_client_id';
const STORAGE_KEY_USER_EMAIL = 'bizimkasa_gdrive_user_email';

export interface GDriveSyncStatus {
  isConnected: boolean;
  userEmail?: string;
  lastCloudSync?: string;
  lastCloudModifiedAt?: string;
  isCloudEncrypted?: boolean;
}

// 1. Google Identity Services scriptini yükle
export async function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return;

  return new Promise((resolve, reject) => {
    const existing = document.getElementById('google-gsi-client');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google kimlik doğrulama betiği yüklenemedi. İnternet bağlantınızı kontrol edin.'));
    document.head.appendChild(script);
  });
}

export const DEFAULT_CLIENT_ID = '302808182936-n1q27j4acc1bc5atfam9jdj582mq31lf.apps.googleusercontent.com';

// 2. Client ID Yönetimi
export function getStoredClientId(): string {
  return localStorage.getItem(STORAGE_KEY_CLIENT_ID) || 
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || 
    DEFAULT_CLIENT_ID;
}

export function setStoredClientId(clientId: string): void {
  if (clientId.trim()) {
    localStorage.setItem(STORAGE_KEY_CLIENT_ID, clientId.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_CLIENT_ID);
  }
}

// 3. Token Yönetimi
export function getStoredAccessToken(): string | null {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  const expStr = localStorage.getItem(STORAGE_KEY_TOKEN_EXP);
  if (!token || !expStr) return null;
  const exp = parseInt(expStr, 10);
  if (Date.now() >= exp - 60000) {
    // Süresi dolmuş veya dolmak üzere
    return null;
  }
  return token;
}

export function saveAccessToken(token: string, expiresInSec: number) {
  const expTime = Date.now() + expiresInSec * 1000;
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  localStorage.setItem(STORAGE_KEY_TOKEN_EXP, expTime.toString());
}

export function disconnectGoogleDrive() {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_TOKEN_EXP);
  localStorage.removeItem(STORAGE_KEY_USER_EMAIL);
}

export function getConnectedUserEmail(): string | null {
  return localStorage.getItem(STORAGE_KEY_USER_EMAIL);
}

// 4. Token Talep Etme (Oturum Açma)
export async function requestGoogleAccessToken(promptConsent = false): Promise<string> {
  const existingToken = getStoredAccessToken();
  if (existingToken && !promptConsent) {
    return existingToken;
  }

  const clientId = getStoredClientId();
  if (!clientId) {
    throw new Error('Google OAuth Client ID bulunamadı. Lütfen Ayarlar sayfasından Client ID giriniz.');
  }

  await loadGsiScript();

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GDRIVE_SCOPE,
        prompt: promptConsent ? 'consent' : '',
        callback: async (response: any) => {
          if (response.error) {
            reject(new Error(`Google yetkilendirme hatası: ${response.error_description || response.error}`));
            return;
          }
          if (response.access_token) {
            saveAccessToken(response.access_token, response.expires_in || 3599);
            // Kullanıcı bilgilerini çekmeye çalışalım
            try {
              const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` }
              });
              if (userRes.ok) {
                const userData = await userRes.json();
                if (userData.email) {
                  localStorage.setItem(STORAGE_KEY_USER_EMAIL, userData.email);
                }
              }
            } catch {
              // Profil bilgisi alınamazsa eşitlemeyi engelleme
            }
            resolve(response.access_token);
          } else {
            reject(new Error('Erişim belirteci alınamadı.'));
          }
        }
      });

      tokenClient.requestAccessToken({ prompt: promptConsent ? 'consent' : '' });
    } catch (err: any) {
      reject(new Error(`Google oturum başlatılamadı: ${err?.message || err}`));
    }
  });
}

// 5. Google Drive AppData Alanındaki Dosyayı Bulma
async function findSyncFile(accessToken: string): Promise<{ id: string; modifiedTime: string } | null> {
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${SYNC_FILE_NAME}' and trashed=false&fields=files(id,name,modifiedTime)`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    if (res.status === 401) {
      disconnectGoogleDrive();
      throw new Error('Google oturum süresi doldu. Lütfen tekrar bağlanın.');
    }
    throw new Error(`Google Drive dosyası aranamadı (${res.status})`);
  }
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return {
      id: data.files[0].id,
      modifiedTime: data.files[0].modifiedTime
    };
  }
  return null;
}

// 6. Veritabanını Toplama (Helper)
async function getDbPayload(password?: string): Promise<string> {
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

  const backupData = {
    version: 1,
    exportDate: new Date().toISOString(),
    lastModifiedAt,
    app: 'BizimKasa' as const,
    groups,
    accounts,
    cashFlowEntries,
    transactions,
    marketRates,
    investmentPlans,
    settings,
    deletedRecords
  };

  if (password && password.trim().length > 0) {
    const rawJson = JSON.stringify(backupData);
    const payload = await encryptData(rawJson, password);
    return JSON.stringify({
      version: 1,
      exportDate: new Date().toISOString(),
      lastModifiedAt,
      app: 'BizimKasa',
      encrypted: true,
      crypto: payload,
      ciphertext: payload.ciphertext
    }, null, 2);
  }

  return JSON.stringify(backupData, null, 2);
}

// 7. Google Drive'a Yükleme (Upload/Sync)
export async function uploadToGoogleDrive(password?: string): Promise<{ success: boolean; modifiedTime: string }> {
  const token = await requestGoogleAccessToken();
  const content = await getDbPayload(password);
  const existingFile = await findSyncFile(token);

  if (existingFile) {
    // Mevcut dosyanın içeriğini güncelle (media upload)
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
    const res = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: content
    });

    if (!res.ok) {
      throw new Error(`Drive güncelleme başarısız (${res.status}): ${await res.text()}`);
    }
    const updated = await res.json();
    return { success: true, modifiedTime: updated.modifiedTime || new Date().toISOString() };
  } else {
    // Yeni dosya oluştur (multipart upload)
    const metadata = {
      name: SYNC_FILE_NAME,
      parents: ['appDataFolder']
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      content +
      closeDelimiter;

    const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const res = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!res.ok) {
      throw new Error(`Drive dosyası oluşturulamadı (${res.status}): ${await res.text()}`);
    }
    const created = await res.json();
    return { success: true, modifiedTime: created.modifiedTime || new Date().toISOString() };
  }
}

// 8. Google Drive'dan İndirme ve İnceleme
export async function fetchFromGoogleDrive(): Promise<{
  fileData: any;
  isEncrypted: boolean;
  lastModifiedAt: string;
  exportDate: string;
} | null> {
  const token = await requestGoogleAccessToken();
  const existingFile = await findSyncFile(token);
  if (!existingFile) {
    return null; // Henüz Drive'da yedek dosyası yok
  }

  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`;
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`Drive verisi indirilemedi (${res.status})`);
  }

  const text = await res.text();
  const data = JSON.parse(text);

  if (data.app !== 'BizimKasa') {
    throw new Error('Google Drive’daki dosya geçerli bir BizimKasa yedeği değil!');
  }

  const isEncrypted = Boolean(data.encrypted);
  const lastMod = data.lastModifiedAt || data.exportDate || existingFile.modifiedTime;

  return {
    fileData: data,
    isEncrypted,
    lastModifiedAt: lastMod,
    exportDate: data.exportDate || existingFile.modifiedTime
  };
}

// 9. Drive Verisini Geri Yükleme
export async function restoreFromGoogleDrive(fileData: any, password?: string): Promise<{ success: boolean; message: string }> {
  if (fileData.encrypted) {
    if (!password) {
      throw new Error('Bu yedek şifrelenmiştir. Lütfen şifrenizi girin.');
    }
    return restoreEncryptedBackup(fileData, password);
  }
  return restorePlainBackup(fileData);
}

// 10. Otomatik Eşitleme (Tam Senkronizasyon)
const STORAGE_KEY_LAST_SYNC = 'bizimkasa_gdrive_last_sync';

export function getLastSyncTime(): string | null {
  return localStorage.getItem(STORAGE_KEY_LAST_SYNC);
}

export function setLastSyncTime(iso: string): void {
  localStorage.setItem(STORAGE_KEY_LAST_SYNC, iso);
}

export interface AutoSyncResult {
  action: 'none' | 'uploaded' | 'downloaded' | 'prompt_pin' | 'error';
  message: string;
  remoteTime?: string;
  remoteData?: any;
  error?: any;
}

let isSyncInProgress = false;

export function getIsSyncInProgress(): boolean {
  return isSyncInProgress;
}

export async function syncWithGoogleDrive(explicitPin?: string): Promise<AutoSyncResult> {
  if (isSyncInProgress) {
    return { action: 'none', message: 'Eşitleme zaten devam ediyor.' };
  }

  const token = getStoredAccessToken();
  if (!token) {
    return { action: 'none', message: 'Google Drive bağlı değil.' };
  }

  isSyncInProgress = true;
  try {
    const localLastMod = await getLastModifiedTimestamp();
    const remote = await fetchFromGoogleDrive();

    // 1. Bulutta henüz hiç dosya yoksa -> Yereli yükle
    if (!remote) {
      const pinToUse = explicitPin || getSessionPin() || undefined;
      const res = await uploadToGoogleDrive(pinToUse);
      setLastSyncTime(res.modifiedTime);
      return { action: 'uploaded', message: 'İlk bulut yedeği yüklendi.' };
    }

    // 2. Karşılaştır
    const comparison = compareTimestamps(localLastMod, remote.lastModifiedAt);

    if (comparison === 'equal') {
      setLastSyncTime(new Date().toISOString());
      return { action: 'none', message: 'Verileriniz bulut ile güncel.' };
    }

    // Bulutta veri var ve zaman damgaları farklı: Akıllı Birleştirme (Smart Merge)
    let remotePayload: any = null;
    const pinToUse = explicitPin || getSessionPin();

    if (remote.isEncrypted) {
      if (!pinToUse) {
        return {
          action: 'prompt_pin',
          remoteTime: remote.lastModifiedAt,
          remoteData: remote.fileData,
          message: 'Bulutta yeni veriler var. Şifreyi çözmek için PIN kodu gerekiyor.'
        };
      }

      try {
        remotePayload = await decryptBackupPayload(remote.fileData, pinToUse);
      } catch {
        return {
          action: 'prompt_pin',
          remoteTime: remote.lastModifiedAt,
          remoteData: remote.fileData,
          message: 'Buluttaki yedeğin PIN kodu farklı. Lütfen yedeğin PIN kodunu girin.'
        };
      }
    } else {
      remotePayload = remote.fileData;
    }

    // Akıllı birleştirmeyi veritabanına uygula (Tombstone + ID bazlı birleştirme)
    const mergeRes = await smartMergeBackupToDatabase(remotePayload);
    if (!mergeRes.success) {
      return { action: 'error', message: mergeRes.message };
    }

    // Birleşmiş ana kopyayı Google Drive'a da geri yükle (her iki taraf da tam eşitlensin)
    const uploadRes = await uploadToGoogleDrive(pinToUse || undefined);
    setLastSyncTime(uploadRes.modifiedTime || new Date().toISOString());

    if (comparison === 'older') {
      return {
        action: 'downloaded',
        remoteTime: remote.lastModifiedAt,
        message: 'Buluttaki veriler akıllı birleştirme ile başarıyla eşitlendi.'
      };
    } else {
      return {
        action: 'uploaded',
        message: 'Verileriniz bulutla birleştirilerek güncellendi.'
      };
    }
  } catch (err: any) {
    console.warn('Auto-sync hatası:', err);
    return { action: 'error', message: err?.message || 'Eşitleme hatası.', error: err };
  } finally {
    isSyncInProgress = false;
  }
}

