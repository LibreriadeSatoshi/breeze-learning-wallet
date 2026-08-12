"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowDownUp,
  ArrowUpFromLine,
  CreditCard,
  Key,
  Lock,
  Settings as SettingsIcon,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useWalletData, useWalletStore } from "@/store/wallet-store";
import { BalanceDisplay } from "@/components/wallet/balance-display";
import { MnemonicDisplay } from "@/components/wallet/mnemonic-display";
import { TransactionList } from "@/components/wallet/transaction-list";
import { PaymentDetailModal } from "@/components/wallet/payment-detail-modal";
import { BuyBitcoinModal } from "@/components/wallet/buy-bitcoin-modal";
import { SELECTED_BITCOIN_NETWORK } from "@/lib/config";
import { initializeBreezWallet } from "@/lib/lightning/breez-init";
import {
  onSdkEvent,
} from "@/lib/lightning/breez-service";
import { signInWithPasskey, seedToMnemonic } from "@/lib/auth/passkey";
import {
  useSwapFee,
} from "@/hooks/use-breez";
import { useT } from "@/lib/i18n/hook";
import type { SdkEvent } from "@/lib/lightning/sdk-events";
import type { Payment } from "@/lib/lightning/types";

const CONN_DOT: Record<"offline" | "syncing" | "synced" | "failed", string> = {
  offline: "bg-gray-400",
  syncing: "bg-yellow-400 animate-pulse",
  synced: "bg-green-500",
  failed: "bg-red-500",
};

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
  const ticker = token?.tokenMetadata?.ticker ?? "USDB"

  const needsAttention = rejectedDeposits.length;
  const { 
  data: conversionFeeUSD,
  isLoading: isEstimating 
} = useSwapFee({ 
  enabled: showSwapModal && usdRate !== undefined && usdRate !== 0,
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

    (async () => {
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
    if (userSettings?.stableBalanceActiveLabel === "USDB") {
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
        label: "USDB",
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
      currency: "USD",
      minimumFractionDigits: amount == 0 ? 2 : 6,
    });
    return formattedAmount;
    
  }
  const isLoading = balanceLoading || paymentsLoading ||isSwapPending || userSettingsLoading || convertionLimitLoading;

  return (
    <div className="min-h-screen min-w-fit bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600 text-white px-6 pt-6 pb-20">
        <div className="max-w-4xl mx-auto min-w-[280px]">
          <div className="flex justify-between items-center gap-2 mb-8">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0">
                <span className="text-xl font-bold">₿</span>
              </div>
              <div className="flex sm:hidden items-center gap-2 bg-white/10 px-2.5 py-1.5 rounded-full text-sm shrink-0">
                <div className={`w-2 h-2 rounded-full ${CONN_DOT[conn]}`} />
              </div>
              <div className="min-w-0 hidden sm:block">
                <h1 className="text-2xl font-bold truncate">{t("home.title")}</h1>
                <p className="text-sm text-blue-100 truncate">{t("home.tagline")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:flex items-center gap-2 bg-white/10 px-2.5 py-1.5 rounded-full text-sm">
                <div className={`w-2 h-2 rounded-full ${CONN_DOT[conn]}`} />
                <span>{t(`home.connection.${conn}`)}</span>
              </div>
              {SELECTED_BITCOIN_NETWORK === "mainnet" && (
                <button type="button"
                  onClick={() => setShowBuyModal(true)}
                  disabled={!isReady}
                  className="inline-flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 p-2 sm:px-3 sm:py-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={t("home.buyAria")}
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("home.buy")}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSwapModal(true)}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 p-2 sm:px-3 sm:py-1.5 rounded-full transition-colors"
              >
                <ArrowDownUp className="w-4 h-4" />
                <span>{isStableBalance ? ticker : "BTC"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSeedModal(true)}
                className="inline-flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 p-2 sm:px-3 sm:py-1.5 rounded-full transition-colors"
                aria-label={t("home.phraseAria")}
              >
                <Key className="w-4 h-4" />
                <span className="hidden sm:inline">{t("home.phrase")}</span>
              </button>
              <button type="button"
                onClick={() => router.push("/wallet/settings")}
                aria-label={t("home.settingsAria")}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
              <button type="button"
                onClick={handleLock}
                aria-label={t("home.lock")}
                className="inline-flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 p-2 sm:px-3 sm:py-1.5 rounded-full transition-colors"
              >
                <Lock className="w-4 h-4" />
                <span className="hidden sm:inline">{t("home.lock")}</span>
              </button>
            </div>
          </div>
          <BalanceDisplay
            balanceSat={balances?.totalSats || 0}
            fiatRate={fiatRate}
            fiatCurrency={selectedCurrency}
            token={token}
            isStableBalance={isStableBalance}
            usdRate={usdRate}
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-12">
        {needsAttention > 0 && (
          <Card className="mb-6 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <TriangleAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                  {t(needsAttention === 1 ? "home.refund.title_one" : "home.refund.title_other", { count: needsAttention })}
                </h3>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                {t("home.refund.subtitle")}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/wallet/recovery")}
                className="border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20"
              >
                {t("home.refund.action")}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push("/wallet/send")}
            disabled={!isReady}
            className="h-20 min-w-[110px] flex flex-row items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all"
          >
            <ArrowUpFromLine className="w-5 h-5 min-w-6" />
            <span className="font-semibold text-lg">{t("home.actions.send")}</span>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/wallet/receive")}
            disabled={!isReady}
            className="h-20 min-w-[110px] flex flex-row items-center justify-center gap-3 bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all border-2"
          >
            <ArrowDownToLine className="w-5 h-5 min-w-6" />
            <span className="font-semibold text-lg">{t("home.actions.receive")}</span>
          </Button>
        </div>

        <div className="mb-6">
          {isLoading ? (
            <Card>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  {t("home.recent.loading")}
                </div>
              </CardContent>
            </Card>
          ) : (
            <TransactionList
              payments={payments}
              onPaymentClick={(payment) => setSelectedPayment(payment)}
            />
          )}
        </div>

        <div className="mt-8 pb-6"></div>
      </div>

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
          <div className="py-4 text-center">
            {canConvert() ? (
              <div className="space-y-1">
                <p className="text-sm text-gray-400">
                  {t("home.swap.conversionFee")}{" "}
                  <span className="text-white font-medium">
                    {isEstimating ? (
                      <span className="animate-pulse">{t("home.swap.calculatingFee")}</span>
                    ) : (
                      formatConversionFee(conversionFeeUSD)
                    )}
                  </span>
                </p>
                {isSwapError && (
                  <p className="text-sm text-amber-500 dark:text-amber-400">
                    {t("home.swap.unknownError")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-amber-500 dark:text-amber-400">
                {t("home.swap.insufficientBalance")}
              </p>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 w-full mt-2">
            <Button
              className="flex-1 py-2.5 px-4 font-medium rounded-xl transition-colors"
              onClick={() => setShowSwapModal(false)}
              disabled={isEstimating}
            >
              {t("common.cancel")}
            </Button>
            <Button
              className="flex-1 py-2.5 px-4 font-medium rounded-xl transition-colors"
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
            <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <TriangleAlert className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{t("home.seed.warning")}</span>
            </div>
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
                  if (e.key === "Enter") handleVerifyPassword();
                }}
                disabled={verifying}
                autoFocus
              />
            )}
            {seedError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">{seedError}</p>
              </div>
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
