import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GitHubUser } from './github';

interface AuthState {
  githubUser: GitHubUser | null;
  githubToken: string | null;

  isAuthorized: boolean;
  authorizationChecked: boolean;

  userData: any | null;

  setGitHubAuth: (user: GitHubUser, token: string) => void;
  setAuthorization: (isAuthorized: boolean, userData?: any) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      githubUser: null,
      githubToken: null,
      isAuthorized: false,
      authorizationChecked: false,
      userData: null,

      setGitHubAuth: (user, token) => set({
        githubUser: user,
        githubToken: token
      }),

      setAuthorization: (isAuthorized, userData) => set({
        isAuthorized,
        authorizationChecked: true,
        userData: userData || null
      }),

      clearAuth: async () => {
        const { signOut } = await import('./github');
        try {
          await signOut();
        } catch (error) {
          console.error('Error signing out from Supabase:', error);
        }
        
        const { useWalletStore } = await import('@/store/wallet-store');
        useWalletStore.getState().clearWallet();

        set({
          githubUser: null,
          githubToken: null,
          isAuthorized: false,
          authorizationChecked: false,
          userData: null,
        });
      },
    }),
    {
      name: 'etta-auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
