"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fingerprint, Translate, WarningTriangle } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { MnemonicDisplay } from "@/components/wallet/mnemonic-display";
import { Lockup } from "@/components/brand/logo";
import { useWalletStore } from "@/store/wallet-store";
import { useT } from "@/lib/i18n/hook";
import {
  isPasskeySupported,
  registerPasskey,
  signInWithPasskey,
  seedToMnemonic,
} from "@/lib/auth/passkey";
import { mnemonicToWords } from "@/lib/bitcoin/mnemonic";
import { LanguagePickerSection } from "@/components/ui/language-picker";

export default function WelcomePage() {
  const t = useT();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

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
  const [passkeyMode, setPasskeyMode] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState<"create" | "signIn" | null>(null);
  const [passkeyError, setPasskeyError] = useState("");
  const [passkeyBackupWords, setPasskeyBackupWords] = useState<string[] | null>(null);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
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
    setPasskeyBusy("create");
    try {
      const seed = await registerPasskey();
      const mnemonic = seedToMnemonic(seed);
      adoptPasskeyWallet(mnemonic);
      setPasskeyBackupWords(mnemonicToWords(mnemonic));
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : t("welcome.passkey.createFailed"));
    } finally {
      setPasskeyBusy(null);
    }
  };

  const handlePasskeySignIn = async () => {
    setPasskeyError("");
    setPasskeyBusy("signIn");
    try {
      const seed = await signInWithPasskey();
      const mnemonic = seedToMnemonic(seed);
      adoptPasskeyWallet(mnemonic);
      router.push("/wallet/home");
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : t("welcome.passkey.signInFailed"));
    } finally {
      setPasskeyBusy(null);
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
        <p className="text-body-sm text-fg-muted">{t("common.loading")}</p>
      </div>
    );
  }

  const showPasskeyUnlock = hasVault && authMode === "passkey";
  const showPasswordUnlock = hasVault && authMode !== "passkey";

  const errorText = (message: string) => (
    <p role="alert" className="flex items-start gap-2 text-body-sm text-alert">
      <WarningTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none" />
      {message}
    </p>
  );

  const quietAction =
    "w-full min-h-control rounded text-body-sm text-fg-muted transition-colors duration-fast hover:text-fg hover:underline underline-offset-2 disabled:text-logwood-600 disabled:no-underline";
  const forgetAction =
    "w-full min-h-control rounded text-caption text-fg-muted transition-colors duration-fast hover:text-fg hover:underline underline-offset-2";
  const footerLink =
    "inline-flex min-h-control items-center text-caption text-fg-muted underline underline-offset-2 hover:text-fg";

  return (
    <div className="min-h-screen min-w-fit flex flex-col justify-between px-4 py-6 sm:px-6 sm:py-12">
      <div className="flex flex-col items-center pb-8 pt-12 sm:flex-1 sm:justify-end sm:pb-12 sm:pt-0">
        <Lockup />
        <p className="mt-6 max-w-sm text-center text-body text-fg-muted">
          {t("welcome.tagline")}
        </p>
      </div>

      <div className="fixed right-4 top-4 z-sticky flex h-11 w-11 items-center justify-center rounded text-fg transition-colors duration-fast hover:bg-raised has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus sm:right-6 sm:top-6">
        <Translate aria-hidden="true" className="pointer-events-none h-6 w-6" />

        <div className="absolute inset-0 cursor-pointer opacity-0 [&>select]:h-full [&>select]:w-full [&>select]:cursor-pointer">
          <LanguagePickerSection />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center space-y-4">
        {showPasswordUnlock && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h2 className="font-serif text-h3 text-heading">{t("welcome.unlock.title")}</h2>
                <p className="mt-1 text-body-sm text-fg-muted">
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
                  if (e.key === "Enter") void handleUnlock();
                }}
                autoFocus
              />
              {error && errorText(error)}
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
              <div>
                <button type="button"
                  onClick={() => router.push("/wallet/restore")}
                  className={quietAction}
                >
                  {t("welcome.unlock.forgotPassword")}
                </button>
                <button type="button"
                  onClick={() => setShowForget(true)}
                  className={forgetAction}
                >
                  {t("welcome.unlock.forget")}
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {showPasskeyUnlock && (
          <Card className="min-w-[250px]">
            <CardContent className="pt-6 space-y-4">
              <div>
                <h2 className="font-serif text-h3 text-heading">{t("welcome.passkey.unlockTitle")}</h2>
                <p className="mt-1 text-body-sm text-fg-muted">
                  {t("welcome.passkey.unlockSubtitle")}
                </p>
              </div>
              {passkeyError && errorText(passkeyError)}
              <Button
                variant="primary"
                size="lg"
                onClick={handlePasskeySignIn}
                loading={passkeyBusy === "signIn"}
                disabled={passkeyBusy !== null}
                className="w-full"
              >
                <Fingerprint aria-hidden="true" className="h-5 w-5 flex-none" />
                <span>{t("welcome.passkey.signIn")}</span>
              </Button>
              <div>
                <button type="button"
                  onClick={() => router.push("/wallet/restore")}
                  className={quietAction}
                >
                  {t("welcome.passkey.useRecoveryPhrase")}
                </button>
                <button type="button"
                  onClick={() => setShowForget(true)}
                  className={forgetAction}
                >
                  {t("welcome.unlock.forget")}
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {!hasVault && !passkeyMode && (
          <>
            <Button
              variant="primary"
              size="lg"
              onClick={handleCreateWallet}
              loading={creatingWallet}
              className="w-full"
            >
              {creatingWallet ? t("welcome.noVault.creating") : t("welcome.noVault.create")}
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-hairline" />
              <span className="text-caption text-fg-muted">
                {t("welcome.noVault.haveWallet")}
              </span>
              <div className="flex-1 border-t border-hairline" />
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push("/wallet/restore")}
              disabled={creatingWallet}
              className="w-full"
            >
              {t("welcome.noVault.restore")}
            </Button>
            {passkeyAvailable && (
              <button
                type="button"
                onClick={() => {
                  setPasskeyError("");
                  setPasskeyMode(true);
                }}
                disabled={creatingWallet}
                className={quietAction}
              >
                {t("welcome.noVault.usePasskey")}
              </button>
            )}
          </>
        )}

        {!hasVault && passkeyMode && (
          <>
            <Button
              variant="primary"
              size="lg"
              onClick={handlePasskeyCreate}
              loading={passkeyBusy === "create"}
              disabled={passkeyBusy !== null}
              className="w-full"
            >
              <Fingerprint aria-hidden="true" className="h-5 w-5 flex-none" />
              <span>{t("welcome.passkey.create")}</span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handlePasskeySignIn}
              loading={passkeyBusy === "signIn"}
              disabled={passkeyBusy !== null}
              className="w-full"
            >
              {t("welcome.passkey.useExisting")}
            </Button>
            {passkeyError && errorText(passkeyError)}
            <button
              type="button"
              onClick={() => {
                setPasskeyError("");
                setPasskeyMode(false);
              }}
              disabled={passkeyBusy !== null}
              className={quietAction}
            >
              {t("welcome.passkey.useRecoveryPhrase")}
            </button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-6 pt-8">
        <Link href="/legal" className={footerLink}>
          {t("welcome.footer")}
        </Link>
        <Link href="/faq" className={footerLink}>
          {t("faq.title")}
        </Link>
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
              variant="danger"
              size="lg"
              onClick={handleForget}
              loading={forgetting}
              disabled={
                forgetting || forgetConfirm.trim().toLowerCase() !== t("forgetWallet.confirmWord")
              }
              className="flex-1"
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
            <p className="text-caption text-fg-muted">
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
