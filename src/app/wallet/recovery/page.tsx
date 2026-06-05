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
  useRefundDeposit,
  useRecommendedFees,
} from "@/hooks/use-breez";
import type { DepositInfo } from "@breeztech/breez-sdk-spark";

export default function RecoveryPage() {
  const router = useRouter();
  const isUnlocked = useWalletStore((s) => s.isUnlocked);

  const { data: allDeposits = [], refetch } = useUnclaimedDeposits(isUnlocked);
  const { data: fees } = useRecommendedFees(isUnlocked);

  const rejected = allDeposits.filter((d) => d.claimError);

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
          <h1 className="text-2xl font-bold">Get refund</h1>
        </div>

        {rejected.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Nothing needs a refund. All incoming Bitcoin is being added to
                your wallet automatically.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              These Bitcoin transfers couldn&apos;t be added to your wallet
              automatically — usually because network fees were higher than the
              wallet&apos;s configured cap. You can refund them to a Bitcoin
              address you control.
            </p>
            <div className="space-y-3">
              {rejected.map((deposit) => (
                <RefundItem
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

function RefundItem({
  deposit,
  defaultFeeRate,
  onAfterAction,
}: {
  deposit: DepositInfo;
  defaultFeeRate: number;
  onAfterAction: () => void;
}) {
  const refundMutation = useRefundDeposit();
  const [open, setOpen] = useState(false);
  const [refundAddress, setRefundAddress] = useState("");
  const [feeRate, setFeeRate] = useState(String(defaultFeeRate));
  const [error, setError] = useState("");

  const refund = async () => {
    setError("");
    if (!refundAddress.trim()) {
      setError("Enter a Bitcoin address");
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
      setError(e instanceof Error ? e.message : "Failed to send refund");
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

        {!open && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setOpen(true)}
            className="w-full"
          >
            Refund to Bitcoin
          </Button>
        )}

        {open && (
          <div className="space-y-2">
            <Input
              label="Bitcoin address"
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
                onClick={() => setOpen(false)}
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
                Send refund
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
