import { db } from '../db/db';
import type { AppSettings } from '../types/finance';

// SHA-256 hash for secure local PIN storage
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`bizimkasa_salt_${pin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const hash = await hashPin(pin);
  return hash === storedHash;
}

// Check if WebAuthn (FaceID / TouchID / Windows Hello) is supported
export async function isBiometricsAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Register Biometrics (Local dummy credential for device authentication)
export async function registerBiometrics(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'BizimKasa', id: window.location.hostname },
        user: {
          id: new Uint8Array([1, 2, 3, 4]),
          name: 'bizimkasa_user',
          displayName: 'BizimKasa Kullanıcısı'
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required'
        },
        timeout: 60000
      }
    });

    if (credential) {
      // Save credential ID or confirmation in settings
      const settingsRecord = await db.settings.get('appSettings');
      if (settingsRecord) {
        settingsRecord.value.biometricsEnabled = true;
        await db.settings.put(settingsRecord);
      }
      return true;
    }
  } catch (err) {
    console.warn('Biometric registration error or cancelled:', err);
  }
  return false;
}

// Authenticate via Biometrics (FaceID / TouchID)
export async function authenticateWithBiometrics(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname
      }
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
