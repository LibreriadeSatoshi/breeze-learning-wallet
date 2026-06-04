import * as bip39 from 'bip39';

export interface MnemonicResult {
  mnemonic: string;
  seed: Uint8Array;
}

export function generateMnemonic(): string {
  return bip39.generateMnemonic(128); // 128 bits = 12 words
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

export async function mnemonicToSeed(mnemonic: string, passphrase: string = ''): Promise<Uint8Array> {
  const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);
  return new Uint8Array(seed);
}

export async function generateMnemonicAndSeed(passphrase: string = ''): Promise<MnemonicResult> {
  const mnemonic = generateMnemonic();
  const seed = await mnemonicToSeed(mnemonic, passphrase);

  return {
    mnemonic,
    seed,
  };
}

export function mnemonicToWords(mnemonic: string): string[] {
  return mnemonic.trim().split(/\s+/);
}

export function wordsToMnemonic(words: string[]): string {
  return words.join(' ');
}
