"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { MnemonicDisplay } from "@/components/wallet/mnemonic-display";
import { APP_NAME } from "@/lib/config";
import { useWalletStore } from "@/store/wallet-store";
import { useT } from "@/lib/i18n/hook";
import {
  isPasskeySupported,
  registerPasskey,
  signInWithPasskey,
  seedToMnemonic,
} from "@/lib/auth/passkey";
import { mnemonicToWords } from "@/lib/bitcoin/mnemonic";

export default function WelcomePage() {
  const t = useT();
  const router = useRouter();
  const hasVault = useWalletStore((s) => s.hasVault);
  const authMode = useWalletStore((s) => s.authMode);
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const isBootstrapped = useWalletStore((s) => s.isBootstrapped);
  const bootstrap = useWalletStore((s) => s.bootstrap);
  const unlock = useWalletStore((s) => s.unlock);
  const adoptPasskeyWallet = useWalletStore((s) => s.adoptPasskeyWallet);
  const destroyVault = useWalletStore((s) => s.destroyVault);

  const [creatingWallet, setCreatingWallet] = useState(false);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [showForget, setShowForget] = useState(false);
  const [forgetConfirm, setForgetConfirm] = useState("");
  const [forgetting, setForgetting] = useState(false);

  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState("");
  const [passkeyBackupWords, setPasskeyBackupWords] = useState<string[] | null>(null);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await isPasskeySupported();
      if (!cancelled) setPasskeyAvailable(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isBootstrapped && isUnlocked && passkeyBackupWords === null) {
      router.push("/wallet/home");
    }
    // passkeyBackupWords intentionally excluded — the modal close handler
    // already routes; including it here would race the close with a re-nav.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBootstrapped, isUnlocked, router]);

  const handleCreateWallet = () => {
    setCreatingWallet(true);
    router.push("/wallet/create");
  };

  const handleUnlock = async () => {
    if (!password) {
      setError(t("welcome.unlock.passwordRequired"));
      return;
    }
    setError("");
    setUnlocking(true);
    try {
      await unlock(password);
      router.push("/wallet/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("welcome.unlock.failed"));
      setUnlocking(false);
      setPassword("");
    }
  };

  const handlePasskeyCreate = async () => {
    setPasskeyError("");
    setPasskeyBusy(true);
    try {
      const seed = await registerPasskey();
      const mnemonic = seedToMnemonic(seed);
      adoptPasskeyWallet(mnemonic);
      setPasskeyBackupWords(mnemonicToWords(mnemonic));
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : t("welcome.passkey.createFailed"));
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setPasskeyError("");
    setPasskeyBusy(true);
    try {
      const seed = await signInWithPasskey();
      const mnemonic = seedToMnemonic(seed);
      adoptPasskeyWallet(mnemonic);
      router.push("/wallet/home");
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : t("welcome.passkey.signInFailed"));
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleForget = async () => {
    setForgetting(true);
    try {
      await destroyVault();
      setShowForget(false);
      setForgetConfirm("");
      setPassword("");
      setError("");
    } finally {
      setForgetting(false);
    }
  };

  if (!isBootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("common.loading")}</p>
      </div>
    );
  }

  const showPasskeyUnlock = hasVault && authMode === "passkey";
  const showPasswordUnlock = hasVault && authMode !== "passkey";

  return (
    <div className="min-h-screen flex flex-col justify-between px-6 py-6 sm:py-10">
      <div className="flex flex-col items-center pb-6 sm:flex-1 sm:justify-end sm:pb-20">
        <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl mb-4 sm:mb-8">
          <span className="text-3xl sm:text-5xl font-bold text-white">₿</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold mb-2 sm:mb-3 text-center bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
          {APP_NAME}
        </h1>
        <p className="text-center text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-sm px-4">
          {t("welcome.tagline")}
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center space-y-4 max-w-md mx-auto w-full px-6">
        {showPasswordUnlock && (
          <Card className="shadow-lg">
            <CardContent className="pt-6 space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-1">{t("welcome.unlock.title")}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t("welcome.unlock.subtitle")}
                </p>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("welcome.unlock.passwordPlaceholder")}
                disabled={unlocking}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUnlock();
                }}
                autoFocus
              />
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
              <Button
                variant="primary"
                size="lg"
                onClick={handleUnlock}
                loading={unlocking}
                disabled={unlocking}
                className="w-full"
              >
                {unlocking ? t("welcome.unlock.submitting") : t("welcome.unlock.submit")}
              </Button>
              <button
                onClick={() => router.push("/wallet/restore")}
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {t("welcome.unlock.forgotPassword")}
              </button>
              <button
                onClick={() => setShowForget(true)}
                className="w-full text-xs text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
              >
                {t("welcome.unlock.forget")}
              </button>
            </CardContent>
          </Card>
        )}

        {showPasskeyUnlock && (
          <Card className="shadow-lg">
            <CardContent className="pt-6 space-y-4">
              <div className="text-center">
                <Fingerprint className="w-12 h-12 mx-auto text-blue-500 mb-3" />
                <h2 className="text-xl font-semibold mb-1">{t("welcome.passkey.unlockTitle")}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t("welcome.passkey.unlockSubtitle")}
                </p>
              </div>
              {passkeyError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">{passkeyError}</p>
                </div>
              )}
              <Button
                variant="primary"
                size="lg"
                onClick={handlePasskeySignIn}
                loading={passkeyBusy}
                disabled={passkeyBusy}
                className="w-full inline-flex items-center justify-center gap-2"
              >
                <Fingerprint className="w-5 h-5" />
                <span>{t("welcome.passkey.signIn")}</span>
              </Button>
              <button
                onClick={() => router.push("/wallet/restore")}
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {t("welcome.passkey.useRecoveryPhrase")}
              </button>
              <button
                onClick={() => setShowForget(true)}
                className="w-full text-xs text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
              >
                {t("welcome.unlock.forget")}
              </button>
            </CardContent>
          </Card>
        )}

        {!hasVault && (
          <>
            <Button
              variant="primary"
              size="lg"
              onClick={handleCreateWallet}
              loading={creatingWallet}
              className="w-full shadow-lg hover:shadow-xl transition-shadow"
            >
              {creatingWallet ? t("welcome.noVault.creating") : t("welcome.noVault.create")}
            </Button>
            {passkeyAvailable && (
              <Button
                variant="outline"
                size="lg"
                onClick={handlePasskeyCreate}
                loading={passkeyBusy}
                disabled={creatingWallet || passkeyBusy}
                className="w-full inline-flex items-center justify-center gap-2"
              >
                <Fingerprint className="w-5 h-5" />
                <span>{t("welcome.passkey.createWith")}</span>
              </Button>
            )}
            {passkeyError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">{passkeyError}</p>
              </div>
            )}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white dark:bg-gray-900 text-gray-400">
                  {t("welcome.noVault.haveWallet")}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => router.push("/wallet/restore")}
              disabled={creatingWallet || passkeyBusy}
              className="w-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {t("welcome.noVault.restore")}
            </Button>
          </>
        )}
      </div>

      <div className="text-center pb-6">
        <p className="text-xs text-gray-500 dark:text-gray-400 px-8">
          {t("welcome.footer")}
        </p>
      </div>

      <Modal
        open={showForget}
        onClose={() => {
          if (forgetting) return;
          setShowForget(false);
          setForgetConfirm("");
        }}
        dismissable={!forgetting}
        title={t("forgetWallet.title")}
        description={t("forgetWallet.description")}
      >
        <div className="space-y-4">
          <Input
            label={t("forgetWallet.confirmLabel")}
            value={forgetConfirm}
            onChange={(e) => setForgetConfirm(e.target.value)}
            placeholder={t("forgetWallet.confirmPlaceholder")}
            disabled={forgetting}
            autoFocus
          />
          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                setShowForget(false);
                setForgetConfirm("");
              }}
              disabled={forgetting}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={handleForget}
              loading={forgetting}
              disabled={
                forgetting || forgetConfirm.trim().toLowerCase() !== t("forgetWallet.confirmWord")
              }
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {t("forgetWallet.submit")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={passkeyBackupWords !== null}
        onClose={() => {
          setPasskeyBackupWords(null);
          router.push("/wallet/home");
        }}
        title={t("welcome.passkey.backupTitle")}
        description={t("welcome.passkey.backupDescription")}
      >
        {passkeyBackupWords && (
          <div className="space-y-4">
            <MnemonicDisplay words={passkeyBackupWords} revealed />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("welcome.passkey.backupHint")}
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setPasskeyBackupWords(null);
                router.push("/wallet/home");
              }}
              className="w-full"
            >
              {t("welcome.passkey.backupContinue")}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
