'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { exchangeCodeForToken, getGitHubUser } from '@/lib/auth/github';
import { useAuthStore } from '@/lib/auth/auth-store';

export function GitHubCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setGitHubAuth, setAuthorization } = useAuthStore();

  const [status, setStatus] = useState<'loading' | 'checking' | 'success' | 'unauthorized' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code || !state) {
          throw new Error('Missing authorization code or state');
        }

        setStatus('loading');

        // Exchange code for token
        const accessToken = await exchangeCodeForToken(code, state);
        if (!accessToken) {
          throw new Error('Failed to get access token');
        }

        // Get user profile
        const user = await getGitHubUser(accessToken);
        if (!user) {
          throw new Error('Failed to get user profile');
        }

        // Store GitHub authentication
        setGitHubAuth(user, accessToken);
        setUserEmail(user.email);

        // Check authorization in external database
        setStatus('checking');
        const authResponse = await fetch('/api/auth/check-authorization', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: user.email }),
        });

        if (!authResponse.ok) {
          throw new Error('Failed to check authorization');
        }

        const authData = await authResponse.json();

        if (!authData.authorized) {
          // Email not authorized
          setAuthorization(false);
          setStatus('unauthorized');
          return;
        }

        // Email is authorized
        setAuthorization(true, authData.userData);
        setStatus('success');

        // Redirect to welcome page (with auth context)
        setTimeout(() => {
          router.push('/welcome');
        }, 1500);
      } catch (err: unknown) {
        console.error('GitHub callback error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        setError(errorMessage);
        setStatus('error');
      }
    };

    handleCallback();
  }, [searchParams, router, setGitHubAuth, setAuthorization]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <Card>
          <CardContent className="pt-6 text-center">
            {status === 'loading' && (
              <>
                <div className="mb-4">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                </div>
                <h2 className="text-xl font-semibold mb-2">Authenticating with GitHub</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Please wait while we complete the authentication...
                </p>
              </>
            )}

            {status === 'checking' && (
              <>
                <div className="mb-4">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                </div>
                <h2 className="text-xl font-semibold mb-2">Checking Authorization</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Verifying your email: {userEmail}
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="mb-4">
                  <span className="text-6xl">&#10004;</span>
                </div>
                <h2 className="text-xl font-semibold text-green-600 dark:text-green-400 mb-2">
                  Authorization Successful!
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  Welcome! Your email is authorized.
                </p>
                <p className="text-sm text-gray-500">
                  Redirecting to wallet...
                </p>
              </>
            )}

            {status === 'unauthorized' && (
              <>
                <div className="mb-4">
                  <span className="text-6xl">&#128683;</span>
                </div>
                <h2 className="text-xl font-semibold text-orange-600 dark:text-orange-400 mb-2">
                  Email Not Authorized
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Your email <strong>{userEmail}</strong> is not authorized to create a wallet.
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Please contact the administrator to request access.
                </p>
                <button
                  onClick={() => {
                    // Clear auth and go back to welcome
                    useAuthStore.getState().clearAuth();
                    router.push('/welcome');
                  }}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Return to Welcome
                </button>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="mb-4">
                  <span className="text-6xl">&#10060;</span>
                </div>
                <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
                  Authentication Failed
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                <button
                  onClick={() => router.push('/welcome')}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Return to Welcome
                </button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
