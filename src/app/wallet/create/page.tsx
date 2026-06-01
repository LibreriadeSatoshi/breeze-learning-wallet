'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MnemonicDisplay } from '@/components/wallet/mnemonic-display';
import { generateMnemonic, mnemonicToWords } from '@/lib/bitcoin/mnemonic';
import { useWalletStore } from '@/store/wallet-store';

type Step = 'reveal' | 'shown' | 'verify' | 'password' | 'creating';

const VERIFY_SLOTS = 4;

function pickVerifySlots(): number[] {
  const indices = Array.from({ length: 12 }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, VERIFY_SLOTS).sort((a, b) => a - b);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function CreateWalletPage() {
  const router = useRouter();
  const [mnemonic, setMnemonic] = useState<string>('');
  const [words, setWords] = useState<string[]>([]);
  const [step, setStep] = useState<Step>('reveal');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const [verifySlots, setVerifySlots] = useState<number[]>([]);
  const [shuffledChoices, setShuffledChoices] = useState<
    Array<{ word: string; originalIndex: number }>
  >([]);
  const [picks, setPicks] = useState<number[]>([]);
  const [verifyError, setVerifyError] = useState(false);

  const createVault = useWalletStore((s) => s.createVault);

  useEffect(() => {
    const newMnemonic = generateMnemonic();
    setMnemonic(newMnemonic);
    setWords(mnemonicToWords(newMnemonic));
  }, []);

  const buildVerifyChallenge = (mnemonicWords: string[]) => {
    const slots = pickVerifySlots();
    const choices = slots.map((index) => ({
      word: mnemonicWords[index],
      originalIndex: index,
    }));
    setVerifySlots(slots);
    setShuffledChoices(shuffle(choices));
    setPicks([]);
    setVerifyError(false);
  };

  const handleReveal = () => {
    setStep('shown');
  };

  const handleProceedToVerify = () => {
    buildVerifyChallenge(words);
    setStep('verify');
  };

  const handlePickChoice = (choiceIndex: number) => {
    setVerifyError(false);
    if (picks.includes(choiceIndex)) {
      setPicks(picks.filter((i) => i !== choiceIndex));
      return;
    }
    if (picks.length < VERIFY_SLOTS) {
      setPicks([...picks, choiceIndex]);
    }
  };

  const handleSubmitVerify = () => {
    if (picks.length !== VERIFY_SLOTS) return;
    const correct = picks.every((choiceIndex, slot) => {
      return shuffledChoices[choiceIndex].originalIndex === verifySlots[slot];
    });
    if (correct) {
      setStep('password');
    } else {
      setVerifyError(true);
      setPicks([]);
    }
  };

  const handleBackToPhrase = () => {
    setStep('shown');
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
      router.push('/wallet/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
      setStep('password');
    }
  };

  const heading = useMemo(() => {
    switch (step) {
      case 'reveal':
      case 'shown':
        return 'Your Recovery Phrase';
      case 'verify':
        return 'Verify Your Recovery Phrase';
      case 'password':
      case 'creating':
        return 'Set a Wallet Password';
    }
  }, [step]);

  const subheading = useMemo(() => {
    switch (step) {
      case 'reveal':
      case 'shown':
        return 'Write down these 12 words in order and keep them safe. You’ll need them to recover your wallet.';
      case 'verify':
        return 'Tap the words in the order they appear in your phrase. This proves you have a working backup.';
      case 'password':
      case 'creating':
        return 'This password encrypts your wallet on this device. You will need it every time you unlock.';
    }
  }, [step]);

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-900">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            {heading}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
            {subheading}
          </p>
        </div>

        {(step === 'reveal' || step === 'shown') && (
          <>
            <Card className="mb-6 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                      Important Security Information
                    </h3>
                    <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
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
                  onClick={handleProceedToVerify}
                  className="w-full shadow-lg hover:shadow-xl transition-shadow"
                >
                  I&apos;ve Written It Down — Verify
                </Button>
                <Button variant="ghost" size="lg" onClick={() => router.back()} className="w-full">
                  ← Back
                </Button>
              </div>
            )}
          </>
        )}

        {step === 'verify' && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <h3 className="font-semibold">
                  Select words #{verifySlots.map((i) => i + 1).join(', ')} in order
                </h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {verifySlots.map((wordIndex, slotIndex) => (
                    <div
                      key={wordIndex}
                      className="p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 text-center"
                    >
                      <div className="text-xs text-gray-500 mb-1">#{wordIndex + 1}</div>
                      {picks[slotIndex] !== undefined ? (
                        <div className="font-mono font-medium">
                          {shuffledChoices[picks[slotIndex]].word}
                        </div>
                      ) : (
                        <div className="text-gray-400">?</div>
                      )}
                    </div>
                  ))}
                </div>
                {verifyError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      Incorrect order. Tap the words again in the order they appear in your phrase.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <h3 className="font-semibold">Tap words in order</h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {shuffledChoices.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => handlePickChoice(index)}
                      disabled={picks.includes(index)}
                      className={`p-4 rounded-lg border-2 font-mono font-medium transition-all ${
                        picks.includes(index)
                          ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 opacity-50'
                          : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20'
                      }`}
                    >
                      {item.word}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="lg"
                onClick={handleBackToPhrase}
                className="flex-1"
              >
                ← View phrase again
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={handleSubmitVerify}
                disabled={picks.length !== VERIFY_SLOTS}
                className="flex-1"
              >
                Verify
              </Button>
            </div>
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
