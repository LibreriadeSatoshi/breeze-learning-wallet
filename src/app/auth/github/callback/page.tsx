import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { GitHubCallbackClient } from './github-callback-client';

function GitHubCallbackFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="mb-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
            <h2 className="text-xl font-semibold mb-2">Authenticating with GitHub</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we complete the authentication...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function GitHubCallbackPage() {
  return (
    <Suspense fallback={<GitHubCallbackFallback />}>
      <GitHubCallbackClient />
    </Suspense>
  );
}
