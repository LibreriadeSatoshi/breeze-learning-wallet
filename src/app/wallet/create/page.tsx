'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cloud, Eye, Lightbulb, Shield, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MnemonicDisplay } from '@/components/wallet/mnemonic-display';
import { generateMnemonic, mnemonicToWords } from '@/lib/bitcoin/mnemonic';
import { useWalletStore } from '@/store/wallet-store';
import {
  startDriveAuthFlow,
  isDriveBackupConfigured,
} from '@/lib/backup/drive-client';
import { useT } from '@/lib/i18n/hook';

type Step = 'reveal' | 'shown' | 'verify' | 'password' | 'creating' | 'drive-offer';

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
  const t = useT();
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
  const [accepted, setAccepted] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveError, setDriveError] = useState('');

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
      setError(t('create.password.tooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('create.password.mismatch'));
      return;
    }
    setStep('creating');
    try {
      await createVault(mnemonic, password);
      if (isDriveBackupConfigured()) {
        setStep('drive-offer');
      } else {
        router.push('/wallet/home');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('create.password.failed'));
      setStep('password');
    }
  };

  const handleDriveBackup = () => {
    setDriveError('');
    setDriveBusy(true);
    try {
      startDriveAuthFlow({ type: 'backup', returnTo: '/wallet/home' });
    } catch (err) {
      setDriveBusy(false);
      setDriveError(err instanceof Error ? err.message : t('create.drive.failed'));
    }
  };

  const handleSkipDrive = () => {
    router.push('/wallet/home');
  };

  const heading = useMemo(() => {
    switch (step) {
      case 'reveal':
      case 'shown':
        return t('create.heading.phrase');
      case 'verify':
        return t('create.heading.verify');
      case 'password':
      case 'creating':
        return t('create.heading.password');
      case 'drive-offer':
        return t('create.heading.driveOffer');
    }
  }, [step, t]);

  const subheading = useMemo(() => {
    switch (step) {
      case 'reveal':
      case 'shown':
        return t('create.subheading.phrase');
      case 'verify':
        return t('create.subheading.verify');
      case 'password':
      case 'creating':
        return t('create.subheading.password');
      case 'drive-offer':
        return t('create.subheading.driveOffer');
    }
  }, [step, t]);

  const isReveal = step === 'reveal';

  return (
    <div className="min-h-screen p-4 md:p-6 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-900">
      <div className={`mx-auto ${isReveal ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <div className={`text-center ${isReveal ? 'mb-4' : 'mb-8'}`}>
          <div className={`inline-flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl shadow-lg ${isReveal ? 'w-12 h-12 mb-2' : 'w-16 h-16 mb-4'}`}>
            <span className={`font-bold text-white ${isReveal ? 'text-2xl' : 'text-3xl'}`}>₿</span>
          </div>
          <h1 className={`font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent ${isReveal ? 'text-2xl md:text-3xl mb-1' : 'text-2xl sm:text-3xl md:text-4xl mb-2 md:mb-3'}`}>
            {heading}
          </h1>
          <p className={`text-gray-600 dark:text-gray-400 max-w-lg mx-auto ${isReveal ? 'text-sm' : ''}`}>
            {subheading}
          </p>
        </div>

        {(step === 'reveal' || step === 'shown') && (
          <>
            {isReveal ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <Card className="border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <TriangleAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                        {t('create.security.title')}
                      </h3>
                    </div>
                    <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1 list-disc pl-5">
                      <li>{t('create.security.neverShare')}</li>
                      <li>{t('create.security.storeOffline')}</li>
                      <li>{t('create.security.anyoneCanAccess')}</li>
                    </ul>
                  </CardHeader>
                </Card>

                <Card className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20">
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                        {t('create.whyMatters.title')}
                      </h3>
                    </div>
                    <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1.5 pl-7">
                      <p>
                        <strong className="font-semibold">{t('create.whyMatters.selfCustody.title')}</strong>{' '}
                        {t('create.whyMatters.selfCustody.body')}
                      </p>
                      <p>
                        <strong className="font-semibold">{t('create.whyMatters.censorshipResistant.title')}</strong>{' '}
                        {t('create.whyMatters.censorshipResistant.body')}
                      </p>
                    </div>
                  </CardHeader>
                </Card>
              </div>
            ) : (
              <Card className="mb-6 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <TriangleAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                      {t('create.security.title')}
                    </h3>
                  </div>
                  <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1 list-disc pl-5">
                    <li>{t('create.security.neverShare')}</li>
                    <li>{t('create.security.storeOffline')}</li>
                    <li>{t('create.security.anyoneCanAccess')}</li>
                  </ul>
                </CardHeader>
              </Card>
            )}

            <Card className={isReveal ? '' : 'mb-6'}>
              <CardContent className={isReveal ? 'pt-4 pb-4' : 'pt-6'}>
                {isReveal ? (
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {t('create.reveal.subtitle')}
                    </p>
                    <label className="flex items-start sm:items-center justify-center gap-2 mb-3 cursor-pointer text-left sm:text-center max-w-md mx-auto">
                      <input
                        type="checkbox"
                        checked={accepted}
                        onChange={(e) => setAccepted(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 mt-0.5 sm:mt-0 shrink-0"
                      />
                      <span className="text-sm">{t('create.reveal.acceptTerms')}</span>
                    </label>
                    <Button
                      onClick={handleReveal}
                      variant="primary"
                      size="lg"
                      disabled={!accepted}
                      className="inline-flex items-center gap-2"
                    >
                      <Eye className="w-5 h-5" />
                      <span>{t('create.reveal.accept')}</span>
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 flex items-start gap-2">
                      <TriangleAlert className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <p className="text-sm text-amber-900 dark:text-amber-200">
                        <strong className="font-semibold">{t('create.orderMatters.title')}</strong>{' '}
                        {t('create.orderMatters.body')}
                      </p>
                    </div>
                    <MnemonicDisplay words={words} revealed />
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 mt-0.5 text-blue-700 dark:text-blue-300 shrink-0" />
                        <p className="text-sm text-blue-900 dark:text-blue-200">
                          {t('create.tip')}
                        </p>
                      </div>
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
                  {t('create.writtenDown')}
                </Button>
                <Button variant="ghost" size="lg" onClick={() => router.back()} className="w-full">
                  ← {t('common.back')}
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
                  {t('create.verify.selectInOrder', { slots: verifySlots.map((i) => `#${i + 1}`).join(', ') })}
                </h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {verifySlots.map((wordIndex, slotIndex) => (
                    <div
                      key={wordIndex}
                      className="p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 text-center min-w-0"
                    >
                      <div className="text-xs text-gray-500 mb-1">#{wordIndex + 1}</div>
                      {picks[slotIndex] !== undefined ? (
                        <div className="font-mono font-medium truncate">
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
                      {t('create.verify.incorrect')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <h3 className="font-semibold">{t('create.verify.tapInOrder')}</h3>
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

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <Button
                variant="ghost"
                size="lg"
                onClick={handleBackToPhrase}
                className="w-full sm:flex-1"
              >
                ← {t('create.verify.viewAgain')}
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={handleSubmitVerify}
                disabled={picks.length !== VERIFY_SLOTS}
                className="w-full sm:flex-1"
              >
                {t('create.verify.submit')}
              </Button>
            </div>
          </>
        )}

        {(step === 'password' || step === 'creating') && (
          <Card className="mb-6 shadow-lg">
            <CardContent className="pt-6 space-y-4">
              <Input
                label={t('create.password.label')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('create.password.placeholder')}
                disabled={step === 'creating'}
                autoFocus
              />
              <Input
                label={t('create.password.confirmLabel')}
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('create.password.confirmPlaceholder')}
                disabled={step === 'creating'}
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm">{t('create.password.show')}</span>
              </label>
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('create.password.noRecovery')}
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={handleCreate}
                loading={step === 'creating'}
                disabled={step === 'creating'}
                className="w-full shadow-lg hover:shadow-xl transition-shadow"
              >
                {step === 'creating' ? t('create.password.creating') : t('create.password.submit')}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'drive-offer' && (
          <Card className="mb-6 shadow-lg">
            <CardContent className="pt-6 space-y-4">
              <div className="text-center text-blue-600 dark:text-blue-400">
                <Cloud className="w-12 h-12 mx-auto" />
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                <p>{t('create.drive.blurbCiphertext')}</p>
                <p>{t('create.drive.blurbConvenience')}</p>
              </div>
              {driveError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">{driveError}</p>
                </div>
              )}
              <Button
                variant="primary"
                size="lg"
                onClick={handleDriveBackup}
                loading={driveBusy}
                disabled={driveBusy}
                className="w-full inline-flex items-center justify-center gap-2"
              >
                <Cloud className="w-4 h-4" />
                <span>{t('create.drive.backup')}</span>
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={handleSkipDrive}
                disabled={driveBusy}
                className="w-full"
              >
                {t('common.skip')}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
