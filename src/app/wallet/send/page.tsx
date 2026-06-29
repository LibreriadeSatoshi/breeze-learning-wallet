"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clipboard, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalletStore } from "@/store/wallet-store";
import {
  useBalance,
  useParseInput,
  usePrepareSend,
  useExecuteSend,
  usePrepareLnurlPay,
  useExecuteLnurlPay,
} from "@/hooks/use-breez";
import { useFiat } from "@/hooks/use-fiat";
import { formatFiat } from "@/lib/wallet/format-fiat";
import { useT } from "@/lib/i18n/hook";
import type {
  PrepareSendResult,
  PrepareLnurlPayResult,
} from "@/lib/lightning/breez-service";
import type { InputType, LnurlPayRequestDetails } from "@breeztech/breez-sdk-spark";

type SendStep = "input" | "confirm" | "processing" | "success" | "error";

type PrepareResult =
  | { kind: "send"; data: PrepareSendResult; destinationKind: SendDestinationKind }
  | { kind: "lnurlPay"; data: PrepareLnurlPayResult; domain: string };

type SendDestinationKind =
  | "bolt11"
  | "bolt12"
  | "bitcoinAddress"
  | "sparkAddress"
  | "sparkInvoice"
  | "bip21";

export default function SendPage() {
  const t = useT();
  const router = useRouter();
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const [step, setStep] = useState<SendStep>("input");
  const [destination, setDestination] = useState("");
  const [amountSatInput, setAmountSatInput] = useState("");
  const [prepareResult, setPrepareResult] = useState<PrepareResult | null>(null);
  const [error, setError] = useState("");

  const { data: balance } = useBalance(true);
  const { rate: fiatRate, currency: fiatCurrency } = useFiat(true);
  const parseMutation = useParseInput();
  const prepareMutation = usePrepareSend();
  const executeMutation = useExecuteSend();
  const prepareLnurlMutation = usePrepareLnurlPay();
  const executeLnurlMutation = useExecuteLnurlPay();

  const balanceSat = balance?.totalSats ?? 0;

  useEffect(() => {
    if (!isUnlocked) router.push("/welcome");
  }, [isUnlocked, router]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDestination(text.trim());
        setError("");
      }
    } catch {
      setError(t("send.pasteFailed"));
    }
  };

  const handleContinue = async () => {
    setError("");
    const dest = destination.trim();
    if (!dest) {
      setError(t("send.destinationRequired"));
      return;
    }
    try {
      const parsed = await parseMutation.mutateAsync(dest);
      const unsupported = describeUnsupported(parsed, t);
      if (unsupported) {
        setError(unsupported);
        return;
      }

      const amountSat = amountSatInput ? parseInt(amountSatInput, 10) : undefined;

      let prep: PrepareResult;
      if (parsed.type === "lnurlPay" || parsed.type === "lightningAddress") {
        const payRequest: LnurlPayRequestDetails =
          parsed.type === "lightningAddress"
            ? parsed.payRequest
            : pickLnurlPayDetails(parsed);
        if (!amountSat || amountSat <= 0) {
          setError(t("send.lnurlAmountRequired"));
          return;
        }
        const minSat = Math.ceil(payRequest.minSendable / 1000);
        const maxSat = Math.floor(payRequest.maxSendable / 1000);
        if (amountSat < minSat || amountSat > maxSat) {
          setError(t("send.lnurlRange", { min: minSat.toLocaleString(), max: maxSat.toLocaleString() }));
          return;
        }
        const lnurlPrep = await prepareLnurlMutation.mutateAsync({
          payRequest,
          amountSat,
        });
        prep = { kind: "lnurlPay", data: lnurlPrep, domain: payRequest.domain };
      } else {
        const sendPrep = await prepareMutation.mutateAsync({
          destination: dest,
          amountSat,
        });
        prep = {
          kind: "send",
          data: sendPrep,
          destinationKind: destinationKindForParsed(parsed),
        };
      }

      const sendAmountSat = readAmountSat(prep);
      if (sendAmountSat !== null && sendAmountSat > balanceSat) {
        setError(t("send.insufficientBalance", { balance: balanceSat.toLocaleString() }));
        return;
      }
      setPrepareResult(prep);
      setStep("confirm");
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("send.parseFailed");
      setError(msg);
    }
  };

  const handleConfirmPayment = async () => {
    if (!prepareResult) return;
    setStep("processing");
    setError("");
    try {
      if (prepareResult.kind === "send") {
        await executeMutation.mutateAsync(prepareResult.data);
      } else {
        await executeLnurlMutation.mutateAsync(prepareResult.data);
      }
      setStep("success");
      setTimeout(() => router.push("/wallet/home"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("send.failed"));
      setStep("error");
    }
  };

  const handleBack = () => {
    if (step === "confirm") setStep("input");
    else router.back();
  };

  const handleRetry = () => {
    setStep("input");
    setError("");
    setDestination("");
    setAmountSatInput("");
    setPrepareResult(null);
  };

  if (!isUnlocked) return null;

  if (step === "input") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleBack}
              aria-label={t("common.back")}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">{t("send.title")}</h1>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t("send.available")}
                </p>
                <p className="text-3xl font-bold text-orange-500">
                  {balanceSat.toLocaleString()} {t("send.sats")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">{t("send.destination.title")}</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label={t("send.destination.label")}
                placeholder={t("send.destination.placeholder")}
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setError("");
                }}
                error={error || undefined}
                helperText={t("send.destination.helper")}
              />

              <Input
                label={t("send.amount.label")}
                placeholder={t("send.amount.placeholder")}
                value={amountSatInput}
                onChange={(e) =>
                  setAmountSatInput(e.target.value.replace(/[^0-9]/g, ""))
                }
                inputMode="numeric"
                helperText={t("send.amount.helper")}
              />

              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  onClick={handlePaste}
                  className="inline-flex items-center justify-center gap-2"
                >
                  <Clipboard className="w-4 h-4" />
                  <span>{t("send.paste")}</span>
                </Button>
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={handleContinue}
                disabled={
                  !destination ||
                  prepareMutation.isPending ||
                  prepareLnurlMutation.isPending ||
                  parseMutation.isPending
                }
                loading={
                  prepareMutation.isPending ||
                  prepareLnurlMutation.isPending ||
                  parseMutation.isPending
                }
                className="w-full"
              >
                {prepareMutation.isPending ||
                prepareLnurlMutation.isPending ||
                parseMutation.isPending
                  ? t("send.checking")
                  : t("common.continue")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "confirm" && prepareResult) {
    const amountSat = readAmountSat(prepareResult) ?? 0;
    const feesSat = readFeeSat(prepareResult);
    const destLabel = describeDestination(prepareResult, t);

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleBack}
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
                {fiatRate !== undefined && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    ≈ {formatFiat(amountSat, fiatRate, fiatCurrency)}
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
            onClick={handleConfirmPayment}
            disabled={executeMutation.isPending || executeLnurlMutation.isPending}
            loading={executeMutation.isPending || executeLnurlMutation.isPending}
            className="w-full"
          >
            {executeMutation.isPending || executeLnurlMutation.isPending
              ? t("send.processing")
              : t("send.confirmSend")}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          <h2 className="text-2xl font-bold mb-2">{t("send.sendingPayment")}</h2>
        </div>
      </div>
    );
  }

  if (step === "success") {
    const amountSat = prepareResult ? readAmountSat(prepareResult) ?? 0 : 0;
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <Check className="w-10 h-10 text-green-600 dark:text-green-400" strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-bold mb-3 text-green-600">{t("send.sent")}</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
            {amountSat.toLocaleString()} {t("send.sats")}
          </p>
          <Button variant="primary" onClick={() => router.push("/wallet/home")}>
            {t("send.backToWallet")}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <X className="w-10 h-10 text-red-600 dark:text-red-400" strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-bold mb-3 text-red-600">{t("send.failed")}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
            {error || t("send.genericError")}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.push("/wallet/home")}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={handleRetry}>
              {t("send.tryAgain")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function pickLnurlPayDetails(
  parsed: Extract<InputType, { type: "lnurlPay" }>,
): LnurlPayRequestDetails {
  return {
    callback: parsed.callback,
    minSendable: parsed.minSendable,
    maxSendable: parsed.maxSendable,
    metadataStr: parsed.metadataStr,
    commentAllowed: parsed.commentAllowed,
    domain: parsed.domain,
    url: parsed.url,
    address: parsed.address,
    allowsNostr: parsed.allowsNostr,
    nostrPubkey: parsed.nostrPubkey,
  };
}

function readAmountSat(prep: PrepareResult): number | null {
  if (prep.kind === "lnurlPay") return prep.data.amountSats;
  return Number(prep.data.amount);
}

function readFeeSat(prep: PrepareResult): number {
  if (prep.kind === "lnurlPay") return prep.data.feeSats;
  const m = prep.data.paymentMethod;
  switch (m.type) {
    case "bolt11Invoice":
      return m.lightningFeeSats + (m.sparkTransferFeeSats ?? 0);
    case "bitcoinAddress":
      return m.feeQuote.speedMedium.userFeeSat + m.feeQuote.speedMedium.l1BroadcastFeeSat;
    case "sparkAddress":
    case "sparkInvoice":
      return Number(m.fee);
    case "crossChainAddress":
      return Number(m.feeAmount) + m.sourceTransferFeeSats;
  }
}

function destinationKindForParsed(parsed: InputType): SendDestinationKind {
  switch (parsed.type) {
    case "bolt11Invoice":
      return "bolt11";
    case "bolt12Offer":
    case "bolt12Invoice":
    case "bolt12InvoiceRequest":
      return "bolt12";
    case "bitcoinAddress":
      return "bitcoinAddress";
    case "sparkAddress":
      return "sparkAddress";
    case "sparkInvoice":
      return "sparkInvoice";
    case "bip21":
      return "bip21";
    default:
      return "bolt11";
  }
}

function describeDestination(
  prep: PrepareResult,
  t: (k: string, p?: Record<string, string | number>) => string,
): string {
  if (prep.kind === "lnurlPay") return t("send.destinationKind.lnurlPay", { domain: prep.domain });
  return t(`send.destinationKind.${prep.destinationKind}`);
}

function describeUnsupported(
  parsed: InputType,
  t: (k: string) => string,
): string | null {
  switch (parsed.type) {
    case "lnurlAuth":
      return t("send.unsupported.lnurlAuth");
    case "lnurlWithdraw":
      return t("send.unsupported.lnurlWithdraw");
    case "url":
      return t("send.unsupported.url");
    case "silentPaymentAddress":
      return t("send.unsupported.silentPayment");
    default:
      return null;
  }
}
