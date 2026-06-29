import { create } from "zustand";
import { encryptMnemonic, decryptMnemonic } from "@/lib/crypto/encryption";
import { saveVault, loadVault, clearVault } from "@/lib/storage/vault-storage";
import { clearLocalDriveState } from "@/lib/backup/drive-client";
import { disconnectBreez } from "@/lib/lightning/breez-service";

let mnemonicInMemory: string | null = null;

const SESSION_KEY_MNEMONIC = "scholar-wallet:session-mnemonic";
const STORAGE_KEY_AUTH_MODE = "scholar-wallet:auth-mode";

const LEGACY_STORAGE_KEYS = [
  "etta-wallet-storage",
  "etta-auth-storage",
  "scholar-wallet-prefs",
];

export type AuthMode = "password" | "passkey";

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

interface WalletStore {
  hasVault: boolean | null;
  authMode: AuthMode | null;
  isUnlocked: boolean;
  isBootstrapped: boolean;

  bootstrap: () => Promise<void>;
  refreshHasVault: () => Promise<void>;
  createVault: (mnemonic: string, password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  adoptPasskeyWallet: (mnemonic: string) => void;
  lock: () => void;
  destroyVault: () => Promise<void>;
  getMnemonic: () => string | null;
  // Decrypts the vault with the given password without changing unlock state.
  verifyPasswordAndReveal: (password: string) => Promise<string>;
}

export const useWalletStore = create<WalletStore>()((set, get) => ({
  hasVault: null,
  authMode: null,
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
    const mode = readAuthMode();
    const hasVault = blob !== null || mode === "passkey";
    if (session && hasVault) {
      mnemonicInMemory = session;
    }
    set({
      hasVault,
      authMode: mode,
      isUnlocked: session !== null && hasVault,
      isBootstrapped: true,
    });
  },

  refreshHasVault: async () => {
    const blob = await loadVault();
    const mode = readAuthMode();
    set({ hasVault: blob !== null || mode === "passkey", authMode: mode });
  },

  createVault: async (mnemonic, password) => {
    const blob = await encryptMnemonic(mnemonic, password);
    await saveVault(blob);
    setAuthMode("password");
    persistMnemonic(mnemonic);
    set({ hasVault: true, authMode: "password", isUnlocked: true });
  },

  unlock: async (password) => {
    const blob = await loadVault();
    if (!blob) throw new Error("No vault found");
    const plaintext = await decryptMnemonic(blob, password);
    persistMnemonic(plaintext);
    set({ isUnlocked: true });
  },

  adoptPasskeyWallet: (mnemonic) => {
    setAuthMode("passkey");
    persistMnemonic(mnemonic);
    set({ hasVault: true, authMode: "passkey", isUnlocked: true });
  },

  lock: () => {
    clearMnemonic();
    set({ isUnlocked: false });
  },

  destroyVault: async () => {
    await disconnectBreez();
    await clearVault();
    clearLocalDriveState();
    setAuthMode(null);
    clearMnemonic();
    set({ hasVault: false, authMode: null, isUnlocked: false });
  },

  getMnemonic: () => mnemonicInMemory,

  verifyPasswordAndReveal: async (password) => {
    const blob = await loadVault();
    if (!blob) throw new Error("No vault found");
    return decryptMnemonic(blob, password);
  },
}));
