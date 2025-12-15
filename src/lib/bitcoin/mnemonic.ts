/**
 * Mnemonic and wallet generation utilities
 */

import * as bip39 from 'bip39';

export interface MnemonicResult {
  mnemonic: string;
  seed: Uint8Array;
}

/**
 * Generate a new 12-word mnemonic phrase
 */
export function generateMnemonic(): string {
  return bip39.generateMnemonic(128); // 128 bits = 12 words
}

/**
 * Validate a mnemonic phrase
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Convert mnemonic to seed
 */
export async function mnemonicToSeed(mnemonic: string, passphrase: string = ''): Promise<Uint8Array> {
  const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);
  return new Uint8Array(seed);
}

/**
 * Generate mnemonic and seed
 */
export async function generateMnemonicAndSeed(passphrase: string = ''): Promise<MnemonicResult> {
  const mnemonic = generateMnemonic();
  const seed = await mnemonicToSeed(mnemonic, passphrase);

  return {
    mnemonic,
    seed,
  };
}

/**
 * Split mnemonic into word array
 */
export function mnemonicToWords(mnemonic: string): string[] {
  return mnemonic.trim().split(/\s+/);
}

/**
 * Join word array into mnemonic
 */
export function wordsToMnemonic(words: string[]): string {
  return words.join(' ');
}
