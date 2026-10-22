/// <reference lib="webworker" />

import { decrypt, encrypt } from "./vault-cipher";

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
