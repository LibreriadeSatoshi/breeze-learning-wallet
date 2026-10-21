"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CloudSync,
  CreditCard,
  DataTransferBoth,
  Key,
  Lock,
  OpenNewWindow,
  Settings as SettingsIcon,
  WarningTriangle,
  WifiOff,
} from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusNote } from "@/components/ui/status-note";
import { Mark } from "@/components/brand/logo";
import { BalanceDisplay } from "@/components/wallet/balance-display";
import { MnemonicDisplay } from "@/components/wallet/mnemonic-display";
import { TransactionList } from "@/components/wallet/transaction-list";
import { PaymentDetailModal } from "@/components/wallet/payment-detail-modal";
import { BuyBitcoinModal } from "@/components/wallet/buy-bitcoin-modal";
import { COURSES_URL, SELECTED_BITCOIN_NETWORK } from "@/lib/config";
import { initializeBreezWallet } from "@/lib/lightning/breez-init";
import {
  onSdkEvent,
  usdbTicker,
} from "@/lib/lightning/breez-service";
import { signInWithPasskey, seedToMnemonic } from "@/lib/auth/passkey";
import {
  useSwapFee,
} from "@/hooks/use-breez";
import { useT } from "@/lib/i18n/hook";
import type { SdkEvent } from "@/lib/lightning/sdk-events";
import type { Balances, ConversionLimits, Payment, UserSettings } from "@/lib/lightning/types";
import { useWalletData } from "@/hooks/use-wallet-data";
import { useWalletStore } from "@/store/wallet-store";
import { DEFAULT_FIAT_CURRENCY } from "@/lib/wallet/prefs";

const CONN_ICON = {
  offline: WifiOff,
  syncing: CloudSync,
  synced: Check,
  failed: WarningTriangle,
} as const;

const HEADER_BUTTON =
  "inline-flex min-h-control min-w-[44px] items-center justify-center gap-2 rounded px-2 text-body-sm text-fg transition-colors duration-fast hover:bg-raised disabled:cursor-not-allowed disabled:text-logwood-600 disabled:hover:bg-transparent";

