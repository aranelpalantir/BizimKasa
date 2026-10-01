export interface EncryptedPayload {
  algorithm: 'AES-GCM-256';
  keyDerivation: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export function bufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptData(plaintext: string, password: string): Promise<EncryptedPayload> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Tarayıcınız Web Crypto API şifreleme desteği sunmuyor veya güvenli bağlantıda (HTTPS) değilsiniz.');
  }

  const salt = new Uint8Array(16);
  window.crypto.getRandomValues(salt);

  const iv = new Uint8Array(12);
  window.crypto.getRandomValues(iv);

  const iterations = 100000;
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    aesKey,
    enc.encode(plaintext)
  );

  return {
    algorithm: 'AES-GCM-256',
    keyDerivation: 'PBKDF2-SHA256',
    iterations,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(new Uint8Array(encryptedBuffer))
  };
}

export async function decryptData(payload: EncryptedPayload, password: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Tarayıcınız Web Crypto API şifreleme desteği sunmuyor veya güvenli bağlantıda (HTTPS) değilsiniz.');
  }

  try {
    const salt = base64ToBuffer(payload.salt);
    const iv = base64ToBuffer(payload.iv);
    const ciphertext = base64ToBuffer(payload.ciphertext);

    const enc = new TextEncoder();
    const passwordKey = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const aesKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as Uint8Array<ArrayBuffer>,
        iterations: payload.iterations || 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as Uint8Array<ArrayBuffer>
      },
      aesKey,
      ciphertext as Uint8Array<ArrayBuffer>
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err: any) {
    console.warn('Decryption failed:', err);
    throw new Error('Yedek şifresi hatalı veya dosya bozuk!');
  }
}
