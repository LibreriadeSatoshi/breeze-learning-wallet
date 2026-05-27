/// <reference lib="webworker" />

import { argon2id } from "hash-wasm";

const VERSION = 1;
const SALT_LEN = 16;
const NONCE_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

const ARGON2_PARAMS = {
  parallelism: 4,
  memorySize: 64 * 1024,
  iterations: 3,
  hashLength: KEY_LEN,
};

type EncryptRequest = { type: "encrypt"; plaintext: string; password: string };
type DecryptRequest = { type: "decrypt"; blob: Uint8Array; password: string };
type WorkerRequest = EncryptRequest | DecryptRequest;

type EncryptResponse = { ok: true; type: "encrypt"; result: Uint8Array };
type DecryptResponse = { ok: true; type: "decrypt"; result: string };
type ErrorResponse = { ok: false; error: string };
type WorkerResponse = EncryptResponse | DecryptResponse | ErrorResponse;

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  try {
    if (e.data.type === "encrypt") {
      const blob = await encrypt(e.data.plaintext, e.data.password);
      const resp: WorkerResponse = { ok: true, type: "encrypt", result: blob };
      workerScope.postMessage(resp, [blob.buffer]);
      return;
    }
    const plaintext = await decrypt(e.data.blob, e.data.password);
    const resp: WorkerResponse = { ok: true, type: "decrypt", result: plaintext };
    workerScope.postMessage(resp);
  } catch {
    const resp: WorkerResponse = { ok: false, error: "Crypto operation failed" };
    workerScope.postMessage(resp);
  }
};

type Bytes = Uint8Array<ArrayBuffer>;

async function encrypt(plaintext: string, password: string): Promise<Bytes> {
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

async function decrypt(blob: Uint8Array, password: string): Promise<string> {
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

async function deriveKey(password: string, salt: Bytes): Promise<CryptoKey> {
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
