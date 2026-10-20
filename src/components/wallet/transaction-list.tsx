"use client";

import { ArrowDownLeft, ArrowUpRight, Clock, WarningTriangle } from "iconoir-react";
import { Payment } from "@/lib/lightning/types";
import { useFiat } from "@/hooks/use-fiat";
import { convertSatsToFiat } from "@/lib/wallet/format-fiat";
import { useT } from "@/lib/i18n/hook";
import { estimateSats, formatTokenToUSD, SensitiveAmount } from "./balance-display";

interface TransactionListProps {
  readonly payments: Payment[];
  readonly onPaymentClick?: (payment: Payment) => void;
}

export function TransactionList({
  payments,
  onPaymentClick,
}: TransactionListProps) {
  const t = useT();
  return (
    <section>
      <h3 className="border-b-2 border-strong pb-3 font-serif text-h3 text-heading">
        {t("home.recent.title")}
      </h3>
      {payments.length === 0 ? (
        <div className="border-b border-hairline py-8 text-fg-muted">
          <p className="text-body">{t("transactions.empty")}</p>
          <p className="mt-1 text-body-sm">{t("transactions.emptyHint")}</p>
        </div>
      ) : (
        <div className="divide-y divide-hairline border-b border-hairline">
          {payments.slice(0, 10).map((payment) => (
            <TransactionItem
              key={payment.id}
              payment={payment}
              onClick={() => onPaymentClick?.(payment)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface TransactionItemProps {
  readonly payment: Payment;
  readonly onClick?: () => void;
}

function TransactionItem({ payment, onClick }: TransactionItemProps) {
  const t = useT();
  const sats = payment.amount || 0;
  const date = new Date(payment.paymentTime * 1000);
  const isReceived = payment.paymentType === "received";
  const isToken = payment.method === "token";
  const { rate: fiatRate, estableRate: usdRate, currency: fiatCurrency } = useFiat(true);
  const fiat =
    fiatRate !== undefined ? convertSatsToFiat({ sats: sats, ratePerBtc: fiatRate, currency: fiatCurrency }) : null;

  const statusLabels: Record<typeof payment.status, string> = {
    pending: t("transactions.statusPending"),
    complete: "",
    failed: t("transactions.statusFailed"),
  };

  const isConversion = payment.purpose === "autoConversion"
  const ticker = payment.conversionDetails?.to?.ticker || ""
  const defaultMessage = payment.description || (isReceived ? t("transactions.receivedDefault") : t("transactions.sentDefault"))
  const conversionMessage = ticker == "BTC" ? t("transactions.conversion.bitcoin") : t("transactions.conversion.token", {token: ticker})

  const StatusIcon = payment.status === "failed" ? WarningTriangle : Clock;
  const DirectionIcon = isReceived ? ArrowDownLeft : ArrowUpRight;

  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 py-3 text-left transition-colors duration-fast hover:bg-raised"
      onClick={onClick}
    >
      <DirectionIcon aria-hidden="true" className="h-6 w-6 flex-none text-fg" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-body text-fg">
          {isConversion ? conversionMessage : defaultMessage}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 text-caption text-fg-muted">
          <span className="truncate tabular-nums">
            {date.toLocaleDateString()}{" "}
            {date.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {statusLabels[payment.status] && (
            <span
              className={`inline-flex flex-none items-center gap-1 ${
                payment.status === "failed" ? "text-alert" : "text-fg"
              }`}
            >
              <StatusIcon aria-hidden="true" className="h-5 w-5" />
              {statusLabels[payment.status]}
            </span>
          )}
        </div>
      </div>
      <div className="flex-none text-right">
        <div className="font-mono text-body font-medium tabular-nums text-fg">
          {isReceived ? "+" : "-"}
          <SensitiveAmount>
            {isToken ? formatTokenToUSD({amount: sats}) : sats.toLocaleString()}
          </SensitiveAmount>
        </div>
        <div className="ism-label">{isToken ? payment.conversionDetails?.to.ticker : "sats"}</div>
        {fiat && (
          <SensitiveAmount className="block font-mono text-caption tabular-nums text-fg-muted">
            ≈ {isToken ? <>{estimateSats(sats, usdRate)} {t("send.sats")}</> : fiat}
          </SensitiveAmount>
        )}
      </div>
    </button>
  );
}
