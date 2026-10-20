"use client";

import { ArrowLeft } from "iconoir-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusNote } from "@/components/ui/status-note";
import { useT } from "@/lib/i18n/hook";
import { convertSatsToFiat } from "@/lib/wallet/format-fiat";
import { DEFAULT_FIAT_CURRENCY } from "@/lib/wallet/prefs";
import {
  type PrepareResult,
  describeDestination,
  readAmountSat,
  readFeeSat,
} from "@/lib/wallet/send-helpers";

export function SendConfirmStep({
  prepareResult,
  usdRate,
  error,
  isSending,
  onBack,
  onConfirm,
}: {
  readonly prepareResult: PrepareResult;
  readonly usdRate: number | undefined;
  readonly error: string;
  readonly isSending: boolean;
  readonly onBack: () => void;
  readonly onConfirm: () => void;
}) {
  const t = useT();
  const amountSat = readAmountSat(prepareResult) ?? 0;
  const feesSat = readFeeSat(prepareResult);
  const destLabel = describeDestination(prepareResult, t);

  return (
    <div>
      <div className="max-w-reading mx-auto px-4 py-6 sm:px-6">
        <div className="flex items-center gap-2 mb-6">
          <button type="button"
            onClick={onBack}
            aria-label={t("common.back")}
            className="-ml-3 inline-flex min-h-control min-w-[44px] items-center justify-center rounded text-fg hover:bg-raised transition-colors duration-fast"
          >
            <ArrowLeft aria-hidden="true" className="h-6 w-6" />
          </button>
          <h1 className="font-serif text-h2 text-heading">{t("send.confirmTitle")}</h1>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="ism-label mb-2">{t("send.youreSending")}</p>
            <p className="flex items-baseline gap-2">
              <span className="font-mono text-display font-medium tabular-nums text-fg">
                {amountSat.toLocaleString()}
              </span>
              <span className="font-mono text-body text-fg-muted">{t("send.sats")}</span>
            </p>
            {usdRate !== undefined && (
              <p className="mt-2 font-mono text-body-sm tabular-nums text-fg-muted">
                ≈ {convertSatsToFiat({sats: amountSat, ratePerBtc: usdRate, currency: DEFAULT_FIAT_CURRENCY})}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-4">
            <h2 className="font-serif text-h3 text-heading">{t("send.details")}</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-body-sm">
            <div className="flex justify-between gap-4">
              <span className="text-fg-muted">{t("send.type")}</span>
              <span className="text-right text-fg">{destLabel}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-fg-muted">{t("send.networkFee")}</span>
              <span className="font-mono tabular-nums text-fg">{feesSat.toLocaleString()} {t("send.sats")}</span>
            </div>
            <div className="flex justify-between gap-4 pt-3 border-t border-hairline">
              <span className="font-semibold text-fg">{t("send.total")}</span>
              <span className="font-mono font-semibold tabular-nums text-fg">
                {(amountSat + feesSat).toLocaleString()} {t("send.sats")}
              </span>
            </div>
          </CardContent>
        </Card>

        {error && (
          <StatusNote status="error" className="mb-6">
            {error}
          </StatusNote>
        )}

        <Button
          variant="primary"
          size="lg"
          onClick={onConfirm}
          disabled={isSending}
          loading={isSending}
          className="w-full"
        >
          {isSending
            ? t("send.processing")
            : t("send.confirmSend")}
        </Button>
      </div>
    </div>
  );
}
