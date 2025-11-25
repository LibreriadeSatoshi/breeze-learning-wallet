'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { validateMnemonic } from '@/lib/bitcoin/mnemonic';
import { useWalletStore } from '@/store/wallet-store';

export default function RestoreWalletPage() {
  const router = useRouter();
  const [mnemonic, setMnemonic] = useState('');
  const [error, setError] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  
  const { setTemporaryMnemonic, setInitialized } = useWalletStore();

  const wordCount = mnemonic.trim().split(/\s+/).filter(Boolean).length;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setMnemonic(text);
        setError('');
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      setError('Failed to access clipboard. Please paste manually.');
    }
  };

  const handleRestore = async () => {
    setError('');
    setIsRestoring(true);

    try {
      const cleanedMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
      
      if (!validateMnemonic(cleanedMnemonic)) {
        throw new Error('Invalid recovery phrase. Please check the words and try again.');
      }

      setTemporaryMnemonic(cleanedMnemonic);
      setInitialized(true);

      await new Promise(resolve => setTimeout(resolve, 500));
      router.push('/wallet/home');
    } catch (err: any) {
      console.error('Restore failed:', err);
      setError(err.message || 'Failed to restore wallet. Please try again.');
      setIsRestoring(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            ←
          </button>
          <div>
            <h1 className="text-3xl font-bold">Restore Wallet</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Enter your 12-word recovery phrase
            </p>
          </div>
        </div>

        <Card className="mb-6 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔑</span>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                  Recovery Phrase Required
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Enter the 12 words you saved when creating your wallet. Make sure they are in the correct order and spelled correctly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Recovery Phrase</h2>
              <span className={`text-sm px-2 py-1 rounded ${
                wordCount === 12 
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}>
                {wordCount}/12 words
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <textarea
                value={mnemonic}
                onChange={(e) => {
                  setMnemonic(e.target.value);
                  setError('');
                }}
                placeholder="word1 word2 word3 ... word12"
                className="w-full min-h-[120px] px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none font-mono text-sm"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>

            <Button
              variant="outline"
              onClick={handlePaste}
              className="w-full flex items-center justify-center gap-2"
            >
              <span>📋</span>
              <span>Paste from Clipboard</span>
            </Button>

            <Button
              variant="primary"
              size="lg"
              onClick={handleRestore}
              disabled={wordCount !== 12 || isRestoring}
              loading={isRestoring}
              className="w-full"
            >
              {isRestoring ? 'Restoring...' : 'Restore Wallet'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 dark:text-orange-200 mb-1">
                  Important Security Notice
                </h3>
                <ul className="text-sm text-orange-800 dark:text-orange-300 space-y-1 list-disc list-inside">
                  <li>Never share your recovery phrase with anyone</li>
                  <li>Make sure you are on the correct website</li>
                  <li>Store your phrase in a safe place offline</li>
                  <li>This phrase gives complete access to your funds</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
