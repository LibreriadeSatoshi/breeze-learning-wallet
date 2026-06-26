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
import { useT } from "@/lib/i18n/hook";
import type { DepositInfo, RecommendedFees } from "@breeztech/breez-sdk-spark";

type FeeChoice = "fast" | "medium" | "slow" | "custom";

export default function RecoveryPage() {
  const t = useT();
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
            aria-label={t("common.back")}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">{t("recovery.title")}</h1>
        </div>

        {rejected.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                {t("recovery.nothing")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {t("recovery.explainer")}
            </p>
            <div className="space-y-3">
              {rejected.map((deposit) => (
                <RefundItem
                  key={`${deposit.txid}:${deposit.vout}`}
                  deposit={deposit}
                  fees={fees}
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
  fees,
  onAfterAction,
}: {
  deposit: DepositInfo;
  fees: RecommendedFees | undefined;
  onAfterAction: () => void;
}) {
  const t = useT();
  const refundMutation = useRefundDeposit();
  const [open, setOpen] = useState(false);
  const [refundAddress, setRefundAddress] = useState("");
  const [choice, setChoice] = useState<FeeChoice>("medium");
  const [customRate, setCustomRate] = useState("");
  const [error, setError] = useState("");

  const fastRate = fees?.fastestFee ?? 0;
  const mediumRate = fees?.halfHourFee ?? 0;
  const slowRate = fees?.hourFee ?? 0;

  const selectedRate = (() => {
    switch (choice) {
      case "fast":
        return fastRate;
      case "medium":
        return mediumRate;
      case "slow":
        return slowRate;
      case "custom":
        return parseInt(customRate, 10);
    }
  })();

  const refund = async () => {
    setError("");
    if (!refundAddress.trim()) {
      setError(t("recovery.addressRequired"));
      return;
    }
    if (isNaN(selectedRate) || selectedRate <= 0) {
      setError(t("recovery.feeRequired"));
      return;
    }
    try {
      await refundMutation.mutateAsync({
        txid: deposit.txid,
        vout: deposit.vout,
        destinationAddress: refundAddress.trim(),
        fee: { type: "rate", satPerVbyte: selectedRate },
      });
      onAfterAction();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("recovery.refundFailed"));
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
          <span className="text-gray-600 dark:text-gray-400">{t("recovery.amount")}</span>
          <span className="font-medium">
            {deposit.amountSats.toLocaleString()} {t("send.sats")}
          </span>
        </div>

        {!open && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setOpen(true)}
            className="w-full"
          >
            {t("recovery.refundButton")}
          </Button>
        )}

        {open && (
          <div className="space-y-3">
            <Input
              label={t("recovery.addressLabel")}
              placeholder={t("recovery.addressPlaceholder")}
              value={refundAddress}
              onChange={(e) => setRefundAddress(e.target.value)}
              disabled={refundMutation.isPending}
            />
            <div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                {t("recovery.feeRate")}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <FeePreset
                  label={t("recovery.feeSlow")}
                  rate={slowRate}
                  selected={choice === "slow"}
                  onClick={() => setChoice("slow")}
                  disabled={refundMutation.isPending}
                />
                <FeePreset
                  label={t("recovery.feeMedium")}
                  rate={mediumRate}
                  selected={choice === "medium"}
                  onClick={() => setChoice("medium")}
                  disabled={refundMutation.isPending}
                />
                <FeePreset
                  label={t("recovery.feeFast")}
                  rate={fastRate}
                  selected={choice === "fast"}
                  onClick={() => setChoice("fast")}
                  disabled={refundMutation.isPending}
                />
              </div>
              <button
                onClick={() => setChoice("custom")}
                className={`text-xs ${
                  choice === "custom"
                    ? "text-blue-600 dark:text-blue-400 font-medium"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
                disabled={refundMutation.isPending}
              >
                {choice === "custom" ? t("recovery.customRate") : t("recovery.orCustomRate")}
              </button>
              {choice === "custom" && (
                <Input
                  className="mt-2"
                  placeholder={t("recovery.customPlaceholder")}
                  value={customRate}
                  onChange={(e) =>
                    setCustomRate(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  inputMode="numeric"
                  disabled={refundMutation.isPending}
                />
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={refundMutation.isPending}
                className="flex-1"
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={refund}
                loading={refundMutation.isPending}
                disabled={refundMutation.isPending}
                className="flex-1"
              >
                {t("recovery.sendRefund")}
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

function FeePreset({
  label,
  rate,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  rate: number;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || rate === 0}
      className={`p-3 rounded-lg border-2 text-center transition-all disabled:opacity-50 ${
        selected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
      }`}
    >
      <div className="text-xs text-gray-600 dark:text-gray-400">{label}</div>
      <div className="text-sm font-semibold">
        {rate > 0 ? `${rate} sat/vB` : "—"}
      </div>
    </button>
  );
}
