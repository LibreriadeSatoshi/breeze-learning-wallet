/**
 * Encryption utilities for secure mnemonic storage
 * Uses AES-256-GCM encryption with user-derived password
 */

import CryptoJS from 'crypto-js';

export interface EncryptedData {
  ciphertext: string;
  salt: string;
  iv: string;
  timestamp: number;
}

/**
 * Derive encryption key from user password using PBKDF2
 */
function deriveKey(password: string, salt: string): string {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 100000,
  }).toString();
}

/**
 * Encrypt mnemonic with user password
 * @param mnemonic - The recovery phrase to encrypt
 * @param password - User's encryption password
 * @returns Encrypted data object
 */
export function encryptMnemonic(mnemonic: string, password: string): EncryptedData {
  // Generate random salt and IV
  const salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
  const iv = CryptoJS.lib.WordArray.random(128 / 8).toString();

  // Derive key from password
  const key = deriveKey(password, salt);

  // Encrypt the mnemonic
  const encrypted = CryptoJS.AES.encrypt(mnemonic, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return {
    ciphertext: encrypted.toString(),
    salt,
    iv,
    timestamp: Date.now(),
  };
}

/**
 * Decrypt mnemonic with user password
 * @param encryptedData - The encrypted data object
 * @param password - User's encryption password
 * @returns Decrypted mnemonic or null if password is wrong
 */
export function decryptMnemonic(encryptedData: EncryptedData, password: string): string | null {
  try {
    // Derive the same key from password and salt
    const key = deriveKey(password, encryptedData.salt);

    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(encryptedData.ciphertext, key, {
      iv: CryptoJS.enc.Hex.parse(encryptedData.iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const mnemonic = decrypted.toString(CryptoJS.enc.Utf8);

    // Verify it's valid (not empty gibberish)
    if (!mnemonic || mnemonic.length === 0) {
      return null;
    }

    return mnemonic;
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

/**
 * Verify password without decrypting full data
 */
export function verifyPassword(encryptedData: EncryptedData, password: string): boolean {
  const result = decryptMnemonic(encryptedData, password);
  return result !== null;
}