export default function WalletHomePage() {
  const t = useT();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [isReady, setIsReady] = useState(false);
  const initializingRef = useRef(false);
  const [conn, setConn] = useState<"offline" | "syncing" | "synced" | "failed">("offline");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [seedPassword, setSeedPassword] = useState("");
  const [seedError, setSeedError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [revealedSeed, setRevealedSeed] = useState<string[] | null>(null);
  const [isStableBalance, setIsStableBalance] = useState(false);

  const {isUnlocked, lock, bootstrap, isBootstrapped, verifyPasswordAndReveal, authMode, getMnemonic} = useWalletStore()

  const {
    balances,
    balanceLoading,
    payments,
    paymentsLoading,
    rejectedDeposits,
    fiatRate,
    selectedCurrency,
    estableRate: usdRate,
    toggleStableAsync,
    isSwapPending,
    isSwapError,
    conversionLimits,
    convertionLimitLoading,
    userSettings,
    userSettingsLoading,
    unclaimedDeposits,
    refresh,
  } = useWalletData(isReady);

  const token = balances?.tokenUSDB;
  const ticker = token?.tokenMetadata?.ticker ?? usdbTicker;

  const needsAttention = rejectedDeposits.length;
  const { 
  data: conversionFeeUSD,
  isLoading: isEstimating 
} = useSwapFee({ 
  enabled: showSwapModal && usdRate !== undefined && usdRate !== 0,
  balances: balances as Balances,
  userSettings: userSettings as UserSettings,
  usdRate: usdRate as number,
  conversionLimits: conversionLimits as ConversionLimits
});

  useEffect(() => {
    setMounted(true);
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (mounted && isBootstrapped && !isUnlocked) {
      router.push("/welcome");
    }
  }, [mounted, isBootstrapped, isUnlocked, router]);

  useEffect(() => {
    if (!isUnlocked || isReady || initializingRef.current) return;

    initializingRef.current = true;
    setConn("syncing");

    void (async () => {
      try {
        const result = await initializeBreezWallet();
        if (result.success) {
          setIsReady(true);
          setConn("synced");
          await refresh();
        } else {
          setConn("failed");
          console.error("Failed to initialize:", result.error);
        }
      } catch (error) {
        setConn("failed");
        console.error("Initialization error:", error);
      } finally {
        initializingRef.current = false;
      }
    })();
  }, [isUnlocked, isReady, refresh]);

  useEffect(() => {
    if (!isReady) return;

    const handleEvent = async (event: SdkEvent) => {
      if (event.type === "synced") setConn("synced");

      const shouldRefresh = [
        "synced",
        "paymentSucceeded",
        "paymentPending",
        "paymentFailed",
        "claimedDeposits",
        "newDeposits",
        "unclaimedDeposits",
      ].includes(event.type);

      if (shouldRefresh) await refresh();
    };

    return onSdkEvent(handleEvent);
  }, [isReady, refresh]);

  useEffect(() => {
    if (userSettings?.stableBalanceActiveLabel === usdbTicker) {
      setIsStableBalance(true);
    } else {
      setIsStableBalance(false);
    }
  }, [userSettings]);

  const handleLock = () => {
    lock();
    router.push("/welcome");
  };

  const closeSeedModal = () => {
    setShowSeedModal(false);
    setSeedPassword("");
    setSeedError("");
    setRevealedSeed(null);
  };

  const handleVerifyPassword = async () => {
    setSeedError("");
    if (!seedPassword) {
      setSeedError(t("home.seed.passwordRequired"));
      return;
    }
    setVerifying(true);
    try {
      const mnemonic = await verifyPasswordAndReveal(seedPassword);
      setRevealedSeed(mnemonic.split(" "));
      setSeedPassword("");
    } catch {
      setSeedError(t("home.seed.wrongPassword"));
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyPasskey = async () => {
    setSeedError("");
    setVerifying(true);
    try {
      const seed = await signInWithPasskey();
      const mnemonic = seedToMnemonic(seed);
      if (mnemonic !== getMnemonic()) {
        setSeedError(t("home.seed.passkeyMismatch"));
        return;
      }
      setRevealedSeed(mnemonic.split(" "));
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : t("home.seed.passkeyFailed"));
    } finally {
      setVerifying(false);
    }
  };

  if (!mounted || !isUnlocked) return null;

  const canConvert = () => {
  const { fromBitcoin, toBitcoin } = conversionLimits ?? {};

    if (!isStableBalance) {
      const min = BigInt(fromBitcoin?.minFromAmount ?? 0);
      const current = BigInt(balances?.totalSats ?? 0);
      return min > BigInt(0) && current >= min;
    } else {
      const min = BigInt(toBitcoin?.minFromAmount ?? 0);
      const current = BigInt(token?.balance ?? 0);
      return min > BigInt(0) && current >= min;
    }
  };

  const handleSwap = async () => {
    try {
      const nextState = !isStableBalance;

      await toggleStableAsync({
        enable: nextState,
        label: usdbTicker,
      });

      await refresh();

      setIsStableBalance(nextState);
      setShowSwapModal(false);
    } catch (err) {
      console.error("Error toggling stable balance: ", err);
    }
  };
  const formatConversionFee = (amount: number | null | undefined) => {
    if (!amount || amount === null || amount === undefined) return "";

    const formattedAmount = amount.toLocaleString(undefined, {
      style: "currency",
      currency: DEFAULT_FIAT_CURRENCY,
      minimumFractionDigits: amount == 0 ? 2 : 6,
    });
    return formattedAmount;
    
  }
  const isLoading = balanceLoading || paymentsLoading ||isSwapPending || userSettingsLoading || convertionLimitLoading;

  const ConnIcon = CONN_ICON[conn];

  return (
    <div className="min-h-screen min-w-80">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-reading items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Mark size={32} />
            <div className="hidden min-w-0 sm:block">
              <h1 className="truncate font-serif text-h3 text-heading">{t("home.title")}</h1>
              <p className="truncate text-caption text-fg-muted">{t("home.tagline")}</p>
            </div>
          </div>
          <div className="-mr-2 flex shrink-0 items-center gap-1">
            {SELECTED_BITCOIN_NETWORK === "mainnet" && (
              <button type="button"
                onClick={() => setShowBuyModal(true)}
                disabled={!isReady}
                className={HEADER_BUTTON}
                aria-label={t("home.buyAria")}
              >
                <CreditCard aria-hidden="true" className="h-5 w-5" />
                <span className="hidden sm:inline">{t("home.buy")}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSwapModal(true)}
              disabled={isLoading}
              className={HEADER_BUTTON}
            >
              <DataTransferBoth aria-hidden="true" className="h-5 w-5" />
              <span className="hidden font-mono sm:inline">{isStableBalance ? ticker : "BTC"}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSeedModal(true)}
              className={HEADER_BUTTON}
              aria-label={t("home.phraseAria")}
            >
              <Key aria-hidden="true" className="h-5 w-5" />
              <span className="hidden sm:inline">{t("home.phrase")}</span>
            </button>
            <button type="button"
              onClick={() => router.push("/wallet/settings")}
              aria-label={t("home.settingsAria")}
              className={HEADER_BUTTON}
            >
              <SettingsIcon aria-hidden="true" className="h-5 w-5" />
            </button>
            <button type="button"
              onClick={handleLock}
              aria-label={t("home.lock")}
              className={HEADER_BUTTON}
            >
              <Lock aria-hidden="true" className="h-5 w-5" />
              <span className="hidden sm:inline">{t("home.lock")}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-reading px-4 pb-12 pt-8 sm:px-6">
        <p
          className={`flex items-center gap-2 text-caption ${conn === "failed" ? "text-alert" : "text-fg-muted"}`}
        >
          <ConnIcon aria-hidden="true" className="h-5 w-5 flex-none" />
          {t(`home.connection.${conn}`)}
        </p>

        <BalanceDisplay
          balanceSat={balances?.totalSats || 0}
          fiatRate={fiatRate}
          fiatCurrency={selectedCurrency}
          token={token}
          isStableBalance={isStableBalance}
          usdRate={usdRate}
        />

        {needsAttention > 0 && (
          <StatusNote status="warning" className="mb-6">
            <h3 className="text-body font-semibold">
              {t(needsAttention === 1 ? "home.refund.title_one" : "home.refund.title_other", { count: needsAttention })}
            </h3>
            <p className="mt-1">{t("home.refund.subtitle")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/wallet/recovery")}
              className="mt-3"
            >
              {t("home.refund.action")}
            </Button>
          </StatusNote>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push("/wallet/send")}
            disabled={!isReady}
          >
            <ArrowUpRight aria-hidden="true" className="h-5 w-5 flex-none" />
            <span>{t("home.actions.send")}</span>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/wallet/receive")}
            disabled={!isReady}
          >
            <ArrowDownLeft aria-hidden="true" className="h-5 w-5 flex-none" />
            <span>{t("home.actions.receive")}</span>
          </Button>
        </div>

        <a
          href={COURSES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="ism-link mt-4 inline-flex min-h-control items-center gap-2 text-body-sm"
        >
          <span>{t("home.actions.courses")}</span>
          <OpenNewWindow aria-hidden="true" className="h-5 w-5 flex-none" />
        </a>

        <div className="mt-12">
          {isLoading ? (
            <section aria-busy="true">
              <h3 className="border-b-2 border-strong pb-3 font-serif text-h3 text-heading">
                {t("home.recent.title")}
              </h3>
              <p className="border-b border-hairline py-8 text-body text-fg-muted">
                {t("home.recent.loading")}
              </p>
            </section>
          ) : (
            <TransactionList
              payments={payments}
              onPaymentClick={(payment) => setSelectedPayment(payment)}
            />
          )}
        </div>
      </main>

      <PaymentDetailModal
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />

      {showBuyModal && (
        <BuyBitcoinModal onClose={() => setShowBuyModal(false)} />
      )}

      {showSwapModal && (
        <Modal
          open={showSwapModal}
          onClose={() => setShowSwapModal(false)}
          title={t("home.swap.title", { token: isStableBalance ? "sats" : ticker})}
          description={t("home.swap.description", { token: isStableBalance ? "sats" : ticker})}
        >
          {canConvert() ? (
            <div className="space-y-4">
              <p className="flex flex-wrap items-baseline justify-between gap-x-4 border-y border-hairline py-3 text-body-sm">
                <span className="text-fg-muted">{t("home.swap.conversionFee")}</span>
                <span className="font-mono tabular-nums text-fg">
                  {isEstimating ? t("home.swap.calculatingFee") : formatConversionFee(conversionFeeUSD)}
                </span>
              </p>
              {isSwapError && (
                <StatusNote status="error">{t("home.swap.unknownError")}</StatusNote>
              )}
            </div>
          ) : (
            <StatusNote status="warning">{t("home.swap.insufficientBalance")}</StatusNote>
          )}

          <div className="mt-6 flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowSwapModal(false)}
              disabled={isEstimating}
            >
              {t("common.cancel")}
            </Button>
            <Button
              className="flex-1"
              onClick={handleSwap}
              disabled={isEstimating}
            >
              {t("common.confirm")}
            </Button>
          </div>
        </Modal>
      )}

      <Modal
        open={showSeedModal}
        onClose={closeSeedModal}
        title={revealedSeed ? t("home.seed.titleRevealed") : t("home.seed.titleHidden")}
        description={
          revealedSeed
            ? undefined
            : t(authMode === "passkey" ? "home.seed.passkeyDescription" : "home.seed.description")
        }
        dismissable={!verifying}
      >
        {revealedSeed ? (
          <div className="space-y-4">
            <MnemonicDisplay words={revealedSeed} revealed />
            <StatusNote status="warning">{t("home.seed.warning")}</StatusNote>
            <Button variant="primary" size="lg" onClick={closeSeedModal} className="w-full">
              {t("common.done")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {authMode !== "passkey" && (
              <Input
                type="password"
                label={t("create.password.label")}
                value={seedPassword}
                onChange={(e) => {
                  setSeedPassword(e.target.value);
                  setSeedError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleVerifyPassword();
                }}
                disabled={verifying}
                autoFocus
              />
            )}
            {seedError && (
              <StatusNote status="error">{seedError}</StatusNote>
            )}
            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="lg"
                onClick={closeSeedModal}
                disabled={verifying}
                className="flex-1"
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={authMode === "passkey" ? handleVerifyPasskey : handleVerifyPassword}
                loading={verifying}
                disabled={verifying || (authMode !== "passkey" && !seedPassword)}
                className="flex-1"
              >
                {t(authMode === "passkey" ? "home.seed.verifyWithPasskey" : "home.seed.reveal")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
