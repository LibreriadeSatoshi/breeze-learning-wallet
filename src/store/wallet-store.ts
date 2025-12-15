/**
 * Wallet State Management with Zustand
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface WalletState {
  // Wallet status
  isInitialized: boolean;
  hasBackedUp: boolean;

  // Mnemonic (stored encrypted in localStorage)
  // Note: In production, consider more secure storage like encrypted IndexedDB
  encryptedMnemonic: string | null;

  // Temporary mnemonic (only stored in memory during setup)
  temporaryMnemonic: string | null;

  // Actions
  setInitialized: (initialized: boolean) => void;
  setHasBackedUp: (backedUp: boolean) => void;
  setEncryptedMnemonic: (mnemonic: string | null) => void;
  setTemporaryMnemonic: (mnemonic: string | null) => void;
  clearWallet: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      // Initial state
      isInitialized: false,
      hasBackedUp: false,
      encryptedMnemonic: null,
      temporaryMnemonic: null,

      // Actions
      setInitialized: (initialized) => set({ isInitialized: initialized }),
      setHasBackedUp: (backedUp) => set({ hasBackedUp: backedUp }),
      setEncryptedMnemonic: (mnemonic) => set({ encryptedMnemonic: mnemonic }),
      setTemporaryMnemonic: (mnemonic) => set({ temporaryMnemonic: mnemonic }),

      clearWallet: () =>
        set({
          isInitialized: false,
          hasBackedUp: false,
          encryptedMnemonic: null,
          temporaryMnemonic: null,
        }),
    }),
    {
      name: 'etta-wallet-storage',
      storage: createJSONStorage(() => localStorage),
      // Persist encrypted mnemonic but not temporary mnemonic
      partialize: (state) => ({
        isInitialized: state.isInitialized,
        hasBackedUp: state.hasBackedUp,
        encryptedMnemonic: state.encryptedMnemonic,
      }),
    }
  )
);
