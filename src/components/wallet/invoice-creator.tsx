"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Copy as CopyIcon, Eye, EyeClosed, ShareIos, WarningTriangle } from "iconoir-react";
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
import { truncateStr } from "@/lib/wallet/truncate-str";
import { formatSats } from "@/lib/wallet/format-number";

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

  if (!open) {
    return (
      <div>
        <button type="button"
          onClick={() => setOpen(true)}
          className="ism-link min-h-control text-left text-body-sm"
        >
          {openLabel}
        </button>
      </div>
    );
  }

  if (invoice) {
    return (
      <Card className="mt-6">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-2">
            <h3 className="font-serif text-h3 text-heading">{title}</h3>
            {timeRemaining > 0 && (
              <p className="inline-flex items-center gap-2 font-mono text-body-sm tabular-nums text-fg-muted">
                <Clock aria-hidden="true" className="h-5 w-5 flex-none" />
                {t("receive.invoice.timeLeft", { time: formatTime(timeRemaining) })}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="flex items-baseline gap-2">
            <span className="font-mono text-h1 font-medium tabular-nums text-fg">
              {formatSats(invoice.amountSat)}
            </span>
            <span className="font-mono text-body text-fg-muted">{t("send.sats")}</span>
          </p>
          <QrCode aria-label={t("receive.invoice.qrCodeAriaLabel")} value={invoice.paymentRequest} />
          <button
            type="button"
            aria-expanded={showInvoice}
            onClick={() => setShowInvoice((v) => !v)}
            className="flex w-full min-h-control items-center justify-between gap-3 rounded border border-hairline bg-raised p-3 text-left font-mono text-caption text-fg break-all hover:border-strong transition-colors duration-fast"
          >
            <span>{showInvoice ? invoice.paymentRequest : truncateStr(invoice.paymentRequest, 12, 12)}</span>
            {showInvoice
              ? <EyeClosed aria-hidden="true" className="h-5 w-5 flex-none" />
              : <Eye aria-hidden="true" className="h-5 w-5 flex-none" />}
          </button>
          {error && (
            <p className="flex items-start gap-2 text-body-sm text-alert">
              <WarningTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none" />
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="primary"
              onClick={() => copy(invoice.paymentRequest)}
            >
              {copied ? <Check aria-hidden="true" className="h-5 w-5 flex-none" /> : <CopyIcon aria-hidden="true" className="h-5 w-5 flex-none" />}
              <span>{copied ? t("common.copied") : failed ? t("common.copyFailed") : t("common.copy")}</span>
            </Button>
            {typeof navigator !== "undefined" && typeof navigator.share !== "undefined" ? (
              <Button
                variant="outline"
                onClick={share}
              >
                <ShareIos aria-hidden="true" className="h-5 w-5 flex-none" />
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
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center gap-4">
          <h3 className="font-serif text-h3 text-heading">{title}</h3>
          <button type="button"
            onClick={() => setOpen(false)}
            className="-mr-3 min-h-control rounded px-3 text-body-sm text-fg-muted hover:bg-raised hover:text-fg transition-colors duration-fast"
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
            <p className="mt-2 font-mono text-body-sm tabular-nums text-fg-muted">
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
          <p className="flex items-start gap-2 text-body-sm text-alert">
            <WarningTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none" />
            {error}
          </p>
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
