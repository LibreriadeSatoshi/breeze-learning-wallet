"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Payment } from "@/lib/lightning/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useFiat } from "@/hooks/use-fiat";
import { formatFiat } from "@/lib/wallet/format-fiat";
import { useT } from "@/lib/i18n/hook";

interface TransactionListProps {
  payments: Payment[];
  onPaymentClick?: (payment: Payment) => void;
}

export function TransactionList({
  payments,
  onPaymentClick,
}: TransactionListProps) {
  const t = useT();
  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h3 className="font-semibold">{t("home.recent.title")}</h3>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>{t("transactions.empty")}</p>
            <p className="text-sm mt-1">
              {t("transactions.emptyHint")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">{t("home.recent.title")}</h3>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {payments.slice(0, 10).map((payment) => (
            <TransactionItem
              key={payment.id}
              payment={payment}
              onClick={() => onPaymentClick?.(payment)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface TransactionItemProps {
  payment: Payment;
  onClick?: () => void;
}

function TransactionItem({ payment, onClick }: TransactionItemProps) {
  const t = useT();
  const sats = payment.amountSat;
  const date = new Date(payment.paymentTime * 1000);
  const isReceived = payment.paymentType === "received";
  const { rate: fiatRate, currency: fiatCurrency } = useFiat(true);
  const fiat =
    fiatRate !== undefined ? formatFiat(sats, fiatRate, fiatCurrency) : null;

  const statusColors = {
    pending: "text-yellow-600 dark:text-yellow-400",
    complete: "text-green-600 dark:text-green-400",
    failed: "text-red-600 dark:text-red-400",
  };

  const statusLabels: Record<typeof payment.status, string> = {
    pending: t("transactions.statusPending"),
    complete: "",
    failed: t("transactions.statusFailed"),
  };

  return (
    <div
      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isReceived
                ? "bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400"
                : "bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400"
            }`}
          >
            {isReceived ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-medium truncate">
                {payment.description ||
                  (isReceived ? t("transactions.receivedDefault") : t("transactions.sentDefault"))}
              </div>
              {statusLabels[payment.status] && (
                <span className={`text-xs font-medium ${statusColors[payment.status]}`}>
                  {statusLabels[payment.status]}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {date.toLocaleDateString()}{" "}
              {date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div
            className={`font-semibold ${
              isReceived
                ? "text-green-600 dark:text-green-400"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {isReceived ? "+" : "-"}
            {sats.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">sats</div>
          {fiat && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              ≈ {fiat}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
