"use client";

import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button type="button"
            onClick={onBack}
            aria-label={t("common.back")}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">{t("send.confirmTitle")}</h1>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-8 pb-8">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {t("send.youreSending")}
              </p>
              <p className="text-5xl font-bold text-orange-500 mb-2">
                {amountSat.toLocaleString()}
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-400">{t("send.sats")}</p>
              {usdRate !== undefined && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  ≈ {convertSatsToFiat({sats: amountSat, ratePerBtc: usdRate, currency: DEFAULT_FIAT_CURRENCY})}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">{t("send.details")}</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t("send.type")}</span>
              <span className="font-medium">{destLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t("send.networkFee")}</span>
              <span className="font-medium">{feesSat.toLocaleString()} {t("send.sats")}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="font-semibold">{t("send.total")}</span>
              <span className="font-bold text-orange-500">
                {(amountSat + feesSat).toLocaleString()} {t("send.sats")}
              </span>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
            <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
          </div>
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
