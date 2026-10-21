'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Cloud, Eye, WarningTriangle } from 'iconoir-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusNote } from '@/components/ui/status-note';
import { Mark } from '@/components/brand/logo';
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

  const securityNote = (
    <StatusNote status="warning" quiet className="h-full">
      <p className="font-semibold">{t('create.security.title')}</p>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        <li>{t('create.security.neverShare')}</li>
        <li>{t('create.security.storeOffline')}</li>
        <li>{t('create.security.anyoneCanAccess')}</li>
      </ul>
    </StatusNote>
  );

  const errorText = (message: string) => (
    <p role="alert" className="flex items-start gap-2 text-body-sm text-alert">
      <WarningTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none" />
      {message}
    </p>
  );

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-12">
      <div className={`mx-auto ${isReveal ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <div className={isReveal ? 'mb-6' : 'mb-8'}>
          <Mark size={40} decorative className="mb-6" />
          <h1 className="font-serif text-h2 text-heading sm:text-h1">
            {heading}
          </h1>
          <p className="mt-2 max-w-reading text-lead text-fg-muted">
            {subheading}
          </p>
        </div>

        {(step === 'reveal' || step === 'shown') && (
          <>
            {isReveal ? (
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                {securityNote}
                <StatusNote status="info" className="h-full">
                  <p className="font-semibold">{t('create.whyMatters.title')}</p>
                  <div className="mt-2 space-y-2">
                    <p>
                      <strong className="font-semibold">{t('create.whyMatters.selfCustody.title')}</strong>{' '}
                      {t('create.whyMatters.selfCustody.body')}
                    </p>
                    <p>
                      <strong className="font-semibold">{t('create.whyMatters.censorshipResistant.title')}</strong>{' '}
                      {t('create.whyMatters.censorshipResistant.body')}
                    </p>
                  </div>
                </StatusNote>
              </div>
            ) : (
              <div className="mb-6">{securityNote}</div>
            )}

            <Card className="mb-6">
              <CardContent className="pt-6">
                {isReveal ? (
                  <div>
                    <p className="text-body text-fg-muted">
                      {t('create.reveal.subtitle')}
                    </p>
                    <label className="mt-4 flex min-h-control cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={accepted}
                        onChange={(e) => setAccepted(e.target.checked)}
                        className="mt-1 h-5 w-5 flex-none accent-action"
                      />
                      <span className="text-body-sm">{t('create.reveal.acceptTerms')}</span>
                    </label>
                    <Button
                      onClick={handleReveal}
                      variant="primary"
                      size="lg"
                      disabled={!accepted}
                      className="mt-4 w-full sm:w-auto"
                    >
                      <Eye aria-hidden="true" className="h-5 w-5" />
                      <span>{t('create.reveal.accept')}</span>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <StatusNote status="info">{t('create.tip')}</StatusNote>
                    <MnemonicDisplay words={words} revealed />
                    <StatusNote status="warning">
                      <strong className="font-semibold">{t('create.orderMatters.title')}</strong>{' '}
                      {t('create.orderMatters.body')}
                    </StatusNote>
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
                  className="w-full"
                >
                  {t('create.writtenDown')}
                </Button>
                <Button variant="ghost" size="lg" onClick={() => router.back()} className="w-full">
                  <ArrowLeft aria-hidden="true" className="h-5 w-5" />
                  <span>{t('common.back')}</span>
                </Button>
              </div>
            )}
          </>
        )}

        {step === 'verify' && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <h2 className="font-serif text-h3 text-heading">
                  {t('create.verify.selectInOrder', { slots: verifySlots.map((i) => `#${i + 1}`).join(', ') })}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {verifySlots.map((wordIndex, slotIndex) => {
                    const filled = picks[slotIndex] !== undefined;
                    return (
                      <div
                        key={wordIndex}
                        className={`min-w-0 rounded px-3 py-2 font-mono ${
                          filled ? 'border-1.5 border-strong bg-surface' : 'border border-hairline bg-raised'
                        }`}
                      >
                        <div className="text-caption tabular-nums text-fg-muted">#{wordIndex + 1}</div>
                        {filled ? (
                          <div className="truncate text-body font-medium text-fg">
                            {shuffledChoices[picks[slotIndex]].word}
                          </div>
                        ) : (
                          <div className="text-body text-fg-muted">?</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {verifyError && errorText(t('create.verify.incorrect'))}
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <h2 className="font-serif text-h3 text-heading">{t('create.verify.tapInOrder')}</h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {shuffledChoices.map((item, index) => (
                    <button type="button"
                      key={item.originalIndex}
                      onClick={() => handlePickChoice(index)}
                      disabled={picks.includes(index)}
                      className="min-h-field rounded border-1.5 border-input bg-surface px-3 font-mono text-body font-medium text-fg transition-colors duration-fast hover:border-strong disabled:cursor-not-allowed disabled:border-hairline disabled:bg-raised disabled:text-logwood-600"
                    >
                      {item.word}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button
                variant="ghost"
                size="lg"
                onClick={handleBackToPhrase}
                className="w-full sm:flex-1"
              >
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
                <span>{t('create.verify.viewAgain')}</span>
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
          <Card className="mb-6">
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
              <label className="flex min-h-control cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="h-5 w-5 flex-none accent-action"
                />
                <span className="text-body-sm">{t('create.password.show')}</span>
              </label>
              {error && errorText(error)}
              <p className="text-caption text-fg-muted">
                {t('create.password.noRecovery')}
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={handleCreate}
                loading={step === 'creating'}
                disabled={step === 'creating'}
                className="w-full"
              >
                {step === 'creating' ? t('create.password.creating') : t('create.password.submit')}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'drive-offer' && (
          <Card className="mb-6">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2 text-body text-fg">
                <p>{t('create.drive.blurbCiphertext')}</p>
                <p>{t('create.drive.blurbConvenience')}</p>
              </div>
              {driveError && errorText(driveError)}
              <Button
                variant="primary"
                size="lg"
                onClick={handleDriveBackup}
                loading={driveBusy}
                disabled={driveBusy}
                className="w-full"
              >
                <Cloud aria-hidden="true" className="h-5 w-5" />
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
