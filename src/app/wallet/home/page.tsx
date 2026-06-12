"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Copy as CopyIcon,
  CreditCard,
  Key,
  Lock,
  Settings as SettingsIcon,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useWalletStore } from "@/store/wallet-store";
import {
  BalanceDisplay,
} from "@/components/wallet/balance-display";
import { MnemonicDisplay } from "@/components/wallet/mnemonic-display";
import { TransactionList } from "@/components/wallet/transaction-list";
import { PaymentDetailModal } from "@/components/wallet/payment-detail-modal";
import { BuyBitcoinModal } from "@/components/wallet/buy-bitcoin-modal";
import { SELECTED_BITCOIN_NETWORK } from "@/lib/config";
import { initializeBreezWallet } from "@/lib/lightning/breez-init";
import { onSdkEvent } from "@/lib/lightning/breez-service";
import {
  useBalance,
  usePayments,
  useUnclaimedDeposits,
  useRefreshBreez,
} from "@/hooks/use-breez";
import { useFiat } from "@/hooks/use-fiat";
import type { SdkEvent } from "@/lib/lightning/sdk-events";
import type { Payment } from "@/lib/lightning/types";

const CONN_STYLES: Record<"offline" | "syncing" | "synced" | "failed", { dot: string; label: string }> = {
  offline: { dot: "bg-gray-400", label: "Offline" },
  syncing: { dot: "bg-yellow-400 animate-pulse", label: "Syncing…" },
  synced: { dot: "bg-green-500", label: "Synced" },
  failed: { dot: "bg-red-500", label: "Connection issue" },
};

