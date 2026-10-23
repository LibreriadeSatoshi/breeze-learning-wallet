import { storageKey } from "@/lib/storage/storage-keys";

vi.mock("@/lib/config", () => ({ GOOGLE_OAUTH_CLIENT_ID: "client-id.apps.googleusercontent.com" }));

type TokenConfig = {
  client_id: string;
  scope: string;
  callback: (response: { access_token: string; expires_in: number; scope: string; error?: string }) => void;
  error_callback?: (error: { type: string }) => void;
};

const SCOPE = "https://www.googleapis.com/auth/drive.appdata";

function installGis(respond: (config: TokenConfig) => void) {
  const configs: TokenConfig[] = [];
  const revoke = vi.fn();
  const requestAccessToken = vi.fn();
  window.google = {
    accounts: {
      oauth2: {
        initTokenClient: (config: TokenConfig) => {
          configs.push(config);
          return {
            requestAccessToken: (overrides?: { prompt?: string }) => {
              requestAccessToken(overrides);
              respond(config);
            },
          };
        },
        hasGrantedAllScopes: (response, scope) => response.scope.split(" ").includes(scope),
        revoke,
      },
    },
  };
  return { configs, revoke, requestAccessToken };
}

const grant = (config: TokenConfig) =>
  config.callback({ access_token: "token-1", expires_in: 3600, scope: SCOPE });

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

async function loadClient() {
  return import("../drive-client");
}

describe("drive client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    delete window.google;
  });

  it("asks Google for the appdata scope only and calls no server of ours", async () => {
    const gis = installGis(grant);
    const { getDriveToken } = await loadClient();

    await expect(getDriveToken()).resolves.toBe("token-1");

    expect(gis.configs[0].scope).toBe(SCOPE);
    expect(gis.requestAccessToken).toHaveBeenCalledWith({ prompt: "" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reuses a live token instead of opening Google again", async () => {
    const gis = installGis(grant);
    const { getDriveToken } = await loadClient();

    await getDriveToken();
    await getDriveToken();

    expect(gis.requestAccessToken).toHaveBeenCalledTimes(1);
  });

  it("rejects when Drive access isn't granted or the window fails", async () => {
    installGis((config) => config.callback({ access_token: "t", expires_in: 3600, scope: "email" }));
    let client = await loadClient();
    await expect(client.getDriveToken()).rejects.toMatchObject({ code: "denied" });

    vi.resetModules();
    installGis((config) => config.error_callback?.({ type: "popup_failed_to_open" }));
    client = await loadClient();
    await expect(client.getDriveToken()).rejects.toMatchObject({ code: "popupBlocked" });

    vi.resetModules();
    installGis((config) => config.error_callback?.({ type: "popup_closed" }));
    client = await loadClient();
    await expect(client.getDriveToken()).rejects.toMatchObject({ code: "popupClosed" });
  });

  it("uploads to the app folder and reads the account email from Drive", async () => {
    installGis(grant);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "file-1" }))
      .mockResolvedValueOnce(jsonResponse({ user: { emailAddress: "me@example.com" } }));
    const { getDriveToken, uploadVault, getDriveEmail, isDriveConnected } = await loadClient();

    await uploadVault(await getDriveToken(), new Uint8Array([1, 2, 3]));

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.every((url) => url.startsWith("https://www.googleapis.com/"))).toBe(true);
    expect(urls[0]).toContain("spaces=appDataFolder");
    expect(urls[2]).toContain("/drive/v3/about");
    expect(isDriveConnected()).toBe(true);
    expect(getDriveEmail()).toBe("me@example.com");
  });

  it("deletes the Drive copy and revokes access before forgetting the connection", async () => {
    const gis = installGis(grant);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: "file-1" }] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    window.localStorage.setItem(storageKey("drive-connected"), "1");
    const { getDriveToken, deleteBackupAndDisconnect, isDriveConnected } = await loadClient();

    await deleteBackupAndDisconnect(await getDriveToken());

    expect(fetchMock.mock.calls[1][0]).toBe("https://www.googleapis.com/drive/v3/files/file-1");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
    expect(gis.revoke).toHaveBeenCalledWith("token-1");
    expect(isDriveConnected()).toBe(false);
  });

  it("keeps the connection when the Drive copy couldn't be deleted", async () => {
    installGis(grant);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: "file-1" }] }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    window.localStorage.setItem(storageKey("drive-connected"), "1");
    const { getDriveToken, deleteBackupAndDisconnect, isDriveConnected } = await loadClient();

    await expect(deleteBackupAndDisconnect(await getDriveToken())).rejects.toMatchObject({
      code: "failed",
    });
    expect(isDriveConnected()).toBe(true);
  });
});
