"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, WarningTriangle } from "iconoir-react";
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
    <div className="min-h-screen bg-surface">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6">
        <div className="flex items-center gap-2 mb-6">
          <button type="button"
            onClick={() => router.back()}
            aria-label={t("common.back")}
            className="-ml-3 inline-flex min-h-control min-w-[44px] items-center justify-center rounded text-fg transition-colors duration-fast hover:bg-raised"
          >
            <ArrowLeft aria-hidden="true" className="h-6 w-6" />
          </button>
          <h1 className="font-serif text-h2 sm:text-h1 text-heading">{t("recovery.title")}</h1>
        </div>

        {rejected.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-body text-fg-muted">
                {t("recovery.nothing")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="mb-4 text-body-sm text-fg-muted">
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
        <p className="font-mono text-caption text-fg-muted break-all">
          {deposit.txid}:{deposit.vout}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-body-sm">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-fg-muted">{t("recovery.amount")}</span>
          <span className="font-mono font-medium tabular-nums">
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
          <div className="space-y-4">
            <Input
              label={t("recovery.addressLabel")}
              placeholder={t("recovery.addressPlaceholder")}
              value={refundAddress}
              onChange={(e) => setRefundAddress(e.target.value)}
              disabled={refundMutation.isPending}
            />
            <div>
              <div className="mb-2 text-body-sm font-semibold text-fg">
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
              <button type="button"
                onClick={() => setChoice("custom")}
                aria-pressed={choice === "custom"}
                className={`inline-flex min-h-control items-center text-body-sm disabled:text-logwood-600 ${
                  choice === "custom" ? "font-semibold text-fg" : "ism-link"
                }`}
                disabled={refundMutation.isPending}
              >
                {choice === "custom" ? t("recovery.customRate") : t("recovery.orCustomRate")}
              </button>
              {choice === "custom" && (
                <Input
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
            <div className="flex gap-3">
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
          <p className="flex items-start gap-2 text-body-sm text-alert">
            <WarningTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none" />
            {error}
          </p>
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
    <button type="button"
      onClick={onClick}
      disabled={disabled || rate === 0}
      aria-pressed={selected}
      className={`min-h-control rounded border-2 px-2 py-3 text-center transition-colors duration-fast disabled:border-hairline disabled:text-logwood-600 ${
        selected
          ? "border-strong font-semibold text-fg"
          : "border-hairline text-fg-muted hover:border-strong"
      }`}
    >
      <div className="text-body-sm">{label}</div>
      <div className="font-mono text-caption tabular-nums">
        {rate > 0 ? `${rate} sat/vB` : "-"}
      </div>
    </button>
  );
}
