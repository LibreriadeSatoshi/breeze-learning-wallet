import { STORAGE_MIGRATION_SCRIPT, migrateLegacyStorageKeys, storageKey } from "../storage-keys";

const runners = [
  ["migrateLegacyStorageKeys", () => migrateLegacyStorageKeys()],
  ["inline head script", () => new Function(STORAGE_MIGRATION_SCRIPT)()],
] as const;

describe.each(runners)("legacy storage key migration (%s)", (_, run) => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("moves pre-rebrand keys to the new prefix", () => {
    localStorage.setItem("scholar-wallet:locale", "es");
    localStorage.setItem("scholar-wallet:theme", "hacker");
    sessionStorage.setItem("scholar-wallet:drive-pending", '{"state":"x"}');

    run();

    expect(localStorage.getItem(storageKey("locale"))).toBe("es");
    expect(localStorage.getItem(storageKey("theme"))).toBe("hacker");
    expect(sessionStorage.getItem(storageKey("drive-pending"))).toBe('{"state":"x"}');
    expect(localStorage.getItem("scholar-wallet:locale")).toBeNull();
    expect(sessionStorage.getItem("scholar-wallet:drive-pending")).toBeNull();
  });

  it("keeps a value already saved under the new key", () => {
    localStorage.setItem("scholar-wallet:locale", "es");
    localStorage.setItem(storageKey("locale"), "en");

    run();

    expect(localStorage.getItem(storageKey("locale"))).toBe("en");
    expect(localStorage.getItem("scholar-wallet:locale")).toBeNull();
  });

  it("drops the legacy plaintext mnemonic instead of carrying it forward", () => {
    sessionStorage.setItem("scholar-wallet:session-mnemonic", "abandon abandon about");

    run();

    expect(sessionStorage.getItem("scholar-wallet:session-mnemonic")).toBeNull();
    expect(sessionStorage.getItem(storageKey("session-mnemonic"))).toBeNull();
  });

  it("leaves unrelated keys alone", () => {
    localStorage.setItem("other-app:setting", "1");
    run();
    expect(localStorage.getItem("other-app:setting")).toBe("1");
  });
});
