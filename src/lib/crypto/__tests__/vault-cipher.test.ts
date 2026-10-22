import { argon2id } from "hash-wasm";
import { NONCE_LEN, SALT_LEN, TAG_LEN, VERSION, decrypt, deriveKey, encrypt } from "../vault-cipher";

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const PASSWORD = "correct horse battery staple";
const HEADER_LEN = 1 + SALT_LEN + NONCE_LEN;

// Builds a vault from the spec in AGENTS.md alone, so a silent change to the
// KDF parameters or blob layout breaks this test instead of existing vaults.
async function encryptPerSpec(plaintext: string, password: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const raw = await argon2id({
    password,
    salt,
    parallelism: 4,
    memorySize: 64 * 1024,
    iterations: 3,
    hashLength: 32,
    outputType: "binary",
  });
  const key = await crypto.subtle.importKey("raw", new Uint8Array(raw), { name: "AES-GCM" }, false, ["encrypt"]);
  const header = new Uint8Array([1, ...salt, ...nonce]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: header },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  return new Uint8Array([...header, ...ciphertext]);
}

describe("vault cipher", () => {
  it("round-trips the mnemonic with the right password", async () => {
    const blob = await encrypt(MNEMONIC, PASSWORD);
    await expect(decrypt(blob, PASSWORD)).resolves.toBe(MNEMONIC);
  });

  it("uses the documented blob layout", async () => {
    const blob = await encrypt(MNEMONIC, PASSWORD);
    const plaintextLen = new TextEncoder().encode(MNEMONIC).length;
    expect(blob[0]).toBe(VERSION);
    expect(blob.length).toBe(HEADER_LEN + plaintextLen + TAG_LEN);
    expect(new TextDecoder().decode(blob)).not.toContain("abandon");
  });

  it("uses a fresh salt and nonce for every write", async () => {
    const a = await encrypt(MNEMONIC, PASSWORD);
    const b = await encrypt(MNEMONIC, PASSWORD);
    expect(a.subarray(1, 1 + SALT_LEN)).not.toEqual(b.subarray(1, 1 + SALT_LEN));
    expect(a.subarray(1 + SALT_LEN, HEADER_LEN)).not.toEqual(b.subarray(1 + SALT_LEN, HEADER_LEN));
  });

  it("decrypts a vault built independently from the spec", async () => {
    const blob = await encryptPerSpec(MNEMONIC, PASSWORD);
    await expect(decrypt(blob, PASSWORD)).resolves.toBe(MNEMONIC);
  });

  it("rejects a wrong password", async () => {
    const blob = await encrypt(MNEMONIC, PASSWORD);
    await expect(decrypt(blob, "wrong password")).rejects.toThrow();
  });

  it("rejects a tampered header because it is bound into the AAD", async () => {
    const blob = await encrypt(MNEMONIC, PASSWORD);
    const tampered = blob.slice();
    tampered[1 + SALT_LEN] ^= 0x01;
    await expect(decrypt(tampered, PASSWORD)).rejects.toThrow();
  });

  it("rejects tampered ciphertext", async () => {
    const blob = await encrypt(MNEMONIC, PASSWORD);
    const tampered = blob.slice();
    tampered[tampered.length - 1] ^= 0x01;
    await expect(decrypt(tampered, PASSWORD)).rejects.toThrow();
  });

  it("rejects truncated blobs and unknown versions", async () => {
    const blob = await encrypt(MNEMONIC, PASSWORD);
    await expect(decrypt(blob.subarray(0, HEADER_LEN + TAG_LEN - 1), PASSWORD)).rejects.toThrow(
      "Invalid vault blob",
    );
    const future = blob.slice();
    future[0] = VERSION + 1;
    await expect(decrypt(future, PASSWORD)).rejects.toThrow("Unsupported vault version");
  });

  it("derives a non-extractable AES-GCM key", async () => {
    const key = await deriveKey(PASSWORD, crypto.getRandomValues(new Uint8Array(SALT_LEN)));
    expect(key.extractable).toBe(false);
    expect(key.algorithm.name).toBe("AES-GCM");
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toThrow();
  });
});
