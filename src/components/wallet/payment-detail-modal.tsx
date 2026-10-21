"use client";

import { ReactElement } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, Clock, Copy as CopyIcon, WarningTriangle, Xmark } from "iconoir-react";
import type { Payment } from "@/lib/lightning/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useFiat } from "@/hooks/use-fiat";
import { convertSatsToFiat } from "@/lib/wallet/format-fiat";
import { useT } from "@/lib/i18n/hook";
import { useCopy } from "@/hooks/use-copy";
import { estimateSats, formatTokenToUSD, SensitiveAmount } from "./balance-display";
import { truncateStr } from "@/lib/wallet/truncate-str";
import { formatSats } from "@/lib/wallet/format-number";

const statusIcons = {
  pending: Clock,
  complete: Check,
  failed: WarningTriangle,
} as const;

const statusStyles = {
  pending: "text-fg",
  complete: "text-fg",
  failed: "text-alert",
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
      feeUSD = formatTokenToUSD({ amount: toFee, fraction: 6 });

    } else if (to?.ticker === "BTC") {
      feeSats += toFee + estimateSats(fromFee, usdRate, from?.decimals);
      feeUSD = formatTokenToUSD({ amount: fromFee, fraction: 6 });

    } else {
      feeUSD = convertSatsToFiat({ sats: feeSats, ratePerBtc: usdRate || 0, fractionDigits: 6 });
    }
  } else {
    feeUSD = convertSatsToFiat({ sats: feeSats, ratePerBtc: usdRate || 0, fractionDigits: 6 });
  }
  
  const DirectionIcon = isReceived ? ArrowDownLeft : ArrowUpRight;
  const StatusIcon = statusIcons[payment.status];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <DirectionIcon aria-hidden="true" className="h-6 w-6 flex-none text-fg" />
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
            <div className="font-mono text-h2 font-medium tabular-nums text-heading">
              {isReceived ? "+" : "-"}
              <SensitiveAmount>{isToken ? `${formatTokenToUSD({amount: amount}).replace("$", "")}` : formatSats(amount)}</SensitiveAmount>
            </div>
            <div className="ism-label">{isToken ? payment.conversionDetails?.to.ticker : t("send.sats")}</div>
          </div>
        </div>
        {amountFiat && (
            <SensitiveAmount className="mt-1 block pl-8 font-mono text-body-sm tabular-nums text-fg-muted">
              ≈ {isToken ? `${amountSats} sats` : amountFiat}
            </SensitiveAmount>
        )}
        <p className={`mt-3 inline-flex items-center gap-2 pl-8 text-body-sm ${statusStyles[payment.status]}`}>
          <StatusIcon aria-hidden="true" className="h-5 w-5 flex-none" />
          {t(`paymentDetail.status${payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}`)}
        </p>
      </div>

      <dl className="divide-y divide-hairline border-y border-hairline text-body-sm">
        <DetailRow label={t("paymentDetail.direction")} value={isReceived ? t("paymentDetail.received") : t("paymentDetail.sent")} />
        <DetailRow
          label={t("paymentDetail.fee")}
          value={
              <>
                <SensitiveAmount className="font-mono tabular-nums">
                  {`${feeSats}  ${t("send.sats")}`}
                </SensitiveAmount>
                {" "}
                {" · ≈ "}
                <SensitiveAmount className="font-mono tabular-nums">
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
    <div className="flex items-start gap-4 py-3">
      <dt className="shrink-0 text-fg-muted">{label}</dt>
      <dd
        className={`ml-auto text-right tabular-nums text-fg ${
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
  const { copied, failed, copy } = useCopy();
  const truncated = truncateStr(value, 8, 6);

  return (
    <div className="flex min-h-12 items-center gap-4">
      <dt className="shrink-0 text-fg-muted">{label}</dt>
      <button type="button"
        onClick={() => copy(value)}
        className="-mr-2 ml-auto inline-flex min-h-control items-center gap-2 rounded px-2 font-mono text-caption text-fg transition-colors duration-fast hover:bg-raised"
        aria-label={t("paymentDetail.copyAria", { label: label.toLowerCase() })}
      >
        <span>{truncated}</span>
        {copied && <Check aria-hidden="true" className="h-5 w-5" />}
        {failed && <Xmark aria-hidden="true" className="h-5 w-5 text-alert" />}
        {!copied && !failed && <CopyIcon aria-hidden="true" className="h-5 w-5 text-fg-muted" />}
      </button>
    </div>
  );
}
