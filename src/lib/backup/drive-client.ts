import { GOOGLE_OAUTH_CLIENT_ID } from "@/lib/config";

const SCOPE = [
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");
const VAULT_FILE_NAME = "vault.bin";

const STORAGE_KEY_CONNECTED = "scholar-wallet:drive-connected";
const STORAGE_KEY_LAST_SYNC = "scholar-wallet:drive-last-sync";
const STORAGE_KEY_EMAIL = "scholar-wallet:drive-email";

// Google Identity Services types — declared inline since we load the script
// via Next.js <Script>, not via an npm package with typings.
type TokenResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
  error?: string;
};

const REQUIRED_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

type TokenClient = {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
  callback?: (resp: TokenResponse) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
          }) => TokenClient;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function isConfigured(): boolean {
  return Boolean(GOOGLE_OAUTH_CLIENT_ID);
}

function isGisReady(): boolean {
  return typeof window !== "undefined" && Boolean(window.google?.accounts?.oauth2);
}

async function waitForGis(timeoutMs = 5000): Promise<void> {
  if (isGisReady()) return;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (isGisReady()) return resolve();
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("Google Identity Services failed to load"));
      }
      setTimeout(check, 100);
    };
    check();
  });
}

function getAccessToken(prompt: boolean): Promise<string> {
  if (!isConfigured()) {
    throw new Error("Google OAuth client ID is not configured");
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return Promise.resolve(cachedToken.value);
  }
  return new Promise(async (resolve, reject) => {
    try {
      await waitForGis();
      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_OAUTH_CLIENT_ID!,
        scope: SCOPE,
        callback: (resp) => {
          if (resp.error) return reject(new Error(resp.error));
          if (!resp.access_token) return reject(new Error("No access token returned"));
          const granted = (resp.scope ?? "").split(/\s+/);
          if (!granted.includes(REQUIRED_SCOPE)) {
            return reject(
              new Error(
                "Drive access wasn't granted. On the Google consent screen, leave the Drive permission checked.",
              ),
            );
          }
          cachedToken = {
            value: resp.access_token,
            expiresAt: Date.now() + resp.expires_in * 1000,
          };
          resolve(resp.access_token);
        },
      });
      tokenClient.requestAccessToken({ prompt: prompt ? "consent" : "" });
    } catch (e) {
      reject(e);
    }
  });
}

export function isDriveConnected(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY_CONNECTED) === "1";
}

export function getLastSyncIso(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY_LAST_SYNC);
}

export function getDriveEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY_EMAIL);
}

async function fetchUserEmail(token: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

function markConnected() {
  window.localStorage.setItem(STORAGE_KEY_CONNECTED, "1");
}

function setEmail(email: string | null) {
  if (email) window.localStorage.setItem(STORAGE_KEY_EMAIL, email);
  else window.localStorage.removeItem(STORAGE_KEY_EMAIL);
}

function markSyncedNow() {
  window.localStorage.setItem(STORAGE_KEY_LAST_SYNC, new Date().toISOString());
}

function clearConnection() {
  window.localStorage.removeItem(STORAGE_KEY_CONNECTED);
  window.localStorage.removeItem(STORAGE_KEY_LAST_SYNC);
  window.localStorage.removeItem(STORAGE_KEY_EMAIL);
  cachedToken = null;
}

// Clears the local Drive connection state without touching Drive or the
// OAuth token. Use when the local wallet is destroyed and the connection
// metadata no longer corresponds to anything meaningful on this device.
export function clearLocalDriveState(): void {
  if (typeof window === "undefined") return;
  clearConnection();
}

// TS 5.7 narrows fetch body types to Uint8Array<ArrayBuffer>; the SDK's blob
// is typed as Uint8Array<ArrayBufferLike>. Copy into a fresh, properly-typed
// buffer.
function toPlainBytes(src: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(src.length);
  out.set(src);
  return out;
}

async function findVaultFileId(token: string): Promise<string | null> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("spaces", "appDataFolder");
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("q", `name = '${VAULT_FILE_NAME}'`);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drive list failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { files: Array<{ id: string; name: string }> };
  return data.files[0]?.id ?? null;
}

async function uploadNew(token: string, blob: Uint8Array): Promise<string> {
  const metadata = { name: VAULT_FILE_NAME, parents: ["appDataFolder"] };
  const boundary = "scholar-wallet-" + Math.random().toString(36).slice(2);
  const payload = toPlainBytes(blob);
  const body = new Blob([
    `--${boundary}\r\n`,
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\n`,
    "Content-Type: application/octet-stream\r\n\r\n",
    payload,
    `\r\n--${boundary}--`,
  ]);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function updateExisting(
  token: string,
  fileId: string,
  blob: Uint8Array,
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: new Blob([toPlainBytes(blob)]),
    },
  );
  if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
}

export async function connectAndUpload(vaultBlob: Uint8Array): Promise<void> {
  const token = await getAccessToken(true);
  const email = await fetchUserEmail(token);
  const existing = await findVaultFileId(token);
  if (existing) {
    await updateExisting(token, existing, vaultBlob);
  } else {
    await uploadNew(token, vaultBlob);
  }
  markConnected();
  setEmail(email);
  markSyncedNow();
}

export async function backupNow(vaultBlob: Uint8Array): Promise<void> {
  const token = await getAccessToken(false);
  const existing = await findVaultFileId(token);
  if (existing) {
    await updateExisting(token, existing, vaultBlob);
  } else {
    await uploadNew(token, vaultBlob);
  }
  markSyncedNow();
}

export async function downloadVault(): Promise<Uint8Array | null> {
  const token = await getAccessToken(true);
  const fileId = await findVaultFileId(token);
  if (!fileId) return null;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const email = await fetchUserEmail(token);
  markConnected();
  setEmail(email);
  markSyncedNow();
  return bytes;
}

export async function disconnect(): Promise<void> {
  let token: string | null = null;
  try {
    token = await getAccessToken(false);
    const fileId = await findVaultFileId(token);
    if (fileId) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // Best-effort delete. If we can't fetch a token or list/delete fails,
    // still clear local state and revoke below.
  }
  if (token && isGisReady()) {
    await new Promise<void>((resolve) => {
      window.google!.accounts.oauth2.revoke(token, () => resolve());
    });
  }
  clearConnection();
}

export function isDriveBackupConfigured(): boolean {
  return isConfigured();
}
