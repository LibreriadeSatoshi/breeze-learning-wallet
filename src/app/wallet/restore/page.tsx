'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { validateMnemonic } from '@/lib/bitcoin/mnemonic';
import { useWalletStore } from '@/store/wallet-store';

type Step = 'phrase' | 'password' | 'restoring';

export default function RestoreWalletPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phrase');
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [overwriteAcknowledged, setOverwriteAcknowledged] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);

  const hasVault = useWalletStore((s) => s.hasVault);
  const createVault = useWalletStore((s) => s.createVault);

  useEffect(() => {
    if (hasVault === true && !overwriteAcknowledged) {
      setShowOverwriteModal(true);
    }
  }, [hasVault, overwriteAcknowledged]);

  const wordCount = mnemonic.trim().split(/\s+/).filter(Boolean).length;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setMnemonic(text);
        setError('');
      }
    } catch {
      setError('Failed to access clipboard. Please paste manually.');
    }
  };

  const handlePhraseSubmit = () => {
    setError('');
    if (hasVault && !overwriteAcknowledged) {
      setShowOverwriteModal(true);
      return;
    }
    const cleaned = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!validateMnemonic(cleaned)) {
      setError('Invalid recovery phrase. Please check the words and try again.');
      return;
    }
    setMnemonic(cleaned);
    setStep('password');
  };

  const handleRestore = async () => {
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setStep('restoring');
    try {
      await createVault(mnemonic, password);
      router.push('/wallet/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore wallet');
      setStep('password');
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-900">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-4 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors inline-flex items-center gap-2 text-gray-600 dark:text-gray-400"
          >
            ← Back
          </button>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl mb-4 shadow-lg">
              <span className="text-3xl">🔑</span>
            </div>
            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Restore Wallet
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {step === 'phrase' ? 'Enter your 12-word recovery phrase' : 'Set a wallet password to encrypt this device'}
            </p>
          </div>
        </div>

        {step === 'phrase' && (
          <>
            {hasVault && overwriteAcknowledged && (
              <div className="mb-6 p-4 rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20 text-sm text-orange-800 dark:text-orange-300 flex items-start gap-3">
                <span className="text-lg leading-none">⚠️</span>
                <span>
                  Restoring will replace the existing wallet on this device. Make sure
                  you still have its recovery phrase before continuing.
                </span>
              </div>
            )}

            <Card className="mb-6 shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recovery Phrase</h2>
                  <span className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${
                    wordCount === 12
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}>
                    {wordCount}/12 words
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  value={mnemonic}
                  onChange={(e) => {
                    setMnemonic(e.target.value);
                    setError('');
                  }}
                  placeholder="word1 word2 word3 ... word12"
                  className="w-full min-h-[140px] px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm transition-colors"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={handlePaste}
                  className="w-full flex items-center justify-center gap-2 border-2 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <span>📋</span>
                  <span>Paste from clipboard</span>
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handlePhraseSubmit}
                  disabled={wordCount !== 12}
                  className="w-full shadow-lg hover:shadow-xl transition-shadow"
                >
                  Continue
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {(step === 'password' || step === 'restoring') && (
          <Card className="mb-6 shadow-lg">
            <CardContent className="pt-6 space-y-4">
              <Input
                label="Wallet password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={step === 'restoring'}
                autoFocus
              />
              <Input
                label="Confirm password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                disabled={step === 'restoring'}
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
              <Button
                variant="primary"
                size="lg"
                onClick={handleRestore}
                loading={step === 'restoring'}
                disabled={step === 'restoring'}
                className="w-full shadow-lg hover:shadow-xl transition-shadow"
              >
                {step === 'restoring' ? 'Restoring…' : 'Restore wallet'}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setStep('phrase')}
                disabled={step === 'restoring'}
                className="w-full"
              >
                ← Back
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Modal
        open={showOverwriteModal}
        onClose={() => {
          setShowOverwriteModal(false);
          if (!overwriteAcknowledged) router.back();
        }}
        title="Replace the wallet on this device?"
        description="Entering a recovery phrase erases the existing encrypted wallet from this browser. Funds in the existing wallet remain controlled by its recovery phrase — make sure you still have it before continuing."
      >
        <div className="flex gap-3">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              setShowOverwriteModal(false);
              router.back();
            }}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setOverwriteAcknowledged(true);
              setShowOverwriteModal(false);
            }}
            className="flex-1 bg-orange-600 hover:bg-orange-700"
          >
            Replace wallet
          </Button>
        </div>
      </Modal>
    </div>
  );
}
