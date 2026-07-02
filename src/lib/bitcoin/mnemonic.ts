import * as bip39 from 'bip39';

export function generateMnemonic(): string {
  return bip39.generateMnemonic(128); // 128 bits = 12 words
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

export function mnemonicToWords(mnemonic: string): string[] {
  return mnemonic.trim().split(/\s+/);
}
