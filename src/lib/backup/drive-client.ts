import { GOOGLE_OAUTH_CLIENT_ID } from "@/lib/config";

const SCOPE = [
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");
const VAULT_FILE_NAME = "vault.bin";

const STORAGE_KEY_CONNECTED = "scholar-wallet:drive-connected";
const STORAGE_KEY_LAST_SYNC = "scholar-wallet:drive-last-sync";
const STORAGE_KEY_EMAIL = "scholar-wallet:drive-email";
const SESSION_KEY_PENDING = "scholar-wallet:drive-pending";

const AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export type DriveIntent =
  | { type: "connect"; returnTo: string }
  | { type: "backup"; returnTo: string }
  | { type: "restore"; returnTo: string };

type PendingFlow = {
  state: string;
  intent: DriveIntent;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function isConfigured(): boolean {
  return Boolean(GOOGLE_OAUTH_CLIENT_ID);
}

function getRedirectUri(): string {
  return `${window.location.origin}/wallet/drive-callback`;
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function startDriveAuthFlow(intent: DriveIntent): void {
  if (!isConfigured()) {
    throw new Error("Google OAuth client ID is not configured");
  }
  const state = randomState();
  const pending: PendingFlow = { state, intent };
  window.sessionStorage.setItem(SESSION_KEY_PENDING, JSON.stringify(pending));

  const url = new URL(AUTH_BASE_URL);
  url.searchParams.set("client_id", GOOGLE_OAUTH_CLIENT_ID!);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", intent.type === "backup" ? "" : "consent");

  window.location.href = url.toString();
}

function takePendingFlow(): PendingFlow | null {
  const raw = window.sessionStorage.getItem(SESSION_KEY_PENDING);
  if (!raw) return null;
  window.sessionStorage.removeItem(SESSION_KEY_PENDING);
  try {
    return JSON.parse(raw) as PendingFlow;
  } catch {
    return null;
  }
}

type ExchangeResponse = {
  accessToken: string;
  expiresIn: number;
  scope: string;
};

async function exchangeCode(code: string): Promise<ExchangeResponse> {
  const res = await fetch("/api/drive/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirectUri: getRedirectUri() }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Token exchange failed (${res.status})`);
  }
  return res.json();
}

export type DriveCallbackResult =
  | { ok: true; token: string; intent: DriveIntent }
  | { ok: false; error: string; intent: DriveIntent | null };

export async function handleDriveCallback(
  params: URLSearchParams,
): Promise<DriveCallbackResult> {
  const pending = takePendingFlow();
  const intent = pending?.intent ?? null;

  const error = params.get("error");
  if (error) {
    const message =
      error === "access_denied"
        ? "Google Drive access was not granted."
        : `Google sign-in failed: ${error}`;
    return { ok: false, error: message, intent };
  }

  const code = params.get("code");
  const state = params.get("state");
  const grantedScope = params.get("scope") ?? "";

  if (!pending) {
    return {
      ok: false,
      error: "Missing or expired session. Please try again.",
      intent: null,
    };
  }
  if (!code || !state || state !== pending.state) {
    return {
      ok: false,
      error: "Invalid OAuth state. Please try again.",
      intent,
    };
  }
  if (!grantedScope.split(" ").includes("https://www.googleapis.com/auth/drive.appdata")) {
    return {
      ok: false,
      error:
        "Google Drive access was not granted. Allow Drive access to back up your wallet.",
      intent,
    };
  }

  try {
    const { accessToken, expiresIn } = await exchangeCode(code);
    cachedToken = {
      value: accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    return { ok: true, token: accessToken, intent: pending.intent };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Token exchange failed.",
      intent,
    };
  }
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

export function clearLocalDriveState(): void {
  if (typeof window === "undefined") return;
  clearConnection();
}

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
  const boundary = "scholar-wallet-" + randomState();
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

export async function uploadVault(token: string, blob: Uint8Array): Promise<void> {
  const existing = await findVaultFileId(token);
  if (existing) {
    await updateExisting(token, existing, blob);
  } else {
    await uploadNew(token, blob);
  }
  const email = await fetchUserEmail(token);
  markConnected();
  setEmail(email);
  markSyncedNow();
}

export async function fetchVault(token: string): Promise<Uint8Array | null> {
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
  const token = cachedToken?.value ?? null;
  try {
    if (token) {
      const fileId = await findVaultFileId(token);
      if (fileId) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
  } catch {
    // best-effort
  }
  if (token) {
    try {
      const url = new URL(REVOKE_URL);
      url.searchParams.set("token", token);
      await fetch(url.toString(), { method: "POST" });
    } catch {
      // best-effort
    }
  }
  clearConnection();
}

export function isDriveBackupConfigured(): boolean {
  return isConfigured();
}