export default function WalletHomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const lock = useWalletStore((s) => s.lock);
  const bootstrap = useWalletStore((s) => s.bootstrap);
  const isBootstrapped = useWalletStore((s) => s.isBootstrapped);
  const verifyPasswordAndReveal = useWalletStore((s) => s.verifyPasswordAndReveal);

  const [isReady, setIsReady] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [conn, setConn] = useState<"offline" | "syncing" | "synced" | "failed">("offline");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [seedPassword, setSeedPassword] = useState("");
  const [seedError, setSeedError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [revealedSeed, setRevealedSeed] = useState<string[] | null>(null);
  const [seedCopied, setSeedCopied] = useState(false);


  const { data: balance, isLoading: balanceLoading } = useBalance(isReady);
  const { data: payments = [], isLoading: paymentsLoading } =
    usePayments(isReady);
  const { data: unclaimedDeposits = [] } = useUnclaimedDeposits(isReady);
  const { refresh } = useRefreshBreez();
  const { rate: fiatRate, currency: selectedCurrency } = useFiat(isReady);

  const rejectedDeposits = unclaimedDeposits.filter((d) => d.claimError);
  const needsAttention = rejectedDeposits.length;

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
    if (!isUnlocked || isReady || initializing) return;

    const initialize = async () => {
      setInitializing(true);
      try {
        const result = await initializeBreezWallet();
        if (result.success) {
          setIsReady(true);
          await refresh();
        } else {
          console.error("Failed to initialize:", result.error);
        }
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setInitializing(false);
      }
    };

    initialize();
  }, [isUnlocked, isReady, initializing, refresh]);

  useEffect(() => {
    if (initializing) {
      setConn("syncing");
      return;
    }
    if (!isReady) {
      setConn("offline");
      return;
    }
    setConn("synced");

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
  }, [isReady, initializing, refresh]);

  const handleLock = () => {
    lock();
    router.push("/welcome");
  };

  const closeSeedModal = () => {
    setShowSeedModal(false);
    setSeedPassword("");
    setSeedError("");
    setRevealedSeed(null);
    setSeedCopied(false);
  };

  const handleVerifyPassword = async () => {
    setSeedError("");
    if (!seedPassword) {
      setSeedError("Enter your wallet password");
      return;
    }
    setVerifying(true);
    try {
      const mnemonic = await verifyPasswordAndReveal(seedPassword);
      setRevealedSeed(mnemonic.split(" "));
      setSeedPassword("");
    } catch {
      setSeedError("Wrong password");
    } finally {
      setVerifying(false);
    }
  };

  const handleCopySeed = async () => {
    if (!revealedSeed) return;
    try {
      await navigator.clipboard.writeText(revealedSeed.join(" "));
      setSeedCopied(true);
      setTimeout(() => setSeedCopied(false), 2000);
    } catch {
      // clipboard blocked, ignore
    }
  };

  if (!mounted || !isUnlocked) return null;

  const isLoading = balanceLoading || paymentsLoading;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600 text-white px-6 pt-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <span className="text-xl font-bold">₿</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">My Wallet</h1>
                <p className="text-sm text-blue-100">Satoshi Scholar</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-sm">
                <div className={`w-2 h-2 rounded-full ${CONN_STYLES[conn].dot}`} />
                <span>{CONN_STYLES[conn].label}</span>
              </div>
              {SELECTED_BITCOIN_NETWORK === "mainnet" && (
                <button
                  onClick={() => setShowBuyModal(true)}
                  disabled={!isReady}
                  className="inline-flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Buy Bitcoin"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Buy</span>
                </button>
              )}
              <button
                onClick={() => setShowSeedModal(true)}
                className="inline-flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
                aria-label="Show recovery phrase"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Phrase</span>
              </button>
              <button
                onClick={() => router.push("/wallet/settings")}
                aria-label="Settings"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
              <button
                onClick={handleLock}
                className="inline-flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock</span>
              </button>
            </div>
          </div>
          <BalanceDisplay
            balanceSat={balance?.totalSats ?? 0}
            fiatRate={fiatRate}
            fiatCurrency={selectedCurrency}
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
                  {needsAttention} Bitcoin transfer{needsAttention > 1 ? "s" : ""} need{needsAttention > 1 ? "" : "s"} a refund
                </h3>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                Couldn&apos;t add some incoming Bitcoin to your wallet automatically. Send them back to a Bitcoin address you control.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/wallet/recovery")}
                className="border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20"
              >
                Get refund
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
            className="h-20 flex flex-row items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all"
          >
            <ArrowUpFromLine className="w-5 h-5" />
            <span className="font-semibold text-lg">Send</span>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/wallet/receive")}
            disabled={!isReady}
            className="h-20 flex flex-row items-center justify-center gap-3 bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all border-2"
          >
            <ArrowDownToLine className="w-5 h-5" />
            <span className="font-semibold text-lg">Receive</span>
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h3>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Loading transactions...
              </div>
            ) : payments.length > 0 ? (
              <TransactionList
                payments={payments}
                onPaymentClick={(payment) => setSelectedPayment(payment)}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 pb-6"></div>
      </div>

      <PaymentDetailModal
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />

      <BuyBitcoinModal open={showBuyModal} onClose={() => setShowBuyModal(false)} />

      <Modal
        open={showSeedModal}
        onClose={closeSeedModal}
        title={revealedSeed ? "Your recovery phrase" : "Show recovery phrase"}
        description={
          revealedSeed
            ? undefined
            : "Re-enter your wallet password to reveal the 12 words."
        }
        dismissable={!verifying}
      >
        {revealedSeed ? (
          <div className="space-y-4">
            <MnemonicDisplay words={revealedSeed} revealed />
            <Button
              variant="outline"
              onClick={handleCopySeed}
              className="w-full inline-flex items-center justify-center gap-2"
            >
              {seedCopied ? <Check className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
              <span>{seedCopied ? "Copied" : "Copy to clipboard"}</span>
            </Button>
            <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <TriangleAlert className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Anyone with these words can drain your wallet. Never share them
                and avoid cloud-synced plaintext storage.
              </span>
            </div>
            <Button variant="primary" size="lg" onClick={closeSeedModal} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              type="password"
              label="Wallet password"
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
                Cancel
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={handleVerifyPassword}
                loading={verifying}
                disabled={verifying || !seedPassword}
                className="flex-1"
              >
                Reveal
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
