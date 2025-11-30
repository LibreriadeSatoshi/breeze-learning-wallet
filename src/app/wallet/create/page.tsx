'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MnemonicDisplay } from '@/components/wallet/mnemonic-display';
import { generateMnemonic, mnemonicToWords } from '@/lib/bitcoin/mnemonic';
import { useWalletStore } from '@/store/wallet-store';

export default function CreateWalletPage() {
  const router = useRouter();
  const [mnemonic, setMnemonic] = useState<string>('');
  const [words, setWords] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const { setTemporaryMnemonic, setEncryptedMnemonic } = useWalletStore();

  useEffect(() => {
    // Generate mnemonic on mount
    const newMnemonic = generateMnemonic();
    setMnemonic(newMnemonic);
    setWords(mnemonicToWords(newMnemonic));
  }, []);

  const handleContinue = () => {
    // Store mnemonic for use throughout the session and persist it
    setTemporaryMnemonic(mnemonic);
    setEncryptedMnemonic(mnemonic); // TODO: Encrypt this in production!
    // Go to cloud backup first (user can choose manual if they prefer)
    router.push('/wallet/cloud-backup');
  };

  const handleReveal = () => {
    setRevealed(true);
    setConfirmed(true);
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-orange-50 to-white dark:from-gray-900 dark:to-gray-900">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            Your Recovery Phrase
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
            Write down these 12 words in order and keep them safe. You&apos;ll need them to recover your wallet.
          </p>
        </div>

        {/* Warning Card */}
        <Card className="mb-6 border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-semibold text-orange-900 dark:text-orange-200 mb-1">
                  Important Security Information
                </h3>
                <ul className="text-sm text-orange-800 dark:text-orange-300 space-y-1">
                  <li>• Never share your recovery phrase with anyone</li>
                  <li>• Store it offline in a secure location</li>
                  <li>• Anyone with these words can access your funds</li>
                  <li>• Satoshi Scholar will never ask for your recovery phrase</li>
                </ul>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Mnemonic Display */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            {!revealed ? (
              <div className="text-center py-12">
                <div className="mb-6">
                  <span className="text-6xl">🔒</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">Tap to reveal your recovery phrase</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Make sure no one is looking at your screen
                </p>
                <Button onClick={handleReveal} variant="primary" size="lg">
                  Reveal Recovery Phrase
                </Button>
              </div>
            ) : (
              <div>
                <MnemonicDisplay words={words} revealed={revealed} />

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                  <p className="text-sm text-blue-900 dark:text-blue-200">
                    💡 <strong>Tip:</strong> Write these words on paper in the exact order shown.
                    Do not take a screenshot or store digitally.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {confirmed && (
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={handleContinue}
              className="w-full shadow-lg hover:shadow-xl transition-shadow"
            >
              ✅ I&apos;ve Written It Down
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => router.back()}
              className="w-full"
            >
              ← Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
