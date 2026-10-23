import { GOOGLE_OAUTH_CLIENT_ID } from "@/lib/config";
import { storageKey } from "@/lib/storage/storage-keys";

// The browser gets the token from Google Identity Services and calls Drive
// itself, so the operator never sees a token and is not in the request path.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const VAULT_FILE_NAME = "vault.bin";
// Renew a little early so a token can't expire mid-upload.
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

const STORAGE_KEY_CONNECTED = storageKey("drive-connected");
const STORAGE_KEY_LAST_SYNC = storageKey("drive-last-sync");
const STORAGE_KEY_EMAIL = storageKey("drive-email");

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  error?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GisOauth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(response: TokenResponse, scope: string): boolean;
  revoke(token: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GisOauth2 } };
  }
}

export type DriveErrorCode =
  | "notConfigured"
  | "denied"
  | "popupClosed"
  | "popupBlocked"
  | "unavailable"
  | "failed";

export class DriveError extends Error {
  constructor(readonly code: DriveErrorCode) {
    super(`Google Drive: ${code}`);
    this.name = "DriveError";
  }
}

let gisLoad: Promise<GisOauth2> | null = null;
let tokenClient: TokenClient | null = null;
let pendingToken: { resolve: (token: string) => void; reject: (error: DriveError) => void } | null =
  null;
let cachedToken: { value: string; expiresAt: number } | null = null;

export function isDriveBackupConfigured(): boolean {
  return Boolean(GOOGLE_OAUTH_CLIENT_ID);
}

function loadGis(): Promise<GisOauth2> {
  const ready = window.google?.accounts?.oauth2;
  if (ready) return Promise.resolve(ready);
  gisLoad ??= new Promise<GisOauth2>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new DriveError("unavailable"));
    };
    script.onerror = () => reject(new DriveError("unavailable"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    gisLoad = null;
    throw error;
  });
  return gisLoad;
}

// Loading Google's script ahead of the click keeps the sign-in window inside
// the user's gesture, which browsers require to let a pop-up open.
export function preloadDriveAuth(): void {
  if (typeof window === "undefined" || !isDriveBackupConfigured()) return;
  loadGis().catch(() => {});
}

function settle(outcome: { token: string } | { error: DriveError }): void {
  const pending = pendingToken;
  pendingToken = null;
  if (!pending) return;
  if ("token" in outcome) pending.resolve(outcome.token);
  else pending.reject(outcome.error);
}

function getTokenClient(oauth2: GisOauth2): TokenClient {
  tokenClient ??= oauth2.initTokenClient({
    client_id: GOOGLE_OAUTH_CLIENT_ID!,
    scope: DRIVE_SCOPE,
    callback: (response) => {
      if (response.error || !oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
        settle({ error: new DriveError("denied") });
        return;
      }
      cachedToken = {
        value: response.access_token,
        expiresAt: Date.now() + response.expires_in * 1000,
      };
      settle({ token: response.access_token });
    },
    error_callback: (error) => {
      settle({
        error: new DriveError(error.type === "popup_failed_to_open" ? "popupBlocked" : "popupClosed"),
      });
    },
  });
  return tokenClient;
}

function requestToken(oauth2: GisOauth2): Promise<string> {
  settle({ error: new DriveError("popupClosed") });
  return new Promise<string>((resolve, reject) => {
    pendingToken = { resolve, reject };
    // An empty prompt only asks for consent the first time.
    getTokenClient(oauth2).requestAccessToken({ prompt: "" });
  });
}

// Call this first in a click handler, before any other await, so the
// sign-in window opens within the user's gesture.
export function getDriveToken(): Promise<string> {
  if (!isDriveBackupConfigured()) return Promise.reject(new DriveError("notConfigured"));
  if (cachedToken && cachedToken.expiresAt - TOKEN_EXPIRY_MARGIN_MS > Date.now()) {
    return Promise.resolve(cachedToken.value);
  }
  const ready = window.google?.accounts?.oauth2;
  if (ready) return requestToken(ready);
  return loadGis().then(requestToken);
}

async function driveFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new DriveError("unavailable");
  }
  if (response.status === 401) {
    cachedToken = null;
    throw new DriveError("denied");
  }
  if (!response.ok) throw new DriveError("failed");
  return response;
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

// Drive's own account info is readable with the appdata scope alone, so no
// separate email scope is needed.
async function fetchAccountEmail(token: string): Promise<string | null> {
  try {
    const response = await driveFetch(token, `${DRIVE_API}/about?fields=user(emailAddress)`);
    const data = (await response.json()) as { user?: { emailAddress?: string } };
    return data.user?.emailAddress ?? null;
  } catch {
    return null;
  }
}

async function recordSync(token: string): Promise<void> {
  const email = await fetchAccountEmail(token);
  window.localStorage.setItem(STORAGE_KEY_CONNECTED, "1");
  if (email) window.localStorage.setItem(STORAGE_KEY_EMAIL, email);
  else window.localStorage.removeItem(STORAGE_KEY_EMAIL);
  window.localStorage.setItem(STORAGE_KEY_LAST_SYNC, new Date().toISOString());
}

export function clearLocalDriveState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY_CONNECTED);
  window.localStorage.removeItem(STORAGE_KEY_LAST_SYNC);
  window.localStorage.removeItem(STORAGE_KEY_EMAIL);
  cachedToken = null;
}

function toPlainBytes(src: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(src.length);
  out.set(src);
  return out;
}

async function findVaultFileId(token: string): Promise<string | null> {
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set("spaces", "appDataFolder");
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("q", `name = '${VAULT_FILE_NAME}'`);
  const response = await driveFetch(token, url.toString());
  const data = (await response.json()) as { files: Array<{ id: string }> };
  return data.files[0]?.id ?? null;
}

async function createVaultFile(token: string, blob: Uint8Array): Promise<void> {
  const metadata = { name: VAULT_FILE_NAME, parents: ["appDataFolder"] };
  const boundary = `ismos-wallet-${crypto.randomUUID()}`;
  const body = new Blob([
    `--${boundary}\r\n`,
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\n`,
    "Content-Type: application/octet-stream\r\n\r\n",
    toPlainBytes(blob),
    `\r\n--${boundary}--`,
  ]);
  await driveFetch(token, `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

async function replaceVaultFile(token: string, fileId: string, blob: Uint8Array): Promise<void> {
  await driveFetch(token, `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: { "Content-Type": "application/octet-stream" },
    body: new Blob([toPlainBytes(blob)]),
  });
}

export async function uploadVault(token: string, blob: Uint8Array): Promise<void> {
  const existing = await findVaultFileId(token);
  if (existing) await replaceVaultFile(token, existing, blob);
  else await createVaultFile(token, blob);
  await recordSync(token);
}

export async function downloadVault(token: string): Promise<Uint8Array | null> {
  const fileId = await findVaultFileId(token);
  if (!fileId) return null;
  const response = await driveFetch(token, `${DRIVE_API}/files/${fileId}?alt=media`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await recordSync(token);
  return bytes;
}

// Deletes the Drive copy and revokes access. It only reports success once the
// file is gone, so the settings page never claims a deletion that didn't happen.
export async function deleteBackupAndDisconnect(token: string): Promise<void> {
  const fileId = await findVaultFileId(token);
  if (fileId) {
    await driveFetch(token, `${DRIVE_API}/files/${fileId}`, { method: "DELETE" });
  }
  window.google?.accounts?.oauth2?.revoke(token);
  clearLocalDriveState();
}

export function driveErrorKey(error: unknown): string {
  return `drive.errors.${error instanceof DriveError ? error.code : "failed"}`;
}
