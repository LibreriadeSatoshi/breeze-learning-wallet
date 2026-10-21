import { argon2id } from "hash-wasm";

export const VERSION = 1;
export const SALT_LEN = 16;
export const NONCE_LEN = 12;
export const TAG_LEN = 16;
const KEY_LEN = 32;

const ARGON2_PARAMS = {
  parallelism: 4,
  memorySize: 64 * 1024,
  iterations: 3,
  hashLength: KEY_LEN,
};

type Bytes = Uint8Array<ArrayBuffer>;

export async function encrypt(plaintext: string, password: string): Promise<Bytes> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN));
  const key = await deriveKey(password, salt);
  const aad = buildAad(VERSION, salt, nonce);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: aad },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  return concat([Uint8Array.of(VERSION), salt, nonce, ciphertext]);
}

export async function decrypt(blob: Uint8Array, password: string): Promise<string> {
  if (blob.length < 1 + SALT_LEN + NONCE_LEN + TAG_LEN) {
    throw new Error("Invalid vault blob");
  }
  const version = blob[0];
  if (version !== VERSION) {
    throw new Error("Unsupported vault version");
  }
  const salt = copy(blob, 1, 1 + SALT_LEN);
  const nonce = copy(blob, 1 + SALT_LEN, 1 + SALT_LEN + NONCE_LEN);
  const ciphertext = copy(blob, 1 + SALT_LEN + NONCE_LEN, blob.length);
  const key = await deriveKey(password, salt);
  const aad = buildAad(version, salt, nonce);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce, additionalData: aad },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

export async function deriveKey(password: string, salt: Bytes): Promise<CryptoKey> {
  const raw = await argon2id({
    password,
    salt,
    ...ARGON2_PARAMS,
    outputType: "binary",
  });
  return crypto.subtle.importKey(
    "raw",
    copy(raw, 0, raw.length),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function copy(src: Uint8Array, start: number, end: number): Bytes {
  const out = new Uint8Array(end - start);
  out.set(src.subarray(start, end));
  return out;
}

function buildAad(version: number, salt: Bytes, nonce: Bytes): Bytes {
  return concat([Uint8Array.of(version), salt, nonce]);
}

function concat(parts: Uint8Array[]): Bytes {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
