import { db } from '../db/db';
import type { AppSettings } from '../types/finance';

// Pure JavaScript SHA-256 fallback (Ensures 100% reliable hashing on HTTP, iOS Safari, and non-secure contexts)
function sha256Pure(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const lengthProperty = 'length';
  let i = 0, j = 0;
  let result = '';

  const words: number[] = [];

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let utf8 = ascii;
  try {
    utf8 = unescape(encodeURIComponent(ascii));
  } catch {
    utf8 = ascii;
  }

  const utf8BitLength = utf8[lengthProperty] * 8;
  for (i = 0; i < utf8[lengthProperty]; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  words[utf8BitLength >> 5] |= 0x80 << (24 - (utf8BitLength % 32));
  words[(((utf8BitLength + 64) >> 9) << 4) + 15] = utf8BitLength;

  for (i = 0; i < words[lengthProperty]; i += 16) {
    const w = words.slice(i, i + 16);
    const oldHash = hash.slice(0);

    for (j = 0; j < 64; j++) {
      const w15 = w[j - 15], w2 = w[j - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[j] = (j < 16) ? (w[j] || 0) : ((w[j - 16] + s0 + (w[j - 7] || 0) + s1) | 0);

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp1 = (hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[j] + w[j]) | 0;
      const temp2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const byte = (hash[i] >> (j * 8)) & 255;
      result += byte.toString(16).padStart(2, '0');
    }
  }

  return result;
}

// SHA-256 hash for secure local PIN storage with fallback
export async function hashPin(pin: string): Promise<string> {
  const salted = `bizimkasa_salt_${pin}`;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(salted);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to pure JS fallback
    }
  }
  return sha256Pure(salted);
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const hash = await hashPin(pin);
  return hash === storedHash;
}

// Check if WebAuthn (FaceID / TouchID / Windows Hello) is supported and secure context
export async function isBiometricsAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  if (!window.PublicKeyCredential) return false;

  const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(window.location.hostname);
  if (isIpAddress) return false;

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ArrayBuffer to Base64 (Standard binary-safe)
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Base64 to ArrayBuffer (BufferSource for WebAuthn)
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  let normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) {
    normalized += '=';
  }
  const binary = atob(normalized);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

export interface BiometricResult {
  success: boolean;
  credentialId?: string;
  errorReason?: string;
}

// Register Biometrics (Local dummy credential for device authentication)
export async function registerBiometrics(): Promise<BiometricResult> {
  if (typeof window === 'undefined') {
    return { success: false, errorReason: 'Tarayıcı ortamı algılanamadı.' };
  }

  // Apple & Web standards require a Secure Context (HTTPS or localhost)
  if (!window.isSecureContext) {
    return {
      success: false,
      errorReason: 'FaceID / TouchID, Apple ve tarayıcı güvenlik kuralları gereği yalnızca HTTPS bağlantısında (Cloudflare Pages vb.) çalışır. Yerel HTTP ağında kullanılamaz.'
    };
  }

  if (!window.PublicKeyCredential) {
    return {
      success: false,
      errorReason: 'Cihazınız veya tarayıcınız WebAuthn biyometrik doğrulamasını desteklemiyor.'
    };
  }

  const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(window.location.hostname);
  if (isIpAddress) {
    return {
      success: false,
      errorReason: 'Biyometrik kilit IP adresi üzerinden çalışamaz. Alan adı (domain) veya HTTPS (örn: Cloudflare Pages) gereklidir.'
    };
  }

  try {
    const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!isAvailable) {
      return {
        success: false,
        errorReason: 'Cihazınızda FaceID / TouchID / Windows Hello sensörü bulunamadı veya etkin değil.'
      };
    }
  } catch {
    // Continue attempt
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'BizimKasa', id: window.location.hostname },
        user: {
          id: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
          name: 'bizimkasa_user',
          displayName: 'BizimKasa Kullanıcısı'
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },  // ES256 (Apple Secure Enclave native)
          { alg: -257, type: 'public-key' } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'required',
          requireResidentKey: true,
          userVerification: 'required'
        },
        attestation: 'none',
        timeout: 60000
      }
    })) as PublicKeyCredential | null;

    if (credential && credential.rawId) {
      const credIdBase64 = bufferToBase64(credential.rawId);
      const settingsRecord = await db.settings.get('appSettings');
      if (settingsRecord) {
        settingsRecord.value.biometricsEnabled = true;
        settingsRecord.value.biometricCredentialId = credIdBase64;
        await db.settings.put(settingsRecord);
      }
      return { success: true, credentialId: credIdBase64 };
    }
    return { success: false, errorReason: 'Biyometrik doğrulama onaylanmadı.' };
  } catch (err: any) {
    console.warn('Biometric registration error:', err);
    if (err?.name === 'NotAllowedError') {
      return { success: false, errorReason: 'Biyometrik doğrulama isteği iptal edildi veya reddedildi.' };
    }
    return { success: false, errorReason: err?.message || 'Biyometrik kayıt başarısız oldu.' };
  }
}

// Authenticate via Biometrics (FaceID / TouchID)
export async function authenticateWithBiometrics(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.isSecureContext || !window.PublicKeyCredential) {
    return false;
  }

  const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(window.location.hostname);
  if (isIpAddress) return false;

  const settings = await getSettings();

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: 'required',
      rpId: window.location.hostname
    };

    if (settings.biometricCredentialId) {
      try {
        const credIdBuffer = base64ToArrayBuffer(settings.biometricCredentialId);
        publicKeyOptions.allowCredentials = [
          {
            id: credIdBuffer,
            type: 'public-key',
            transports: ['internal']
          }
        ];
      } catch (err) {
        console.warn('Error decoding biometricCredentialId:', err);
      }
    }

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyOptions
    });

    return !!assertion;
  } catch (err) {
    console.warn('Biometric auth failed or dismissed:', err);
    return false;
  }
}

export async function getSettings(): Promise<AppSettings> {
  const record = await db.settings.get('appSettings');
  if (record && record.value) {
    return record.value as AppSettings;
  }
  return {
    biometricsEnabled: false,
    autoLockMinutes: 5,
    lastActiveTimestamp: Date.now(),
    isLocked: false,
    defaultCurrency: 'TRY',
    hideValuesOnScreen: false
  };
}

export async function updateSettings(newSettings: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...newSettings };
  await db.settings.put({ key: 'appSettings', value: updated });
}
