import { create } from "zustand";
import { encryptMnemonic, decryptMnemonic } from "@/lib/crypto/encryption";
import { saveVault, loadVault, clearVault } from "@/lib/storage/vault-storage";
import { clearLocalDriveState } from "@/lib/backup/drive-client";
import { disconnectBreez } from "@/lib/lightning/breez-service";

let mnemonicInMemory: string | null = null;

const SESSION_KEY_MNEMONIC = "scholar-wallet:session-mnemonic";

const LEGACY_STORAGE_KEYS = [
  "etta-wallet-storage",
  "etta-auth-storage",
  "scholar-wallet-prefs",
];

function persistMnemonic(mnemonic: string) {
  mnemonicInMemory = mnemonic;
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(SESSION_KEY_MNEMONIC, mnemonic);
  }
}

function clearMnemonic() {
  mnemonicInMemory = null;
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(SESSION_KEY_MNEMONIC);
  }
}

function readSessionMnemonic(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(SESSION_KEY_MNEMONIC);
}

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
    const session = readSessionMnemonic();
    if (session && blob) {
      mnemonicInMemory = session;
    }
    set({
      hasVault: blob !== null,
      isUnlocked: session !== null && blob !== null,
      isBootstrapped: true,
    });
  },

  refreshHasVault: async () => {
    const blob = await loadVault();
    set({ hasVault: blob !== null });
  },

  createVault: async (mnemonic, password) => {
    const blob = await encryptMnemonic(mnemonic, password);
    await saveVault(blob);
    persistMnemonic(mnemonic);
    set({ hasVault: true, isUnlocked: true });
  },

  unlock: async (password) => {
    const blob = await loadVault();
    if (!blob) throw new Error("No vault found");
    const plaintext = await decryptMnemonic(blob, password);
    persistMnemonic(plaintext);
    set({ isUnlocked: true });
  },

  lock: () => {
    clearMnemonic();
    set({ isUnlocked: false });
  },

  destroyVault: async () => {
    await disconnectBreez();
    await clearVault();
    clearLocalDriveState();
    clearMnemonic();
    set({ hasVault: false, isUnlocked: false });
  },

  getMnemonic: () => mnemonicInMemory,

  verifyPasswordAndReveal: async (password) => {
    const blob = await loadVault();
    if (!blob) throw new Error("No vault found");
    return decryptMnemonic(blob, password);
  },
}));
