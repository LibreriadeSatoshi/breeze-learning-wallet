'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MnemonicDisplay } from '@/components/wallet/mnemonic-display';
import { generateMnemonic, mnemonicToWords } from '@/lib/bitcoin/mnemonic';
import { useWalletStore } from '@/store/wallet-store';

type Step = 'reveal' | 'shown' | 'password' | 'creating';

export default function CreateWalletPage() {
  const router = useRouter();
  const [mnemonic, setMnemonic] = useState<string>('');
  const [words, setWords] = useState<string[]>([]);
  const [step, setStep] = useState<Step>('reveal');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const createVault = useWalletStore((s) => s.createVault);

  useEffect(() => {
    const newMnemonic = generateMnemonic();
    setMnemonic(newMnemonic);
    setWords(mnemonicToWords(newMnemonic));
  }, []);

  const handleReveal = () => {
    setStep('shown');
  };

  const handleContinue = () => {
    setStep('password');
  };

  const handleCreate = async () => {
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setStep('creating');
    try {
      await createVault(mnemonic, password);
      router.push('/wallet/backup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
      setStep('password');
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-orange-50 to-white dark:from-gray-900 dark:to-gray-900">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            {step === 'password' || step === 'creating' ? 'Set a Wallet Password' : 'Your Recovery Phrase'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
            {step === 'password' || step === 'creating'
              ? 'This password encrypts your wallet on this device. You will need it every time you unlock.'
              : 'Write down these 12 words in order and keep them safe. You’ll need them to recover your wallet.'}
          </p>
        </div>

        {(step === 'reveal' || step === 'shown') && (
          <>
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
                    </ul>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="mb-6">
              <CardContent className="pt-6">
                {step === 'reveal' ? (
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
                    <MnemonicDisplay words={words} revealed />
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

            {step === 'shown' && (
              <div className="flex flex-col gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleContinue}
                  className="w-full shadow-lg hover:shadow-xl transition-shadow"
                >
                  ✅ I&apos;ve Written It Down
                </Button>
                <Button variant="ghost" size="lg" onClick={() => router.back()} className="w-full">
                  ← Back
                </Button>
              </div>
            )}
          </>
        )}

        {(step === 'password' || step === 'creating') && (
          <Card className="mb-6 shadow-lg">
            <CardContent className="pt-6 space-y-4">
              <Input
                label="Wallet password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={step === 'creating'}
                autoFocus
              />
              <Input
                label="Confirm password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                disabled={step === 'creating'}
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm">Show passwords</span>
              </label>
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                There is no password recovery. If you forget this password, restore the wallet from your recovery phrase.
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={handleCreate}
                loading={step === 'creating'}
                disabled={step === 'creating'}
                className="w-full shadow-lg hover:shadow-xl transition-shadow"
              >
                {step === 'creating' ? 'Encrypting…' : 'Create wallet'}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setStep('shown')}
                disabled={step === 'creating'}
                className="w-full"
              >
                ← Back
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
