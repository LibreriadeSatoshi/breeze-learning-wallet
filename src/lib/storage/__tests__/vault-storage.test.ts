import "fake-indexeddb/auto";
import { clearVault, loadVault, saveVault } from "../vault-storage";

function putLegacyVault(blob: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("scholar-wallet", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("vault");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("vault", "readwrite");
      tx.objectStore("vault").put(blob, "mnemonic-blob");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function databaseNames(): Promise<string[]> {
  return (await indexedDB.databases()).map((db) => db.name ?? "");
}

async function deleteAll(): Promise<void> {
  const dbs = await indexedDB.databases();
  await Promise.all(
    dbs.map(
      (db) =>
        new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase(db.name!);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        }),
    ),
  );
}

describe("vault storage", () => {
  beforeEach(async () => {
    await deleteAll();
  });

  it("saves, loads and clears the encrypted vault", async () => {
    const blob = Uint8Array.of(1, 2, 3, 4);
    await saveVault(blob);
    await expect(loadVault()).resolves.toEqual(blob);
    await clearVault();
    await expect(loadVault()).resolves.toBeNull();
  });

  it("moves a vault from the pre-rebrand database and removes the old one", async () => {
    const blob = Uint8Array.of(9, 8, 7);
    await putLegacyVault(blob);

    await expect(loadVault()).resolves.toEqual(blob);

    expect(await databaseNames()).not.toContain("scholar-wallet");
    await expect(loadVault()).resolves.toEqual(blob);
  });

  it("prefers the vault in the new database over a stale legacy one", async () => {
    await saveVault(Uint8Array.of(1));
    await putLegacyVault(Uint8Array.of(2));

    await expect(loadVault()).resolves.toEqual(Uint8Array.of(1));
  });

  it("returns null without creating a legacy database when there is none", async () => {
    await expect(loadVault()).resolves.toBeNull();
    expect(await databaseNames()).not.toContain("scholar-wallet");
  });
});
