type EncryptRequest = { type: "encrypt"; plaintext: string; password: string };
type DecryptRequest = { type: "decrypt"; blob: Uint8Array; password: string };
type WorkerRequest = EncryptRequest | DecryptRequest;

type EncryptResponse = { ok: true; type: "encrypt"; result: Uint8Array };
type DecryptResponse = { ok: true; type: "decrypt"; result: string };
type ErrorResponse = { ok: false; error: string };
type WorkerResponse = EncryptResponse | DecryptResponse | ErrorResponse;

function runWorker(req: WorkerRequest): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./argon2-worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      worker.terminate();
      resolve(e.data);
    };

    worker.onerror = () => {
      worker.terminate();
      reject(new Error("Crypto worker error"));
    };

    worker.postMessage(req);
  });
}

export async function encryptMnemonic(
  plaintext: string,
  password: string,
): Promise<Uint8Array> {
  const resp = await runWorker({ type: "encrypt", plaintext, password });
  if (!resp.ok) throw new Error("Encryption failed");
  if (resp.type !== "encrypt") throw new Error("Unexpected worker response");
  return resp.result;
}

export async function decryptMnemonic(
  blob: Uint8Array,
  password: string,
): Promise<string> {
  const resp = await runWorker({ type: "decrypt", blob, password });
  if (!resp.ok) throw new Error("Wrong password or corrupted vault");
  if (resp.type !== "decrypt") throw new Error("Unexpected worker response");
  return resp.result;
}
