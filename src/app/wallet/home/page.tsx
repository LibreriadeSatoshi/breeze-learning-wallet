"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/store/wallet-store";
import {
  BalanceDisplay,
  BalanceCard,
} from "@/components/wallet/balance-display";
import { TransactionList } from "@/components/wallet/transaction-list";
import { initializeBreezWallet } from "@/lib/lightning/breez-init";
import { onSdkEvent } from "@/lib/lightning/breez-service";
import {
  useLightningBalance,
  usePayments,
  useRefreshLightning,
} from "@/hooks/use-breez";
import { SELECTED_BITCOIN_NETWORK } from "@/lib/config";
import type { SdkEvent } from "@/lib/lightning/sdk-events";
import { useAuthStore } from "@/lib/auth/auth-store";

export default function WalletHomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const { isInitialized, hasBackedUp } = useWalletStore();
  const { githubUser, clearAuth } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const { data: balance, isLoading: balanceLoading } =
    useLightningBalance(isReady);
  const { data: payments = [], isLoading: paymentsLoading } =
    usePayments(isReady);
  const { refresh, isRefetching } = useRefreshLightning();

  // Wait for client-side mount before checking store
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Only redirect after component has mounted and store has hydrated
    if (mounted && !isInitialized) {
      router.push("/welcome");
    }
  }, [mounted, isInitialized, router]);

  useEffect(() => {
    if (!isInitialized || isReady || initializing) return;

    const initialize = async () => {
      setInitializing(true);
      try {
        const result = await initializeBreezWallet();
        if (result.success) {
          setIsReady(true);
          setLastSyncTime(Date.now());
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
  }, [isInitialized, isReady, initializing, refresh]);

  useEffect(() => {
    if (!isReady) return;

    const handleEvent = async (event: SdkEvent) => {
      const shouldRefresh = [
        "paymentSucceeded",
        "paymentPending",
        "paymentFailed",
        "synced",
        "claimedDeposits",
      ].includes(event.type);

      if (event.type === "synced") {
        setLastSyncTime(Date.now());
      }

      if (event.type === "dataSynced" && event.didPullNewRecords) {
        await refresh();
      } else if (shouldRefresh) {
        await refresh();
      }
    };

    return onSdkEvent(handleEvent);
  }, [isReady, refresh]);

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      clearAuth();
      router.push("/welcome");
    }
  };

  // Don't render until mounted to prevent hydration issues
  if (!mounted || !isInitialized) return null;

  const isLoading = balanceLoading || paymentsLoading;
  const lastSyncText = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never";

  return (
    <div className="min-h-screen">
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white px-6 pt-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold">Wallet</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  refresh().then(() => setLastSyncTime(Date.now()))
                }
                disabled={isRefetching || !isReady}
                className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  !isReady
                    ? "Wallet initializing..."
                    : isRefetching
                    ? "Refreshing..."
                    : "Refresh balance"
                }
              >
                <span
                  className={isRefetching ? "inline-block animate-spin" : ""}
                >
                  ⟳
                </span>
              </button>
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-sm">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isReady ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                <span>{isReady ? "Connected" : "Offline"}</span>
              </div>
              {githubUser && (
                <div className="relative group">
                  <div className="relative">
                    <img
                      src={githubUser.avatar_url}
                      alt={githubUser.login}
                      className="w-10 h-10 rounded-full border-2 border-white/30 cursor-pointer hover:border-white/50 transition-colors"
                    />
                    <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-orange-500 bg-green-500" />
                  </div>

                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                    <div className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <img
                          src={githubUser.avatar_url}
                          alt={githubUser.login}
                          className="w-10 h-10 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-gray-900 dark:text-gray-100">
                            {githubUser.name || githubUser.login}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {githubUser.email}
                          </p>
                        </div>
                      </div>

                      <div className="mb-3 p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded">
                        <p className="text-xs text-green-800 dark:text-green-300">
                          ✅ Logged in
                        </p>
                      </div>

                      <button
                        onClick={handleLogout}
                        className="w-full text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 py-2 px-3 rounded transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <BalanceDisplay balanceMsat={balance?.channelsBalanceMsat ?? 0} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-12">
        {!hasBackedUp && (
          <Card className="mb-6 border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-900 dark:text-orange-200 mb-1">
                    Backup Your Wallet
                  </h3>
                  <p className="text-sm text-orange-800 dark:text-orange-300 mb-3">
                    Secure your funds by backing up your recovery phrase.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/wallet/cloud-backup")}
                    className="border-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/20"
                  >
                    Backup Now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push("/wallet/send")}
            disabled={!isReady}
            className="h-24 flex flex-col gap-2"
          >
            <span className="text-3xl">↑</span>
            <span>Send</span>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/wallet/receive")}
            disabled={!isReady}
            className="h-24 flex flex-col gap-2"
          >
            <span className="text-3xl">↓</span>
            <span>Receive</span>
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            Loading transactions...
          </div>
        ) : payments.length > 0 ? (
          <TransactionList
            payments={payments}
            onPaymentClick={(payment) => console.log(payment)}
          />
        ) : null}

        {isReady && (
          <Card className="mt-6">
            <CardHeader>
              <h3 className="font-semibold">Lightning Node</h3>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status</span>
                <span className="font-medium">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Last Sync
                </span>
                <span className="font-medium">{lastSyncText}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Network
                </span>
                <span className="font-medium capitalize">
                  {SELECTED_BITCOIN_NETWORK}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {!isReady && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              ⚡ <strong>Lightning Node:</strong>{" "}
              {initializing ? "Initializing..." : "Connecting..."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
