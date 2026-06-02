"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalletStore } from "@/store/wallet-store";
import {
  useRefundables,
  usePaymentsWaitingFeeAcceptance,
  useRecommendedFees,
  useExecuteRefund,
  useFetchProposedFees,
  useAcceptProposedFees,
} from "@/hooks/use-breez";

export default function RecoveryPage() {
  const router = useRouter();
  const isUnlocked = useWalletStore((s) => s.isUnlocked);

  const { data: refundables = [], refetch: refetchRefundables } = useRefundables(isUnlocked);
  const { data: waiting = [], refetch: refetchWaiting } = usePaymentsWaitingFeeAcceptance(isUnlocked);
  const { data: fees } = useRecommendedFees(isUnlocked);

  useEffect(() => {
    if (!isUnlocked) router.push("/welcome");
  }, [isUnlocked, router]);

  if (!isUnlocked) return null;

  const nothingToDo = refundables.length === 0 && waiting.length === 0;

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
          <h1 className="text-2xl font-bold">Swap Recovery</h1>
        </div>

        {nothingToDo && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Nothing needs your attention. All swaps are settled.
              </p>
            </CardContent>
          </Card>
        )}

        {waiting.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">
              Awaiting fee acceptance ({waiting.length})
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              On-chain fees rose between when these payments were prepared and now.
              Accept the new fee to complete the payment, or refund.
            </p>
            <div className="space-y-3">
              {waiting.map((p) => (
                <WaitingFeeItem
                  key={p.txId ?? p.timestamp}
                  payment={p}
                  onAfterAction={() => {
                    refetchWaiting();
                    refetchRefundables();
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {refundables.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">
              Refundable swaps ({refundables.length})
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              These on-chain payments failed to complete the swap. Refund the
              funds to a Bitcoin address you control.
            </p>
            <div className="space-y-3">
              {refundables.map((swap) => (
                <RefundableItem
                  key={swap.swapAddress}
                  swap={swap}
                  defaultFeeRate={fees?.halfHourFee ?? 5}
                  onAfterAction={() => refetchRefundables()}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function WaitingFeeItem({
  payment,
  onAfterAction,
}: {
  payment: { txId?: string; amountSat: number; details: unknown };
  onAfterAction: () => void;
}) {
  const fetchProposedMutation = useFetchProposedFees();
  const acceptMutation = useAcceptProposedFees();
  const [proposed, setProposed] = useState<Awaited<ReturnType<typeof fetchProposedMutation.mutateAsync>> | null>(null);
  const [error, setError] = useState("");

  // PaymentDetails for a bitcoin-type swap has swapId
  const details = payment.details as { type?: string; swapId?: string };
  const swapId = details?.type === "bitcoin" ? details.swapId : undefined;

  const loadProposed = async () => {
    setError("");
    if (!swapId) {
      setError("Missing swap ID");
      return;
    }
    try {
      const r = await fetchProposedMutation.mutateAsync(swapId);
      setProposed(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch proposed fees");
    }
  };

  const accept = async () => {
    if (!proposed) return;
    setError("");
    try {
      await acceptMutation.mutateAsync(proposed);
      onAfterAction();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to accept fees");
    }
  };

  return (
    <Card>
      <CardHeader>
        <p className="font-mono text-xs text-gray-500 dark:text-gray-400 break-all">
          {payment.txId ?? "(no tx id)"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Original amount</span>
          <span className="font-medium">{payment.amountSat.toLocaleString()} sats</span>
        </div>

        {!proposed && (
          <Button
            variant="primary"
            size="sm"
            onClick={loadProposed}
            loading={fetchProposedMutation.isPending}
            disabled={fetchProposedMutation.isPending || !swapId}
            className="w-full"
          >
            See new fee
          </Button>
        )}

        {proposed && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">New fee</span>
              <span className="font-medium">{proposed.feesSat.toLocaleString()} sats</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">You&apos;d receive</span>
              <span className="font-medium">{proposed.receiverAmountSat.toLocaleString()} sats</span>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={accept}
              loading={acceptMutation.isPending}
              disabled={acceptMutation.isPending}
              className="w-full"
            >
              Accept new fee
            </Button>
          </>
        )}

        {error && (
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}

function RefundableItem({
  swap,
  defaultFeeRate,
  onAfterAction,
}: {
  swap: { swapAddress: string; amountSat: number; timestamp: number; lastRefundTxId?: string };
  defaultFeeRate: number;
  onAfterAction: () => void;
}) {
  const refundMutation = useExecuteRefund();
  const [refundAddress, setRefundAddress] = useState("");
  const [feeRate, setFeeRate] = useState(String(defaultFeeRate));
  const [error, setError] = useState("");
  const [txId, setTxId] = useState<string | null>(null);

  const refund = async () => {
    setError("");
    if (!refundAddress.trim()) {
      setError("Enter a Bitcoin refund address");
      return;
    }
    const feeRateSatPerVbyte = parseInt(feeRate, 10);
    if (isNaN(feeRateSatPerVbyte) || feeRateSatPerVbyte <= 0) {
      setError("Fee rate must be a positive number");
      return;
    }
    try {
      const r = await refundMutation.mutateAsync({
        swapAddress: swap.swapAddress,
        refundAddress: refundAddress.trim(),
        feeRateSatPerVbyte,
      });
      setTxId(r.refundTxId);
      onAfterAction();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed");
    }
  };

  return (
    <Card>
      <CardHeader>
        <p className="font-mono text-xs text-gray-500 dark:text-gray-400 break-all">
          {swap.swapAddress}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Amount</span>
          <span className="font-medium">{swap.amountSat.toLocaleString()} sats</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Locked since</span>
          <span className="font-medium">
            {new Date(swap.timestamp * 1000).toLocaleString()}
          </span>
        </div>

        {txId ? (
          <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
            <p className="text-sm text-green-800 dark:text-green-300">
              Refund broadcast — tx <span className="font-mono">{txId.slice(0, 16)}…</span>
            </p>
          </div>
        ) : (
          <>
            <Input
              label="Refund to Bitcoin address"
              placeholder="bc1..."
              value={refundAddress}
              onChange={(e) => setRefundAddress(e.target.value)}
            />
            <Input
              label="Fee rate (sat/vB)"
              value={feeRate}
              onChange={(e) => setFeeRate(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={refund}
              loading={refundMutation.isPending}
              disabled={refundMutation.isPending}
              className="w-full"
            >
              Refund
            </Button>
          </>
        )}

        {error && (
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
