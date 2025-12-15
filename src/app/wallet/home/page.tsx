"use client";

import { useEffect, useState, useCallback } from "react";
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
  useReceivePayment
} from "@/hooks/use-breez";
import { SELECTED_BITCOIN_NETWORK } from "@/lib/config";
import type { SdkEvent } from "@/lib/lightning/sdk-events";
import { useAuthStore } from "@/lib/auth/auth-store";
import type { RewardsResponse, PendingReward, ClaimRewardsResponse } from "@/types/rewards";
import type { PaymentsStatusResponse } from "@/types/payments";

export default function WalletHomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const { isInitialized, hasBackedUp } = useWalletStore();
  const { githubUser, clearAuth } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [rewardsClaimed, setRewardsClaimed] = useState(false);
  const [claimedTransactions, setClaimedTransactions] = useState<any[]>([]);
  const [pendingRewards, setPendingRewards] = useState<PendingReward[]>([]);
  const [totalPendingSats, setTotalPendingSats] = useState(0);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const receivePaymentMutation = useReceivePayment();
  const [paymentsStatus, setPaymentsStatus] = useState<PaymentsStatusResponse | null>(null);


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

  // Fetch pending rewards function
  const fetchPendingRewards = useCallback(async () => {
    if (!githubUser?.email) return;

    setLoadingRewards(true);
    setRewardsError(null);

    try {
      const response = await fetch('/api/rewards/pending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: githubUser.email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch rewards');
      }

      const data: RewardsResponse = await response.json();
      setPendingRewards(data.rewards);
      setTotalPendingSats(data.totalSats);

      // Hide rewards section if no pending rewards
      if (data.totalSats === 0) {
        setRewardsClaimed(true);
      }
    } catch (error: any) {
      console.error('Error fetching pending rewards:', error);
      setRewardsError(error.message || 'Failed to load rewards');
      // Don't show error to user if student not found (they might not be in DB yet)
      if (error.message?.includes('Student not found')) {
        setRewardsClaimed(true);
      }
    } finally {
      setLoadingRewards(false);
    }
  }, [githubUser?.email]);

  // Fetch pending rewards when user is available
  useEffect(() => {
    fetchPendingRewards();
  }, [fetchPendingRewards]);


  // Fetch payments status function
  const fetchPaymentsStatus = useCallback(async () => {
    if (!githubUser?.email) return;

    setLoadingRewards(true);
    setRewardsError(null);

    try {
      const response = await fetch('/api/rewards/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: githubUser.email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch rewards');
      }

      const data: PaymentsStatusResponse = await response.json();
      setPaymentsStatus(data);

    } catch (error: any) {
      console.error('Error fetching payments status :', error);
      setRewardsError(error.message || 'Failed to load payments status');
      // Don't show error to user if student not found (they might not be in DB yet)
      if (error.message?.includes('Student not found')) {
        setRewardsClaimed(true);
      }
    } finally {
      setLoadingRewards(false);
    }
  }, [githubUser?.email]);

  // Fetch payments status when user is available
  useEffect(() => {
    fetchPaymentsStatus();
  }, [fetchPaymentsStatus]);

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      clearAuth();
      router.push("/welcome");
    }
  };

  const handleClaimRewards = async () => {
    if (!githubUser?.email || pendingRewards.length === 0) {
      return;
    }

    setClaiming(true);
    setRewardsError(null);

    try {

      if (isNaN(totalPendingSats) || totalPendingSats <= 0) {
        //setError("Please enter a valid amount");
        return;
      }

      const result = await receivePaymentMutation.mutateAsync({
        amountSats: totalPendingSats,
        description: "Lightning payment",
      });
      

      const rewardEventIds = pendingRewards.map(r => r.rewardEventId);
      
      const response = await fetch('/api/rewards/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: githubUser.email,
          rewardEventIds,
          bolt11: result.bolt11,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to claim rewards');
      }

      const data: ClaimRewardsResponse = await response.json();

      if (data.success) {
        // Create a transaction record for display
        // const compoundTransaction = {
        //   id: `learning-rewards-${Date.now()}`,
        //   description: "Learning Rewards",
        //   amountMsat: data.amountSats * 1000,
        //   paymentTime: Date.now(),
        //   status: "succeeded",
        //   paymentType: "received",
        // };
        //
        // setClaimedTransactions([compoundTransaction]);
        // setRewardsClaimed(true);
        // setPendingRewards([]);
        // setTotalPendingSats(0);

        // Refresh payments to show the new transaction
	await fetchPaymentsStatus();
        await refresh();
      } else {
        throw new Error(data.error || 'Failed to claim rewards');
      }
    } catch (error: any) {
      console.error('Error claiming rewards:', error);
      setRewardsError(error.message || 'Failed to claim rewards. Please try again.');
    } finally {
      setClaiming(false);
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600 text-white px-6 pt-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <span className="text-2xl">🎓</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">My Wallet</h1>
                <p className="text-sm text-blue-100">Satoshi Scholar</p>
              </div>
            </div>
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
                  className={`w-2 h-2 rounded-full ${isReady ? "bg-green-500" : "bg-gray-400"
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
          <Card className="mb-6 border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                    Backup Your Wallet
                  </h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                    Secure your funds by backing up your recovery phrase.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/wallet/cloud-backup")}
                    className="border-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
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
            className="h-28 flex flex-col gap-2 shadow-lg hover:shadow-xl transition-all"
          >
            <span className="text-4xl">⚡</span>
            <span className="font-semibold">Send</span>
            <span className="text-xs opacity-80">Pay Lightning Invoice</span>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/wallet/receive")}
            disabled={!isReady}
            className="h-28 flex flex-col gap-2 bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all border-2"
          >
            <span className="text-4xl">📥</span>
            <span className="font-semibold">Receive</span>
            <span className="text-xs opacity-70">Get Paid</span>
          </Button>
        </div>

        {/* Pending Rewards Section
	    TODO here it is necessary to check by each group of rewards
	*/}
        {paymentsStatus?.status == "completed"
	? <div></div>
	: !rewardsClaimed && (loadingRewards || pendingRewards.length > 0 || rewardsError) && (
          <Card className="mb-6 shadow-md border-blue-200 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🎓</span>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Learning Rewards</h3>
                </div>
                {!loadingRewards && (
                  <div className="text-right">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Total Pending</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {totalPendingSats.toLocaleString()} sats
                    </p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingRewards ? (
                <div className="text-center py-8 text-gray-500">
                  Loading rewards...
                </div>
              ) : rewardsError ? (
                <div className="text-center py-4">
                  <p className="text-sm text-red-600 dark:text-red-400 mb-3">{rewardsError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRewardsError(null);
                      fetchPendingRewards();
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : pendingRewards.length > 0 ? (
                <>
                  <div className="space-y-3 mb-4">
                    {pendingRewards.map((reward) => (
                      <div
                        key={reward.rewardEventId}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-900"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {reward.contentTitle}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Completed {reward.contentType === 'course' ? 'course' : 'challenge'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600 dark:text-green-400">
                            +{reward.amountSats.toLocaleString()} sats
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleClaimRewards}
                    loading={claiming}
                    disabled={claiming || totalPendingSats === 0 || paymentsStatus?.status == "created"}
                    className="w-full shadow-lg hover:shadow-xl transition-all"
                  >
                    {paymentsStatus?.status == "created"
		      ? "Pending payment"
		      :claiming
			      ? "⏳ Claiming..."
			      : `🎉 Claim ${totalPendingSats.toLocaleString()} sats`}
                  </Button>
                </>
              ) : null}
            </CardContent>
          </Card>
        )
	}

        {/* Recent Activity */}
        <Card className="mb-6">
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h3>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Loading transactions...
              </div>
            ) : (
              <div>
                {/* Show claimed transactions first */}
                {claimedTransactions.length > 0 && (
                  <div className="mb-4">
                    {claimedTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-4 mb-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                            <span className="text-xl">✓</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {tx.description}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {new Date(tx.paymentTime).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600 dark:text-green-400">
                            +{(tx.amountMsat / 1000).toLocaleString()} sats
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Show regular payments */}
                {payments.length > 0 ? (
                  <TransactionList
                    payments={payments}
                    onPaymentClick={(payment) => console.log(payment)}
                  />
                ) : !claimedTransactions.length ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No recent activity</p>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        {isReady && (
          <Card className="mt-6 shadow-md border-gray-200 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Lightning Node</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Status</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="font-medium text-green-700 dark:text-green-400">Connected</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Last Sync
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{lastSyncText}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Network
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                  {SELECTED_BITCOIN_NETWORK}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {!isReady && (
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-200 dark:border-blue-900 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="animate-pulse">
                <span className="text-2xl">⚡</span>
              </div>
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>Lightning Node:</strong>{" "}
                {initializing ? "Initializing..." : "Connecting..."}
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 pb-6"></div>
      </div>
    </div>
  );
}
