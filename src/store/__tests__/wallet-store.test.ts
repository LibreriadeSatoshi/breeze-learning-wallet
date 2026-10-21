import { generateMnemonic, mnemonicToWords, validateMnemonic } from "@/lib/bitcoin/mnemonic";

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const PASSWORD = "correct horse battery staple";

let storedBlob: Uint8Array | null = null;

vi.mock("@/lib/storage/vault-storage", () => ({
  saveVault: vi.fn(async (blob: Uint8Array) => {
    storedBlob = blob;
  }),
  loadVault: vi.fn(async () => storedBlob),
  clearVault: vi.fn(async () => {
    storedBlob = null;
  }),
}));

// The real cipher needs a Worker; this stand-in keeps the password check.
vi.mock("@/lib/crypto/encryption", () => ({
  encryptMnemonic: vi.fn(async (plaintext: string, password: string) =>
    new TextEncoder().encode(JSON.stringify({ plaintext, password })),
  ),
  decryptMnemonic: vi.fn(async (blob: Uint8Array, password: string) => {
    const parsed = JSON.parse(new TextDecoder().decode(blob));
    if (parsed.password !== password) throw new Error("Wrong password or corrupted vault");
    return parsed.plaintext as string;
  }),
}));

async function loadStore() {
  const { useWalletStore } = await import("../wallet-store");
  return useWalletStore;
}

function allStorageValues(): string[] {
  const values: string[] = [];
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let i = 0; i < storage.length; i++) {
      values.push(storage.getItem(storage.key(i)!) ?? "");
    }
  }
  return values;
}

describe("wallet store", () => {
  beforeEach(() => {
    vi.resetModules();
    storedBlob = null;
    window.sessionStorage.clear();
  });

  it("never writes the mnemonic to browser storage", async () => {
    const store = await loadStore();
    await store.getState().bootstrap();
    await store.getState().createVault(MNEMONIC, PASSWORD);
    store.getState().lock();
    await store.getState().unlock(PASSWORD);

    expect(store.getState().getMnemonic()).toBe(MNEMONIC);
    expect(allStorageValues().some((v) => v.includes("abandon"))).toBe(false);
  });

  it("starts locked after a reload even when it was unlocked", async () => {
    const first = await loadStore();
    await first.getState().bootstrap();
    await first.getState().createVault(MNEMONIC, PASSWORD);
    expect(first.getState().isUnlocked).toBe(true);

    vi.resetModules();
    const reloaded = await loadStore();
    await reloaded.getState().bootstrap();

    expect(reloaded.getState().hasVault).toBe(true);
    expect(reloaded.getState().isUnlocked).toBe(false);
    expect(reloaded.getState().getMnemonic()).toBeNull();
  });

  it("wipes a mnemonic left in sessionStorage by older builds", async () => {
    window.sessionStorage.setItem("scholar-wallet:session-mnemonic", MNEMONIC);
    storedBlob = new TextEncoder().encode(JSON.stringify({ plaintext: MNEMONIC, password: PASSWORD }));

    const store = await loadStore();
    await store.getState().bootstrap();

    expect(window.sessionStorage.getItem("scholar-wallet:session-mnemonic")).toBeNull();
    expect(window.sessionStorage.getItem("ismos-wallet:session-mnemonic")).toBeNull();
    expect(store.getState().isUnlocked).toBe(false);
    expect(store.getState().getMnemonic()).toBeNull();
  });

  it("rejects a wrong password and stays locked", async () => {
    const store = await loadStore();
    await store.getState().bootstrap();
    await store.getState().createVault(MNEMONIC, PASSWORD);
    store.getState().lock();

    await expect(store.getState().unlock("wrong password")).rejects.toThrow();
    expect(store.getState().isUnlocked).toBe(false);
    expect(store.getState().getMnemonic()).toBeNull();
  });

  it("reveals the phrase for a correct password without unlocking", async () => {
    const store = await loadStore();
    await store.getState().bootstrap();
    await store.getState().createVault(MNEMONIC, PASSWORD);
    store.getState().lock();

    await expect(store.getState().verifyPasswordAndReveal(PASSWORD)).resolves.toBe(MNEMONIC);
    expect(store.getState().isUnlocked).toBe(false);
    expect(store.getState().getMnemonic()).toBeNull();
  });

  it("clears the vault and the mnemonic when the wallet is forgotten", async () => {
    const store = await loadStore();
    await store.getState().bootstrap();
    await store.getState().createVault(MNEMONIC, PASSWORD);

    await store.getState().destroyVault();

    expect(storedBlob).toBeNull();
    expect(store.getState().hasVault).toBe(false);
    expect(store.getState().getMnemonic()).toBeNull();
  });
});

describe("mnemonic helpers", () => {
  it("generates a valid 12-word BIP-39 mnemonic", () => {
    const mnemonic = generateMnemonic();
    expect(mnemonicToWords(mnemonic)).toHaveLength(12);
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it("generates a different mnemonic each time", () => {
    expect(generateMnemonic()).not.toBe(generateMnemonic());
  });

  it("rejects a phrase with a bad checksum", () => {
    expect(validateMnemonic(MNEMONIC)).toBe(true);
    expect(validateMnemonic(MNEMONIC.replace(/about$/, "abandon"))).toBe(false);
  });

  it("splits pasted phrases on any whitespace", () => {
    expect(mnemonicToWords("  one two\n three\tfour ")).toEqual(["one", "two", "three", "four"]);
  });
});
