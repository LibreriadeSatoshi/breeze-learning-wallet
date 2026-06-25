'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Cloud, Clipboard, KeyRound, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { validateMnemonic } from '@/lib/bitcoin/mnemonic';
import { useWalletStore } from '@/store/wallet-store';
import {
  startDriveAuthFlow,
  isDriveBackupConfigured,
} from '@/lib/backup/drive-client';

type Step = 'method' | 'phrase' | 'password' | 'restoring';

export default function RestoreWalletPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('method');
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

  const driveAvailable = isDriveBackupConfigured();

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

  const handleDriveRestore = () => {
    setError('');
    if (hasVault && !overwriteAcknowledged) {
      setShowOverwriteModal(true);
      return;
    }
    try {
      startDriveAuthFlow({ type: 'restore', returnTo: '/welcome' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Google Drive sign-in');
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
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl mb-4 shadow-lg">
              <span className="text-3xl font-bold text-white">₿</span>
            </div>
            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Restore Wallet
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {step === 'method' && 'Choose how you want to restore your wallet'}
              {step === 'phrase' && 'Enter your 12-word recovery phrase'}
              {(step === 'password' || step === 'restoring') && 'Set a wallet password to encrypt this device'}
            </p>
          </div>
        </div>

        {step === 'method' && (
          <div className="grid grid-cols-1 gap-3 mb-6">
            <button
              onClick={() => setStep('phrase')}
              className="p-5 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 bg-white dark:bg-gray-900 text-left transition-colors flex items-start gap-4"
            >
              <KeyRound className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1" />
              <div>
                <div className="font-semibold">From recovery phrase</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Type your 12 words to restore the wallet on this device.
                </div>
              </div>
            </button>
            <button
              onClick={handleDriveRestore}
              disabled={!driveAvailable}
              className="p-5 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-900 text-left transition-colors flex items-start gap-4"
            >
              <Cloud className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1" />
              <div>
                <div className="font-semibold">From Google Drive</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {driveAvailable
                    ? 'Sign in to your Google account to download your encrypted vault.'
                    : 'Not configured for this build.'}
                </div>
              </div>
            </button>
          </div>
        )}

        {step === 'phrase' && (
          <>
            {hasVault && overwriteAcknowledged && (
              <div className="mb-6 p-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <TriangleAlert className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
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
                  className="w-full inline-flex items-center justify-center gap-2 border-2 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Clipboard className="w-4 h-4" />
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
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setStep('method')}
                  className="w-full inline-flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Choose a different method</span>
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
                className="w-full inline-flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
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
        description="Restoring erases the existing encrypted wallet from this browser. Funds in the existing wallet remain controlled by its recovery phrase — make sure you still have it before continuing."
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
            className="flex-1 bg-amber-600 hover:bg-amber-700"
          >
            Replace wallet
          </Button>
        </div>
      </Modal>
    </div>
  );
}
