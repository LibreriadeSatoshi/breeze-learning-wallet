"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalletStore } from "@/store/wallet-store";
import {
  useUnclaimedDeposits,
  useClaimDeposit,
  useRefundDeposit,
  useRecommendedFees,
} from "@/hooks/use-breez";
import type { DepositInfo } from "@breeztech/breez-sdk-spark";

export default function RecoveryPage() {
  const router = useRouter();
  const isUnlocked = useWalletStore((s) => s.isUnlocked);

  const { data: deposits = [], refetch } = useUnclaimedDeposits(isUnlocked);
  const { data: fees } = useRecommendedFees(isUnlocked);

  useEffect(() => {
    if (!isUnlocked) router.push("/welcome");
  }, [isUnlocked, router]);

  if (!isUnlocked) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Unclaimed deposits</h1>
        </div>

        {deposits.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                No unclaimed deposits. Everything is settled.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              These on-chain deposits haven&apos;t been claimed onto Spark yet.
              Claim them to receive the funds, or refund them back to a Bitcoin
              address you control.
            </p>
            <div className="space-y-3">
              {deposits.map((deposit) => (
                <DepositItem
                  key={`${deposit.txid}:${deposit.vout}`}
                  deposit={deposit}
                  defaultFeeRate={fees?.halfHourFee ?? 5}
                  onAfterAction={() => refetch()}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DepositItem({
  deposit,
  defaultFeeRate,
  onAfterAction,
}: {
  deposit: DepositInfo;
  defaultFeeRate: number;
  onAfterAction: () => void;
}) {
  const claimMutation = useClaimDeposit();
  const refundMutation = useRefundDeposit();
  const [mode, setMode] = useState<"none" | "claim" | "refund">("none");
  const [refundAddress, setRefundAddress] = useState("");
  const [feeRate, setFeeRate] = useState(String(defaultFeeRate));
  const [error, setError] = useState("");

  const claim = async () => {
    setError("");
    try {
      await claimMutation.mutateAsync({
        txid: deposit.txid,
        vout: deposit.vout,
      });
      onAfterAction();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to claim deposit");
    }
  };

  const refund = async () => {
    setError("");
    if (!refundAddress.trim()) {
      setError("Enter a Bitcoin refund address");
      return;
    }
    const satPerVbyte = parseInt(feeRate, 10);
    if (isNaN(satPerVbyte) || satPerVbyte <= 0) {
      setError("Enter a valid fee rate");
      return;
    }
    try {
      await refundMutation.mutateAsync({
        txid: deposit.txid,
        vout: deposit.vout,
        destinationAddress: refundAddress.trim(),
        fee: { type: "rate", satPerVbyte },
      });
      onAfterAction();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refund deposit");
    }
  };

  return (
    <Card>
      <CardHeader>
        <p className="font-mono text-xs text-gray-500 dark:text-gray-400 break-all">
          {deposit.txid}:{deposit.vout}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Amount</span>
          <span className="font-medium">
            {deposit.amountSats.toLocaleString()} sats
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Status</span>
          <span className="font-medium">
            {deposit.isMature ? "Mature" : "Pending maturity"}
          </span>
        </div>

        {deposit.claimError && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Previous claim attempt failed.
            </p>
          </div>
        )}

        {mode === "none" && (
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setMode("claim")}
              disabled={!deposit.isMature}
              className="flex-1"
            >
              Claim
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode("refund")}
              className="flex-1"
            >
              Refund
            </Button>
          </div>
        )}

        {mode === "claim" && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Claim this deposit onto Spark. Fees are taken from the deposited
              amount at the SDK&apos;s recommended rate.
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode("none")}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={claim}
                loading={claimMutation.isPending}
                disabled={claimMutation.isPending}
                className="flex-1"
              >
                Confirm claim
              </Button>
            </div>
          </div>
        )}

        {mode === "refund" && (
          <div className="space-y-2">
            <Input
              label="Bitcoin refund address"
              placeholder="bc1..."
              value={refundAddress}
              onChange={(e) => setRefundAddress(e.target.value)}
              disabled={refundMutation.isPending}
            />
            <Input
              label="Fee rate (sat/vB)"
              value={feeRate}
              onChange={(e) =>
                setFeeRate(e.target.value.replace(/[^0-9]/g, ""))
              }
              inputMode="numeric"
              disabled={refundMutation.isPending}
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode("none")}
                disabled={refundMutation.isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={refund}
                loading={refundMutation.isPending}
                disabled={refundMutation.isPending}
                className="flex-1"
              >
                Confirm refund
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
