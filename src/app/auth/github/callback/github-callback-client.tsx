'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { supabaseUserToGitHubUser } from '@/lib/auth/github';
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
        setStatus('loading');

        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const code = hashParams.get('code') || searchParams.get('code');

        if (code) {
          const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw new Error(exchangeError.message || 'Failed to exchange code for session');
          }

          if (!sessionData.session) {
            throw new Error('No session found after code exchange');
          }

          const user = sessionData.session.user;
          setUserEmail(user.email || '');

          const githubUser = supabaseUserToGitHubUser(user);
          if (!githubUser) {
            throw new Error('Failed to parse user data');
          }

          setGitHubAuth(githubUser, sessionData.session.access_token);

          setStatus('checking');
          const syncResponse = await fetch('/api/auth/sync-student', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: user.email,
              githubUsername: githubUser.login,
            }),
          });

          if (!syncResponse.ok) {
            const errorData = await syncResponse.json();
            throw new Error(errorData.error || 'Failed to sync student');
          }

          const syncData = await syncResponse.json();

          if (!syncData.success) {
            throw new Error('Failed to sync student to database');
          }

          setAuthorization(true, syncData.student);
          setStatus('success');

          setTimeout(() => {
            router.push('/welcome');
          }, 1500);
        } else {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

          if (sessionError || !sessionData.session) {
            throw new Error('No authentication code or session found');
          }

          const user = sessionData.session.user;
          setUserEmail(user.email || '');

          const githubUser = supabaseUserToGitHubUser(user);
          if (githubUser) {
            setGitHubAuth(githubUser, sessionData.session.access_token);
            setAuthorization(true, null);
            setStatus('success');
            setTimeout(() => {
              router.push('/welcome');
            }, 1500);
          } else {
            throw new Error('Failed to parse user data');
          }
        }
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
                <h2 className="text-xl font-semibold mb-2">Setting Up Your Account</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Syncing your account: {userEmail}
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="mb-4">
                  <span className="text-6xl">&#10004;</span>
                </div>
                <h2 className="text-xl font-semibold text-green-600 dark:text-green-400 mb-2">
                  Account Ready!
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  Your account has been synced successfully.
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
