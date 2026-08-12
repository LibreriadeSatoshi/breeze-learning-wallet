"use client";

import { useState, ReactElement } from "react";
import { ArrowDownLeft, ArrowUpRight, Copy as CopyIcon, Check } from "lucide-react";
import type { Payment } from "@/lib/lightning/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useFiat } from "@/hooks/use-fiat";
import { convertSatsToFiat } from "@/lib/wallet/format-fiat";
import { useT } from "@/lib/i18n/hook";
import { estimateSats, formatTokenToUSD, SensitiveAmount } from "./balance-display";

const statusStyles = {
  pending: "text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30",
  complete: "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30",
  failed: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30",
} as const;

interface PaymentDetailModalProps {
  readonly payment: Payment | null;
  readonly onClose: () => void;
}

export function PaymentDetailModal({ payment, onClose }: PaymentDetailModalProps) {
  const t = useT();
  return (
    <Modal open={payment !== null} onClose={onClose} title={t("paymentDetail.title")}>
      {payment && <PaymentDetailContent payment={payment} onClose={onClose} />}
    </Modal>
  );
}

function getFiatData(payment: Payment, fiatRate: number | undefined, fiatCurrency: string) {
  const sats = payment.amount;
  const feeSats = payment.fees;

  const amountFiat = fiatRate !== undefined ? convertSatsToFiat({ sats: sats, ratePerBtc: fiatRate, currency: fiatCurrency }) : null;
  const feeFiat = fiatRate !== undefined && feeSats > 0 ? convertSatsToFiat({ sats: feeSats, ratePerBtc: fiatRate, currency: fiatCurrency }) : null;

  return { amountFiat, feeFiat };
}

function PaymentDetailContent({
  payment,
  onClose,
}: {
  readonly payment: Payment;
  readonly onClose: () => void;
}) {
  const t = useT();
  const isReceived = payment.paymentType === "received";
  const isToken = payment.method === "token";
  const date = new Date(payment.paymentTime * 1000);

  const { rate: fiatRate, currency: fiatCurrency, estableRate: usdRate } = useFiat(true);

  const amount = payment.amount
  const amountSats = estimateSats(payment.amount, usdRate || 0); 
  const { amountFiat } = getFiatData(payment, fiatRate, fiatCurrency)

  let feeSats = payment.fees || 0;
  let feeUSD;

  if (payment.conversionDetails) {
    const { from, to } = payment.conversionDetails;
    
    const fromFee = from?.fee || 0;
    const toFee = to?.fee || 0;

    if (from?.ticker === "BTC") {
      feeSats += fromFee + estimateSats(toFee, usdRate, to?.decimals);
      feeUSD = formatTokenToUSD({ amount: toFee.toString(), fraction: 6 });

    } else if (to?.ticker === "BTC") {
      feeSats += toFee + estimateSats(fromFee, usdRate, from?.decimals);
      feeUSD = formatTokenToUSD({ amount: fromFee.toString(), fraction: 6 });

    } else {
      feeUSD = convertSatsToFiat({ sats: feeSats, ratePerBtc: usdRate || 0, fractionDigits: 6 });
    }
  } else {
    feeUSD = convertSatsToFiat({ sats: feeSats, ratePerBtc: usdRate || 0, fractionDigits: 6 });
  }
  
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div
          className={`inline-flex w-12 h-12 rounded-full items-center justify-center mb-3 ${
            isReceived
              ? "bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400"
              : "bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400"
          }`}
        >
          {isReceived ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
        </div>
        <div
          className={`text-3xl font-bold ${
            isReceived
              ? "text-green-600 dark:text-green-400"
              : "text-gray-900 dark:text-gray-100"
          }`}
        >
          {isReceived ? "+" : "-"}
          <SensitiveAmount>{isToken ? `${formatTokenToUSD({amount: amount.toString()}).replace("$", "")}` : amount.toLocaleString()}</SensitiveAmount>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{isToken ? payment.conversionDetails?.to.ticker : t("send.sats")}</div>
        {amountFiat && (
            <SensitiveAmount className="text-sm text-gray-500 dark:text-gray-400 mt-1"> 
              ≈ {isToken ? `${amountSats} sats` : amountFiat}
            </SensitiveAmount>
        )}
        <span
          className={`inline-block mt-3 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusStyles[payment.status]}`}
        >
          {t(`paymentDetail.status${payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}`)}
        </span>
      </div>

      <dl className="divide-y divide-gray-200 dark:divide-gray-800 text-sm">
        <DetailRow label={t("paymentDetail.direction")} value={isReceived ? t("paymentDetail.received") : t("paymentDetail.sent")} />
        <DetailRow
          label={t("paymentDetail.fee")}
          value={
              <>
                <SensitiveAmount>
                  {`${feeSats}  ${t("send.sats")}`}
                </SensitiveAmount>
                {" "}
                {" · ≈ "}
                <SensitiveAmount>
                  {`${feeUSD}`}
                </SensitiveAmount>
              </>
          }
        />
        <DetailRow
          label={t("paymentDetail.time")}
          value={`${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}`}
        />
        {payment.description && (
          <DetailRow label={t("paymentDetail.description")} value={payment.description} wrap />
        )}
        {payment.id && <CopyRow label={t("paymentDetail.paymentId")} value={payment.id} />}
        {payment.bolt11 && <CopyRow label={t("paymentDetail.invoice")} value={payment.bolt11} />}
        {payment.preimage && <CopyRow label={t("paymentDetail.preimage")} value={payment.preimage} />}
      </dl>

      <Button variant="primary" size="lg" onClick={onClose} className="w-full">
        {t("common.close")}
      </Button>
    </div>
  );
}

interface DetailRowProps {
  readonly label: string;
  readonly value: string | ReactElement;
  readonly wrap?: boolean;
}

function DetailRow({
  label,
  value,
  wrap = false,
}: DetailRowProps) {
  return (
    <div className="py-3 flex items-start gap-4">
      <dt className="text-gray-500 dark:text-gray-400 shrink-0">{label}</dt>
      <dd
        className={`ml-auto text-right text-gray-900 dark:text-gray-100 ${
          wrap ? "" : "truncate"
        } max-w-[60%]`}
      >
        {value}
      </dd>
    </div>
  );
}

interface CopyRowProps {
  readonly label: string;
  readonly value: string;
}

function CopyRow({ label, value }: CopyRowProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const truncated = value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked, ignore
    }
  };

  return (
    <div className="py-3 flex items-center gap-4">
      <dt className="text-gray-500 dark:text-gray-400 shrink-0">{label}</dt>
      <button type="button"
        onClick={copy}
        className="ml-auto inline-flex items-center gap-2 font-mono text-xs text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1.5 py-0.5"
        aria-label={t("paymentDetail.copyAria", { label: label.toLowerCase() })}
      >
        <span>{truncated}</span>
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        ) : (
          <CopyIcon className="w-3.5 h-3.5 text-gray-400" />
        )}
      </button>
    </div>
  );
}
