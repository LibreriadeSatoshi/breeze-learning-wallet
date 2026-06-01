"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/store/wallet-store";
import {
  BalanceDisplay,
} from "@/components/wallet/balance-display";
import { TransactionList } from "@/components/wallet/transaction-list";
import { PaymentDetailModal } from "@/components/wallet/payment-detail-modal";
import { initializeBreezWallet } from "@/lib/lightning/breez-init";
import { onSdkEvent } from "@/lib/lightning/breez-service";
import {
  useLightningBalance,
  usePayments,
  usePaymentsWaitingFeeAcceptance,
  useRefreshLightning,
  useRefundables,
} from "@/hooks/use-breez";
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

  const [isReady, setIsReady] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [conn, setConn] = useState<"offline" | "syncing" | "synced" | "failed">("offline");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);


  const { data: balance, isLoading: balanceLoading } =
    useLightningBalance(isReady);
  const { data: payments = [], isLoading: paymentsLoading } =
    usePayments(isReady);
  const { data: refundables = [] } = useRefundables(isReady);
  const { data: waitingFee = [] } = usePaymentsWaitingFeeAcceptance(isReady);
  const { refresh } = useRefreshLightning();

  const needsAttention = refundables.length + waitingFee.length;

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
      else if (event.type === "syncFailed") setConn("failed");

      const shouldRefresh = [
        "paymentSucceeded",
        "paymentPending",
        "paymentFailed",
        "synced",
      ].includes(event.type);

      if (event.type === "dataSynced" && event.didPullNewRecords) {
        await refresh();
      } else if (shouldRefresh) {
        await refresh();
      }
    };

    return onSdkEvent(handleEvent);
  }, [isReady, initializing, refresh]);

  const handleLock = () => {
    lock();
    router.push("/welcome");
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
              <button
                onClick={handleLock}
                className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
              >
                Lock
              </button>
            </div>
          </div>
          <BalanceDisplay balanceMsat={balance?.channelsBalanceMsat ?? 0} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-12">
        {needsAttention > 0 && (
          <Card className="mb-6 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                {needsAttention} swap{needsAttention > 1 ? "s" : ""} need{needsAttention > 1 ? "" : "s"} your attention
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                {waitingFee.length > 0 && refundables.length > 0
                  ? "Some payments are waiting for fee acceptance and some swaps are refundable."
                  : waitingFee.length > 0
                  ? "On-chain fees rose for a pending payment. Accept the new fee or refund."
                  : "One or more swaps failed and the funds are refundable."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/wallet/recovery")}
                className="border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20"
              >
                Resolve
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
            className="h-20 flex flex-col gap-1 shadow-lg hover:shadow-xl transition-all"
          >
            <span className="font-semibold text-lg">Send</span>
            <span className="text-xs opacity-80">Pay Lightning invoice</span>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/wallet/receive")}
            disabled={!isReady}
            className="h-20 flex flex-col gap-1 bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all border-2"
          >
            <span className="font-semibold text-lg">Receive</span>
            <span className="text-xs opacity-70">Get paid</span>
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

        {!isReady && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900 shadow-sm">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              <strong>Lightning node:</strong>{" "}
              {initializing ? "Initializing…" : "Connecting…"}
            </p>
          </div>
        )}

        <div className="mt-8 pb-6"></div>
      </div>

      <PaymentDetailModal
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />
    </div>
  );
}
