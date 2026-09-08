"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Copy as CopyIcon, Eye, EyeOff, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode } from "@/components/wallet/qr-code";
import { useCopy } from "@/hooks/use-copy";
import { useFiat } from "@/hooks/use-fiat";
import { convertSatsToFiat } from "@/lib/wallet/format-fiat";
import { useT } from "@/lib/i18n/hook";
import { onSdkEvent } from "@/lib/lightning/breez-service";
import type { SdkEvent } from "@/lib/lightning/sdk-events";
import type { Payment as SdkPayment } from "@breeztech/breez-sdk-spark";
import type { ReceivedPaymentDetails } from "@/lib/lightning/types";

interface InvoiceState {
  paymentRequest: string;
  expiresAt?: number;
  amountSat: number;
  description: string;
}

function methodForInvoicePayment(
  details: SdkPayment["details"],
  paymentRequest: string,
): ReceivedPaymentDetails["method"] | null {
  if (details?.type === "lightning") {
    return details.invoice === paymentRequest ? "lightning" : null;
  }
  if (details?.type === "spark") {
    return details.invoiceDetails?.invoice === paymentRequest ? "spark" : null;
  }
  return null;
}

export function InvoiceCreator({
  onReceived,
  title,
  openLabel,
  generate: generateInvoice,
  isPending,
}: {
  onReceived: (d: ReceivedPaymentDetails) => void;
  title: string;
  openLabel: string;
  generate: (v: {
    amountSat: number;
    description: string;
  }) => Promise<{ paymentRequest: string; expiresAt?: number }>;
  isPending: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [invoice, setInvoice] = useState<InvoiceState | null>(null);
  const [error, setError] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const { copied, failed, copy } = useCopy();
  const [showInvoice, setShowInvoice] = useState(false)
  const { rate: fiatRate, currency: fiatCurrency } = useFiat(true);
  const amountSat = parseInt(amount, 10) || 0;
  const fiatPreview =
    amountSat > 0 && fiatRate !== undefined
      ? convertSatsToFiat({sats:amountSat, ratePerBtc: fiatRate, currency: fiatCurrency})
      : null;

  useEffect(() => {
    const expiresAt = invoice?.expiresAt;
    if (expiresAt === undefined) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining === 0) {
        clearInterval(id);
        setError(t("receive.invoice.expired"));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [invoice, t]);

  useEffect(() => {
    if (!invoice) return;
    const handler = (e: SdkEvent) => {
      if (e.type !== "paymentSucceeded") return;
      const p = e.payment;
      const method = methodForInvoicePayment(p.details, invoice.paymentRequest);
      if (!method) return;
      onReceived({
        id: p.id,
        amountSat: Number(p.amount),
        feesSat: Number(p.fees),
        timestamp: p.timestamp,
        method,
        status: p.status,
      });
    };
    return onSdkEvent(handler);
  }, [invoice, onReceived]);

  const generate = async () => {
    setError("");
    const amountSat = parseInt(amount, 10);
    if (isNaN(amountSat) || amountSat <= 0) {
      setError(t("receive.invoice.amountInvalid"));
      return;
    }
    try {
      const result = await generateInvoice({ amountSat, description });
      setInvoice({
        paymentRequest: result.paymentRequest,
        expiresAt: result.expiresAt,
        amountSat,
        description,
      });
      if (result.expiresAt !== undefined) {
        setTimeRemaining(Math.max(0, Math.floor((result.expiresAt - Date.now()) / 1000)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("receive.invoice.generateFailed"));
    }
  };


  const share = async () => {
    if (!invoice || !navigator.share) return;
    try {
      await navigator.share({
        title,
        text: invoice.paymentRequest,
      });
    } catch {
      // user cancelled or share unavailable
    }
  };

  const reset = () => {
    setInvoice(null);
    setAmount("");
    setDescription("");
    setError("");
    setTimeRemaining(0);
  };

  const truncate = (text: string, i: number, f: number): string => {
    if (text.length <= (i + f)) {
      return text
    }

    let initial = text.substring(0, i)
    let final = text.substring(text.length - f, text.length)

    return `${initial}...${final}`
  }

  if (!open) {
    return (
      <div className="text-center">
        <button type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {openLabel}
        </button>
      </div>
    );
  }

  if (invoice) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{title}</h3>
            {timeRemaining > 0 && (
              <div className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/20 px-3 py-1 rounded-full text-xs">
                <Clock className="w-3 h-3 text-amber-700 dark:text-amber-300" />
                <span className="font-medium text-amber-700 dark:text-amber-300">
                  {t("receive.invoice.timeLeft", { time: formatTime(timeRemaining) })}
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center">
            <span className="text-3xl font-bold text-orange-500">
              {invoice.amountSat.toLocaleString()}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">{t("send.sats")}</span>
          </p>
          <QrCode aria-label={t("receive.invoice.qrCodeAriaLabel")} value={invoice.paymentRequest} />
          <div className="flex items-center justify-center flex-row bg-gray-100 dark:bg-gray-800 p-3 rounded-lg break-all font-mono text-xs">
            {showInvoice ? invoice.paymentRequest : truncate(invoice.paymentRequest, 12, 12)}
            {showInvoice ? <EyeOff className="pl-2 min-w-6" onClick={() => setShowInvoice(false)}/> : <Eye className="pl-2 min-w-6" onClick={() => setShowInvoice(true)}/> }
          </div>
          {error && (
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="primary"
              onClick={() => copy(invoice.paymentRequest)}
              className="inline-flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
              <span>{copied ? t("common.copied") : failed ? t("common.copyFailed") : t("common.copy")}</span>
            </Button>
            {typeof navigator !== "undefined" && typeof navigator.share !== "undefined" ? (
              <Button
                variant="outline"
                onClick={share}
                className="inline-flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>{t("common.share")}</span>
              </Button>
            ) : (
              <Button variant="outline" onClick={reset}>
                {t("receive.invoice.newInvoice")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">{title}</h3>
          <button type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {t("common.hide")}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Input
            label={t("receive.invoice.addressAmountLabel")}
            placeholder={t("receive.invoice.addressAmountPlaceholder")}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
          />
          {fiatPreview && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              ≈ {fiatPreview}
            </p>
          )}
        </div>
        <Input
          label={t("receive.invoice.descriptionLabel")}
          placeholder={t("receive.invoice.descriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={100}
        />
        {error && (
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        )}
        <Button
          variant="primary"
          size="lg"
          onClick={generate}
          loading={isPending}
          disabled={isPending || !amount}
          className="w-full"
        >
          {t("receive.invoice.generate")}
        </Button>
      </CardContent>
    </Card>
  );
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
