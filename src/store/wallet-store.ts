import { create } from "zustand";
import { encryptMnemonic, decryptMnemonic } from "@/lib/crypto/encryption";
import { saveVault, loadVault, clearVault } from "@/lib/storage/vault-storage";
import { clearLocalDriveState } from "@/lib/backup/drive-client";
import { deleteSdkStorage, disconnectBreez } from "@/lib/lightning/breez-service";
import { migrateLegacyStorageKeys, storageKey } from "@/lib/storage/storage-keys";

let mnemonicInMemory: string | null = null;

const STORAGE_KEY_AUTH_MODE = storageKey("auth-mode");
const STORAGE_KEY_SHOW_BALANCE = storageKey("show-balance");

const LEGACY_STORAGE_KEYS = [
  "etta-wallet-storage",
  "etta-auth-storage",
  "scholar-wallet-prefs",
];

export type AuthMode = "password" | "passkey";

function persistMnemonic(mnemonic: string) {
  mnemonicInMemory = mnemonic;
}

function clearMnemonic() {
  mnemonicInMemory = null;
}

function readAuthMode(): AuthMode | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY_AUTH_MODE);
  return v === "password" || v === "passkey" ? v : null;
}

function setAuthMode(mode: AuthMode | null) {
  if (typeof window === "undefined") return;
  if (mode) window.localStorage.setItem(STORAGE_KEY_AUTH_MODE, mode);
  else window.localStorage.removeItem(STORAGE_KEY_AUTH_MODE);
}

function readShowBalance() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY_SHOW_BALANCE) !== "false";
}

interface WalletStore {
  hasVault: boolean | null;
  authMode: AuthMode | null;
  isUnlocked: boolean;
  isBootstrapped: boolean;
  showBalance: boolean;
  // Changes whenever the wallet held in memory changes or is dropped.
  session: number;

  bootstrap: () => Promise<void>;
  refreshHasVault: () => Promise<void>;
  createVault: (mnemonic: string, password: string) => Promise<void>;
  // Stores a vault restored from backup; it stays locked until its password is entered.
  adoptVaultBackup: (blob: Uint8Array) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  adoptPasskeyWallet: (mnemonic: string) => void;
  lock: () => void;
  destroyVault: () => Promise<void>;
  getMnemonic: () => string | null;
  toggleBalanceVisibility: () => void;
  // Decrypts the vault with the given password without changing unlock state.
  verifyPasswordAndReveal: (password: string) => Promise<string>;
}

export const useWalletStore = create<WalletStore>()((set, get) => ({
  hasVault: null,
  authMode: null,
  isUnlocked: false,
  isBootstrapped: false,
  showBalance: true,
  session: 0,

  bootstrap: async () => {
    if (get().isBootstrapped) return;
    migrateLegacyStorageKeys();
    if (typeof window !== "undefined") {
      for (const key of LEGACY_STORAGE_KEYS) {
        window.localStorage.removeItem(key);
      }
    }
    const blob = await loadVault();
    const mode = readAuthMode();
    const hasVault = blob !== null || mode === "passkey";
    const showBalance = readShowBalance();

    set({
      hasVault,
      authMode: mode,
      isUnlocked: hasVault && mnemonicInMemory !== null,
      isBootstrapped: true,
      showBalance,
    });
  },

  refreshHasVault: async () => {
    const blob = await loadVault();
    const mode = readAuthMode();
    set({ hasVault: blob !== null || mode === "passkey", authMode: mode });
  },

  createVault: async (mnemonic, password) => {
    const blob = await encryptMnemonic(mnemonic, password);
    // A replaced wallet must leave nothing behind, like a forgotten one.
    await deleteSdkStorage();
    await saveVault(blob);
    setAuthMode("password");
    persistMnemonic(mnemonic);
    set({ hasVault: true, authMode: "password", isUnlocked: true, session: get().session + 1 });
  },

  adoptVaultBackup: async (blob) => {
    await deleteSdkStorage();
    await saveVault(blob);
    setAuthMode("password");
    clearMnemonic();
    set({ hasVault: true, authMode: "password", isUnlocked: false, session: get().session + 1 });
  },

  unlock: async (password) => {
    const blob = await loadVault();
    if (!blob) throw new Error("No vault found");
    const plaintext = await decryptMnemonic(blob, password);
    persistMnemonic(plaintext);
    set({ isUnlocked: true, session: get().session + 1 });
  },

  adoptPasskeyWallet: (mnemonic) => {
    void disconnectBreez();
    setAuthMode("passkey");
    persistMnemonic(mnemonic);
    set({ hasVault: true, authMode: "passkey", isUnlocked: true, session: get().session + 1 });
  },

  lock: () => {
    void disconnectBreez();
    clearMnemonic();
    set({ isUnlocked: false, session: get().session + 1 });
  },

  destroyVault: async () => {
    await deleteSdkStorage();
    await clearVault();
    clearLocalDriveState();
    setAuthMode(null);
    clearMnemonic();
    set({ hasVault: false, authMode: null, isUnlocked: false, session: get().session + 1 });
  },

  getMnemonic: () => mnemonicInMemory,

  toggleBalanceVisibility: () => {
    const newVal = !get().showBalance;
    if (window == undefined) return;
    window.localStorage.setItem(STORAGE_KEY_SHOW_BALANCE, String(newVal));
    set({
      showBalance: newVal,
    });
  },

  verifyPasswordAndReveal: async (password) => {
    const blob = await loadVault();
    if (!blob) throw new Error("No vault found");
    return decryptMnemonic(blob, password);
  },
}));
