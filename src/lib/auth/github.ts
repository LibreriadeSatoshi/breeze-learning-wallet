/**
 * GitHub OAuth2 Authentication
 * Handles GitHub login flow for wallet authentication
 */

// GitHub OAuth2 configuration
const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '';
const GITHUB_REDIRECT_URI = typeof window !== 'undefined'
  ? `${window.location.origin}/auth/github/callback`
  : '';

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

/**
 * Initiate GitHub OAuth flow
 */
export function loginWithGitHub(): void {
  if (!GITHUB_CLIENT_ID) {
    console.error('GitHub Client ID not configured');
    alert('GitHub authentication is not configured. Please add NEXT_PUBLIC_GITHUB_CLIENT_ID to your .env file.');
    return;
  }

  // Build OAuth URL
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: 'read:user user:email',
    state: generateState(), // CSRF protection
  });

  // Store state in sessionStorage for verification
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('github_oauth_state', params.get('state') || '');
  }

  // Redirect to GitHub
  window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string, state: string): Promise<string | null> {
  try {
    // Verify state to prevent CSRF
    const savedState = sessionStorage.getItem('github_oauth_state');
    if (state !== savedState) {
      throw new Error('Invalid state parameter');
    }
    sessionStorage.removeItem('github_oauth_state');

    // Exchange code for token via backend API
    const response = await fetch('/api/auth/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('GitHub token exchange failed:', error);
    return null;
  }
}

/**
 * Get GitHub user profile
 */
export async function getGitHubUser(accessToken: string): Promise<GitHubUser | null> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get GitHub user:', error);
    return null;
  }
}

/**
 * Generate random state for CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Store GitHub user session
 */
export function storeGitHubSession(user: GitHubUser, accessToken: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('github_user', JSON.stringify(user));
    localStorage.setItem('github_token', accessToken);
  }
}

/**
 * Get stored GitHub session
 */
export function getGitHubSession(): { user: GitHubUser; token: string } | null {
  if (typeof window === 'undefined') return null;

  const userStr = localStorage.getItem('github_user');
  const token = localStorage.getItem('github_token');

  if (!userStr || !token) return null;

  try {
    return {
      user: JSON.parse(userStr),
      token,
    };
  } catch {
    return null;
  }
}

/**
 * Clear GitHub session
 */
export function clearGitHubSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('github_user');
    localStorage.removeItem('github_token');
  }
}
