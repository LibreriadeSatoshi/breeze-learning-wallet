'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Cloud, Key, WarningTriangle } from 'iconoir-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { StatusNote } from '@/components/ui/status-note';
import { Mark } from '@/components/brand/logo';
import { validateMnemonic } from '@/lib/bitcoin/mnemonic';
import { useWalletStore } from '@/store/wallet-store';
import {
  startDriveAuthFlow,
  isDriveBackupConfigured,
} from '@/lib/backup/drive-client';
import { useT } from '@/lib/i18n/hook';

type Step = 'method' | 'phrase' | 'password' | 'restoring';

export default function RestoreWalletPage() {
  const t = useT();
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
  const bootstrap = useWalletStore((s) => s.bootstrap);
  const createVault = useWalletStore((s) => s.createVault);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (hasVault === true && !overwriteAcknowledged) {
      setShowOverwriteModal(true);
    }
  }, [hasVault, overwriteAcknowledged]);

  const wordCount = mnemonic.trim().split(/\s+/).filter(Boolean).length;

  const driveAvailable = isDriveBackupConfigured();

  // Asks before overwriting even if the user acts before the vault check resolves.
  const confirmOverwriteFirst = async () => {
    if (overwriteAcknowledged) return false;
    await bootstrap();
    if (!useWalletStore.getState().hasVault) return false;
    setShowOverwriteModal(true);
    return true;
  };

  const handlePhraseSubmit = async () => {
    setError('');
    if (await confirmOverwriteFirst()) return;
    const cleaned = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!validateMnemonic(cleaned)) {
      setError(t('restore.phrase.invalid'));
      return;
    }
    setMnemonic(cleaned);
    setStep('password');
  };

  const handleRestore = async () => {
    setError('');
    if (password.length < 8) {
      setError(t('create.password.tooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('create.password.mismatch'));
      return;
    }
    if (await confirmOverwriteFirst()) return;
    setStep('restoring');
    try {
      await createVault(mnemonic, password);
      router.push('/wallet/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('restore.password.failed'));
      setStep('password');
    }
  };

  const handleDriveRestore = async () => {
    setError('');
    if (await confirmOverwriteFirst()) return;
    try {
      startDriveAuthFlow({ type: 'restore', returnTo: '/welcome' });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('restore.methods.drive.startFailed'));
    }
  };

  const errorNote = error && (
    <p role="alert" className="flex items-start gap-2 text-body-sm text-alert">
      <WarningTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none" />
      {error}
    </p>
  );

  const methodClass =
    'group flex w-full items-start gap-4 rounded border-1.5 border-input bg-surface p-4 text-left transition-colors duration-fast hover:border-strong disabled:cursor-not-allowed disabled:border-hairline disabled:text-logwood-600';

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-12">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-3 mb-6">
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          <span>{t('common.back')}</span>
        </Button>
        <div className="mb-8">
          <Mark size={40} decorative className="mb-6" />
          <h1 className="font-serif text-h2 text-heading sm:text-h1">
            {t('restore.title')}
          </h1>
          <p className="mt-2 text-lead text-fg-muted">
            {step === 'method' && t('restore.subtitle.method')}
            {step === 'phrase' && t('restore.subtitle.phrase')}
            {(step === 'password' || step === 'restoring') && t('restore.subtitle.password')}
          </p>
        </div>

        {step === 'method' && (
          <div className="mb-6 space-y-3">
            <button type="button" onClick={() => setStep('phrase')} className={methodClass}>
              <Key aria-hidden="true" className="mt-0.5 h-6 w-6 flex-none" />
              <div>
                <div className="text-body font-semibold">{t('restore.methods.phrase.title')}</div>
                <div className="text-body-sm text-fg-muted">
                  {t('restore.methods.phrase.subtitle')}
                </div>
              </div>
            </button>
            <button type="button"
              onClick={() => void handleDriveRestore()}
              disabled={!driveAvailable}
              className={methodClass}
            >
              <Cloud aria-hidden="true" className="mt-0.5 h-6 w-6 flex-none" />
              <div>
                <div className="text-body font-semibold">{t('restore.methods.drive.title')}</div>
                <div className={`text-body-sm ${driveAvailable ? 'text-fg-muted' : ''}`}>
                  {driveAvailable
                    ? t('restore.methods.drive.subtitle')
                    : t('restore.methods.drive.notConfigured')}
                </div>
              </div>
            </button>
            {errorNote}
          </div>
        )}

        {step === 'phrase' && (
          <>
            {hasVault && overwriteAcknowledged && (
              <StatusNote status="warning" className="mb-6">
                {t('restore.phrase.overwriteWarning')}
              </StatusNote>
            )}

            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-serif text-h3 text-heading">{t('restore.phrase.title')}</h2>
                  <span
                    className={`inline-flex items-center gap-1 font-mono text-caption tabular-nums ${
                      wordCount === 12 ? 'text-fg' : 'text-fg-muted'
                    }`}
                  >
                    {wordCount === 12 && <Check aria-hidden="true" className="h-5 w-5" />}
                    {t('restore.phrase.wordCount', { count: wordCount })}
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
                  placeholder={t('restore.phrase.placeholder')}
                  className="w-full min-h-[144px] resize-none rounded border-1.5 border-input bg-surface px-3 py-3 font-mono text-body text-fg placeholder:text-logwood-600 transition-colors duration-fast hover:border-strong focus-visible:border-2 focus-visible:border-strong"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {errorNote}
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => void handlePhraseSubmit()}
                  disabled={wordCount !== 12}
                  className="w-full"
                >
                  {t('common.continue')}
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setStep('method')}
                  className="w-full"
                >
                  <ArrowLeft aria-hidden="true" className="h-5 w-5" />
                  <span>{t('restore.phrase.chooseDifferent')}</span>
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {(step === 'password' || step === 'restoring') && (
          <Card className="mb-6">
            <CardContent className="pt-6 space-y-4">
              <Input
                label={t('create.password.label')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('create.password.placeholder')}
                disabled={step === 'restoring'}
                autoFocus
              />
              <Input
                label={t('create.password.confirmLabel')}
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('create.password.confirmPlaceholder')}
                disabled={step === 'restoring'}
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
              {errorNote}
              <Button
                variant="primary"
                size="lg"
                onClick={handleRestore}
                loading={step === 'restoring'}
                disabled={step === 'restoring'}
                className="w-full"
              >
                {step === 'restoring' ? t('restore.password.submitting') : t('restore.password.submit')}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setStep('phrase')}
                disabled={step === 'restoring'}
                className="w-full"
              >
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
                <span>{t('common.back')}</span>
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
        title={t('restore.overwrite.title')}
        description={t('restore.overwrite.description')}
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
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            size="lg"
            onClick={() => {
              setOverwriteAcknowledged(true);
              setShowOverwriteModal(false);
            }}
            className="flex-1"
          >
            {t('restore.overwrite.confirm')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
