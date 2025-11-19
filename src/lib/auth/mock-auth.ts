/**
 * Mock GitHub Authentication for Development
 * Simulates GitHub OAuth flow without actual API calls
 */

import type { GitHubUser } from './github';

/**
 * Mock authorized user - email will be authorized in dev mode
 */
export const mockAuthorizedUser: GitHubUser = {
  id: 12345678,
  login: 'dev-authorized',
  name: 'Authorized Dev User',
  email: 'authorized@example.com',
  avatar_url: 'https://avatars.githubusercontent.com/u/9919?v=4', // GitHub's avatar
};

/**
 * Mock unauthorized user - email will NOT be authorized
 */
export const mockUnauthorizedUser: GitHubUser = {
  id: 87654321,
  login: 'dev-unauthorized',
  name: 'Unauthorized Dev User',
  email: 'unauthorized@example.com',
  avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4', // Octocat avatar
};

/**
 * Mock access token for development
 */
export const mockAccessToken = 'mock_dev_token_' + Math.random().toString(36).substring(7);

/**
 * Simulate GitHub login with authorized user
 * This bypasses the OAuth flow and directly sets auth state
 */
export function simulateAuthorizedLogin() {
  return {
    user: mockAuthorizedUser,
    token: mockAccessToken,
    isAuthorized: true,
    userData: {
      email: mockAuthorizedUser.email,
      allowedAt: new Date().toISOString(),
      role: 'developer',
    },
  };
}

/**
 * Simulate GitHub login with unauthorized user
 * This bypasses the OAuth flow and sets user as not authorized
 */
export function simulateUnauthorizedLogin() {
  return {
    user: mockUnauthorizedUser,
    token: mockAccessToken,
    isAuthorized: false,
    userData: null,
  };
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}
