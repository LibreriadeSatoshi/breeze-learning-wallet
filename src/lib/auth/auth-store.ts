/**
 * Authentication State Management
 * Manages GitHub authentication and authorization status
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GitHubUser } from './github';

interface AuthState {
  // GitHub user info
  githubUser: GitHubUser | null;
  githubToken: string | null;

  // Authorization status
  isAuthorized: boolean;
  authorizationChecked: boolean;

  // User data from external DB
  userData: any | null;

  // Actions
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

      clearAuth: () => set({
        githubUser: null,
        githubToken: null,
        isAuthorized: false,
        authorizationChecked: false,
        userData: null,
      }),
    }),
    {
      name: 'etta-auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
