import { create } from "zustand";
import { encryptMnemonic, decryptMnemonic } from "@/lib/crypto/encryption";
import { saveVault, loadVault, clearVault } from "@/lib/storage/vault-storage";
import { clearLocalDriveState } from "@/lib/backup/drive-client";

// The plaintext mnemonic lives in a module-private variable, never in
// persisted state, never observable from React props. The vault module
// is the only place that holds it; the rest of the app sees only the
// initialized Breez SDK and the booleans below.
let mnemonicInMemory: string | null = null;

const LEGACY_STORAGE_KEYS = [
  "etta-wallet-storage",
  "etta-auth-storage",
  "scholar-wallet-prefs",
];

interface WalletStore {
  hasVault: boolean | null;
  isUnlocked: boolean;
  isBootstrapped: boolean;

  bootstrap: () => Promise<void>;
  refreshHasVault: () => Promise<void>;
  createVault: (mnemonic: string, password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  destroyVault: () => Promise<void>;
  getMnemonic: () => string | null;
  // Decrypts the vault with the given password without changing unlock state.
  verifyPasswordAndReveal: (password: string) => Promise<string>;
}

export const useWalletStore = create<WalletStore>()((set, get) => ({
  hasVault: null,
  isUnlocked: false,
  isBootstrapped: false,

  bootstrap: async () => {
    if (get().isBootstrapped) return;
    if (typeof window !== "undefined") {
      for (const key of LEGACY_STORAGE_KEYS) {
        window.localStorage.removeItem(key);
      }
    }
    const blob = await loadVault();
    set({ hasVault: blob !== null, isBootstrapped: true });
  },

  refreshHasVault: async () => {
    const blob = await loadVault();
    set({ hasVault: blob !== null });
  },

  createVault: async (mnemonic, password) => {
    const blob = await encryptMnemonic(mnemonic, password);
    await saveVault(blob);
    mnemonicInMemory = mnemonic;
    set({ hasVault: true, isUnlocked: true });
  },

  unlock: async (password) => {
    const blob = await loadVault();
    if (!blob) throw new Error("No vault found");
    const plaintext = await decryptMnemonic(blob, password);
    mnemonicInMemory = plaintext;
    set({ isUnlocked: true });
  },

  lock: () => {
    mnemonicInMemory = null;
    set({ isUnlocked: false });
  },

  destroyVault: async () => {
    await clearVault();
    clearLocalDriveState();
    mnemonicInMemory = null;
    set({ hasVault: false, isUnlocked: false });
  },

  getMnemonic: () => mnemonicInMemory,

  verifyPasswordAndReveal: async (password) => {
    const blob = await loadVault();
    if (!blob) throw new Error("No vault found");
    return decryptMnemonic(blob, password);
  },
}));
